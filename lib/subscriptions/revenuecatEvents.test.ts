// Guards the single writer of `subscriptions`, which getUserTier reads for
// every tier decision in the app. The SLT review asked for a case per event
// type, not a test of only the new one, because a wrong mapping mis-tiers a
// real paying customer.

import { describe, it, expect } from 'vitest'
import { toStatus, isGrantEvent, eventAtIso, NON_EXPIRING_GRANT_YEARS } from './revenuecatEvents'

describe('toStatus — RevenueCat event mapping', () => {
  it.each([
    ['INITIAL_PURCHASE',      'active'],
    ['RENEWAL',               'active'],
    ['UNCANCELLATION',        'active'],
    ['TRIAL_STARTED',         'trialing'],
    ['TRIAL_CONVERTED',       'active'],
    ['EXPIRATION',            'expired'],
    ['NON_RENEWING_PURCHASE', 'active'],   // the comp path
    ['SUBSCRIPTION_EXTENDED', 'active'],
    // 🔴 CHARITY-OFFER-CODE-01 (2026-09-28) — THESE TWO MOVED OUT OF THE
    // "does not understand" LIST BELOW, AND THE REVERSAL IS DELIBERATE.
    //
    // TRANSFER is the only event that can re-key a purchase made BEFORE the
    // runner had an account: the receipt attaches to an anonymous RevenueCat id
    // and `logIn` later aliases it. The alias itself fires SUBSCRIBER_ALIAS,
    // which RevenueCat marks deprecated and does not send to new projects — so
    // leaving TRANSFER unmapped meant a redeemed offer code could never reach
    // the account that redeemed it. It fires for the DESTINATION user, who is
    // the one now holding the entitlement.
    ['TRANSFER',              'active'],
    ['PRODUCT_CHANGE',        'active'],   // switched plan, still subscribed
  ] as const)('%s -> %s', (event, expected) => {
    expect(toStatus(event)).toBe(expected)
  })

  it('returns null for an event it does not understand, rather than guessing', () => {
    // ⚠️ BILLING_ISSUE STAYS NULL ON PURPOSE, and it is the interesting one: it
    // opens Apple's GRACE PERIOD, during which the runner still has access and
    // Apple keeps retrying. Mapping it to `cancelled` or `expired` would revoke a
    // paying customer mid-grace; if the retry ultimately fails, EXPIRATION
    // follows and that IS handled. SUBSCRIPTION_PAUSED is the same shape.
    for (const unknown of ['BILLING_ISSUE', 'SUBSCRIPTION_PAUSED', 'SUBSCRIBER_ALIAS', 'WHAT_IS_THIS']) {
      expect(toStatus(unknown)).toBeNull()
    }
  })

  // 🔴 SUBS-CANCELLATION-TIER-01 (2026-09-28) — CANCELLATION MOVED TO null, AND
  // THIS ROW USED TO SAY 'cancelled'.
  //
  // In Apple's vocabulary CANCELLATION means auto-renew was switched off. Access
  // continues to `expires_date`; EXPIRATION is what ends it. Writing `cancelled`
  // demoted a runner still inside a period they had paid for, because
  // `resolveTier` grants paid only on ['trialing','active'].
  //
  // ⚠️ AND AN OFFER CODE WITH AUTO-RENEW OFF EMITS IT ON EVERY REDEMPTION — for
  // `tester1@test.com` INITIAL_PURCHASE and CANCELLATION arrived in the SAME
  // SECOND, so the newer one won. All 500 Make-A-Wish runners would have dropped
  // to free about two minutes after redeeming.
  it('CANCELLATION does not end access — only EXPIRATION does', () => {
    expect(toStatus('CANCELLATION')).toBeNull()
    expect(toStatus('EXPIRATION')).toBe('expired')
  })

  // Regression guard for the actual defect. Without the NON_RENEWING_PURCHASE
  // case this is null, the route writes nothing, and a comped runner stays
  // 'free' and still meets the marathon paywall.
  it('a dashboard-granted comp maps to a status getUserTier treats as paid', () => {
    const status = toStatus('NON_RENEWING_PURCHASE')
    expect(status).not.toBeNull()
    expect(['trialing', 'active']).toContain(status)
  })
})

describe('isGrantEvent — open-ended comps must not inherit the 30-day default', () => {
  it('identifies the grant events', () => {
    expect(isGrantEvent('NON_RENEWING_PURCHASE')).toBe(true)
    expect(isGrantEvent('SUBSCRIPTION_EXTENDED')).toBe(true)
  })

  it('does not treat ordinary subscription events as grants', () => {
    for (const e of ['INITIAL_PURCHASE', 'RENEWAL', 'TRIAL_STARTED', 'CANCELLATION', 'EXPIRATION']) {
      expect(isGrantEvent(e)).toBe(false)
    }
  })

  // Wood's cliff, as a test: a comp with no expiry that inherited the 30-day
  // subscription default would cut a charity runner off around week four of a
  // sixteen-week block.
  it('the open-ended grant window outlasts a full marathon block', () => {
    const grantDays = NON_EXPIRING_GRANT_YEARS * 365
    expect(grantDays).toBeGreaterThan(18 * 7)  // longest plan we ship
    expect(grantDays).toBeGreaterThan(30)      // and past the subscription default
  })
})

/**
 * SUBS-ORDERING-REVENUECAT-01 — the resolver that decides whether the ordering
 * guard engages at all.
 *
 * The route used to write with a plain upsert while `/api/webhooks/stripe` went
 * through `apply_subscription_event`. The guard's own migration names BOTH
 * providers — "Stripe (and RevenueCat) do not guarantee delivery order… could
 * re-activate a cancelled subscription via the plain upsert" — so this route was
 * performing the exact write that sentence calls the hazard.
 */
describe('eventAtIso — the ordering guard engages, or says it did not', () => {
  it('converts RevenueCat epoch millis to ISO', () => {
    expect(eventAtIso({ event_timestamp_ms: 1_758_700_000_000 }))
      .toBe(new Date(1_758_700_000_000).toISOString())
  })

  // ⚠️ THE IMPORTANT ONE. null makes `apply_subscription_event` apply the write —
  // i.e. exactly the old plain-upsert behaviour — so a wrong field name degrades
  // to the status quo instead of silently DROPPING a paying customer's write.
  it('returns null when the field is absent, not a fabricated timestamp', () => {
    expect(eventAtIso({})).toBeNull()
    expect(eventAtIso({ event_timestamp_ms: undefined })).toBeNull()
  })

  it('refuses unusable values rather than producing an Invalid Date', () => {
    for (const bad of [null, 'nonsense', NaN, Infinity, 0, -1, {}, []]) {
      expect(eventAtIso({ event_timestamp_ms: bad as never }), String(bad)).toBeNull()
    }
  })

  // 🔴 THE DESIGN CHOICE, ASSERTED AS A PROPERTY. `now()` was the obvious fallback
  // and is the dangerous one: it stamps a STALE event as the newest, defeating the
  // guard on precisely the delivery it exists to suppress. Determinism is what
  // separates the two implementations — a clock fallback returns a DIFFERENT value
  // on each call, and an earlier draft of this case asserted `toBeNull()` again
  // followed by unreachable code, which is a gate that looks like two checks and
  // is one. Mutation-verified: returning `new Date().toISOString()` here turns
  // three cases in this file red.
  it('is deterministic — the missing-timestamp path never reads the clock', () => {
    const a = eventAtIso({})
    const b = eventAtIso({})
    expect(a).toBe(b)
    expect(a).toBeNull()
  })

  // The guard's ordering semantics, expressed on the values this feeds it: a
  // CANCELLATION at T2 followed by a late RENEWAL at T1 must be comparable, and
  // T1 must sort before T2 so the RPC's `s.last_event_at <= excluded` suppresses it.
  it('produces values that sort by real event time, so a late event reads as older', () => {
    const cancelledAt = eventAtIso({ event_timestamp_ms: 2_000_000_000_000 })!
    const staleRenewal = eventAtIso({ event_timestamp_ms: 1_000_000_000_000 })!
    expect(staleRenewal < cancelledAt).toBe(true)
  })
})
