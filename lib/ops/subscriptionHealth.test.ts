import { describe, it, expect } from 'vitest'
import {
  ENTITLEMENT_AT_RISK_KINDS, AT_RISK_WINDOW_DAYS,
  isEntitlementAtRisk, judgeEntitlementRisk, remedyFor, type AtRiskRow,
  isPreSignupRedemption, PRE_SIGNUP_MISSING,
} from './subscriptionHealth'
import { webhookTrace, SUBSCRIPTION_PROVIDERS } from '@/lib/subscriptions/webhookTrace'

// OPS-SUBS-ALERT-01. These kinds fire only when a runner HAS PAID and the
// entitlement did not land, and it is the one failure the founder cannot discover
// by using the app (his own row is hand-seeded and is_admin resolves him paid).
// So the expensive mistake here is not a wrong headline — it is a kind that exists
// and is not in the list, because then nothing looks for it at all.

describe('ENTITLEMENT_AT_RISK_KINDS — completeness, walked from the trace owner', () => {
  // 🔴 THE TEST THAT EARNS ITS KEEP. It does not assert the list's contents; it
  // derives what the list MUST contain by asking `webhookTrace` what it can emit
  // for every provider. A third provider added to SUBSCRIPTION_PROVIDERS without
  // classifying its failure kinds fails here — which is the drift that would
  // otherwise leave a paid-but-unentitled runner invisible.
  it('covers every write_failed and unusable kind both webhooks can emit', () => {
    const emittable = SUBSCRIPTION_PROVIDERS.flatMap(p => [
      webhookTrace(p, { result: 'write_failed', eventType: 'x', status: 'active', message: 'm' }).kind,
      webhookTrace(p, { result: 'unusable', eventType: 'x', missing: 'user_id' }).kind,
    ])
    const missing = emittable.filter(k => !isEntitlementAtRisk(k))
    expect(missing, 'classify these in ENTITLEMENT_AT_RISK_KINDS — a purchase that did not become an entitlement').toEqual([])
  })

  it('holds nothing that is NOT a failure kind — received and unhandled are not money-critical', () => {
    // A `_received` row is the heartbeat and an `_unhandled` row is an event we
    // have no mapping for. Treating either as a lost sale would put a line in the
    // digest every single day, and NOISE-GATE-01 records what happens then.
    const benign = SUBSCRIPTION_PROVIDERS.flatMap(p => [
      webhookTrace(p, { result: 'received', eventType: 'x', status: 'active', applied: true }).kind,
      webhookTrace(p, { result: 'unhandled', eventType: 'x' }).kind,
    ])
    for (const k of benign) expect(isEntitlementAtRisk(k), `${k} must not be money-critical`).toBe(false)
  })

  it('every listed kind has a remedy that is not the fallback', () => {
    for (const k of ENTITLEMENT_AT_RISK_KINDS) {
      expect(remedyFor(k), k).not.toBe('Not an entitlement-risk kind.')
      expect(remedyFor(k).length).toBeGreaterThan(40)
    }
  })

  it('looks back further than the digest\'s generic 24h feed', () => {
    // The whole reason this exists as its own section: Q4's 24-hour window means a
    // Saturday failure is gone by Monday.
    expect(AT_RISK_WINDOW_DAYS).toBeGreaterThan(1)
  })
})

const row = (kind: string, user_id: string | null = 'u1'): AtRiskRow =>
  ({ kind, created_at: '2026-09-28T09:00:00Z', user_id })

describe('judgeEntitlementRisk', () => {
  it('stays silent on an empty set, and says so positively', () => {
    const v = judgeEntitlementRisk([])
    expect(v.alert).toBe(false)
    expect(v.count).toBe(0)
    expect(v.headline).toMatch(/every purchase became an entitlement/i)
  })

  it('ignores rows that are not money-critical', () => {
    const v = judgeEntitlementRisk([row('stripe_event_received'), row('ai_call'), row('plan_rule_invalid')])
    expect(v.alert).toBe(false)
    expect(v.count).toBe(0)
  })

  it('fires on a single failed write and names the account count', () => {
    const v = judgeEntitlementRisk([row('stripe_event_write_failed', 'u1')])
    expect(v.alert).toBe(true)
    expect(v.count).toBe(1)
    expect(v.affectedAccounts).toBe(1)
    expect(v.headline).toContain('resolveTier')
  })

  // Severity order is not cosmetic: `_unusable` is a 400 that Stripe retries only
  // briefly, so it can be a permanently lost sale where `_write_failed` is a 500
  // the provider retries properly.
  it('reports the WORST kind present, not the most recent', () => {
    const v = judgeEntitlementRisk([
      row('revenuecat_event_write_failed'),
      row('stripe_event_unusable'),
      row('stripe_event_write_failed'),
    ])
    expect(v.worst).toBe('stripe_event_unusable')
  })

  it('counts an unattributable failure separately and says it is worse, not better', () => {
    const v = judgeEntitlementRisk([row('stripe_event_unusable', null), row('stripe_event_write_failed', 'u2')])
    expect(v.unattributable).toBe(1)
    expect(v.affectedAccounts).toBe(1)          // only u2 is identifiable
    expect(v.headline).toMatch(/UNATTRIBUTABLE/)
  })

  it('does not double-count one account across several failures', () => {
    const v = judgeEntitlementRisk([
      row('stripe_event_write_failed', 'u1'),
      row('stripe_event_write_failed', 'u1'),
      row('stripe_event_unusable', 'u1'),
    ])
    expect(v.count).toBe(3)
    expect(v.affectedAccounts).toBe(1)
  })
})


// ── THE PRE-SIGNUP CARVE-OUT ────────────────────────────────────────────────
// Falsified against the REAL production rows this alert judged on its first
// firing. Every one of them was a founder sandbox redemption of an offer code,
// and the alert called all four "a runner PAID and did not get access".
const preSignup = (user_id: string | null = null): AtRiskRow => ({
  kind: 'revenuecat_event_unusable',
  created_at: '2026-09-28T15:39:49Z',
  user_id,
  detail: { provider: 'revenuecat', event_type: 'INITIAL_PURCHASE', missing: PRE_SIGNUP_MISSING },
})

describe('pre-signup offer-code redemptions are counted, not alerted on', () => {
  it('recognises the row the RevenueCat route actually writes', () => {
    expect(isPreSignupRedemption(preSignup())).toBe(true)
  })

  it('does NOT alert on the four rows recorded in production on 2026-09-28', () => {
    // The real set: two INITIAL_PURCHASE, one CANCELLATION (auto-renew off fires it
    // on every redemption), one TRANSFER — all anonymous, all self-healing.
    const v = judgeEntitlementRisk([preSignup(), preSignup(), preSignup(), preSignup()])
    expect(v.alert, 'four expected redemptions must not read as four lost sales').toBe(false)
    expect(v.count).toBe(0)
    expect(v.unattributable).toBe(0)
    expect(v.preSignupRedemptions).toBe(4)
    expect(v.headline).toMatch(/pre-signup offer-code redemption/)
  })

  it('keeps the carve-out NARROW — any other `missing` on the same kind still alerts', () => {
    const other: AtRiskRow = {
      kind: 'revenuecat_event_unusable',
      created_at: '2026-09-28T15:39:49Z',
      user_id: 'u1',
      detail: { missing: 'expiration_at_ms' },
    }
    expect(isPreSignupRedemption(other)).toBe(false)
    expect(judgeEntitlementRisk([other]).alert).toBe(true)
  })

  it('a kind with no detail at all is NOT swallowed by the carve-out', () => {
    expect(isPreSignupRedemption(row('revenuecat_event_unusable'))).toBe(false)
    expect(judgeEntitlementRisk([row('revenuecat_event_unusable')]).alert).toBe(true)
  })

  it('a real failure alongside pre-signup rows still alerts, and excludes them from the count', () => {
    const v = judgeEntitlementRisk([
      preSignup(), preSignup(),
      row('stripe_event_write_failed', 'u9'),
    ])
    expect(v.alert).toBe(true)
    expect(v.count, 'the two expected redemptions must not inflate a real incident').toBe(1)
    expect(v.affectedAccounts).toBe(1)
    expect(v.preSignupRedemptions).toBe(2)
  })

  it('still reports them when otherwise clean — counted is not the same as hidden', () => {
    const v = judgeEntitlementRisk([preSignup()])
    expect(v.alert).toBe(false)
    expect(v.preSignupRedemptions).toBe(1)
    expect(v.headline).toMatch(/Confirm the entitlement landed/)
  })

  it('the kind stays listed, so completeness still covers it', () => {
    // The carve-out is at the ROW level on purpose. Removing the kind from the list
    // would make a genuinely dropped RevenueCat payment invisible.
    expect(isEntitlementAtRisk('revenuecat_event_unusable')).toBe(true)
  })
})
