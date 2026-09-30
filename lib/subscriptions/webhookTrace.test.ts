import { describe, it, expect } from 'vitest'
import { webhookTrace, normaliseEnvironment, type SubscriptionProvider, type WebhookOutcome } from './webhookTrace'

// OPS-SUBS-TRACE-01. What matters here is not that a mapping exists but that the
// two providers stay SYMMETRIC: the reason this owner is shared is that the Stripe
// route had the same gap as RevenueCat and instrumenting one twin reads as finished.
// So the tests assert both providers over every outcome, from one table.

const PROVIDERS: SubscriptionProvider[] = ['revenuecat', 'stripe']
const RESULTS: WebhookOutcome['result'][] = ['received', 'write_failed', 'unhandled', 'unusable']

function outcomeFor(result: WebhookOutcome['result']): WebhookOutcome {
  switch (result) {
    case 'received':     return { result, eventType: 'INITIAL_PURCHASE', status: 'active', applied: true }
    case 'write_failed': return { result, eventType: 'RENEWAL', status: 'active', message: 'boom' }
    case 'unhandled':    return { result, eventType: 'SOMETHING_NEW' }
    case 'unusable':     return { result, eventType: 'customer.subscription.updated', missing: 'user_id' }
  }
}

describe('webhookTrace — provider symmetry', () => {
  it('produces a distinct kind for every provider x outcome', () => {
    const kinds = new Set<string>()
    for (const p of PROVIDERS) {
      for (const r of RESULTS) kinds.add(webhookTrace(p, outcomeFor(r)).kind)
    }
    // 2 providers x 4 outcomes, none colliding. A collision would mean one
    // provider's trace was silently filed under the other's kind.
    expect(kinds.size).toBe(8)
  })

  it('every kind is prefixed with its own provider', () => {
    for (const p of PROVIDERS) {
      for (const r of RESULTS) {
        expect(webhookTrace(p, outcomeFor(r)).kind.startsWith(`${p}_event_`)).toBe(true)
      }
    }
  })

  it('always carries provider and event_type, for every outcome', () => {
    for (const p of PROVIDERS) {
      for (const r of RESULTS) {
        const { detail } = webhookTrace(p, outcomeFor(r))
        expect(detail.provider).toBe(p)
        expect(detail.event_type).toBe(outcomeFor(r).eventType)
      }
    }
  })
})

describe('webhookTrace — the ordering guard must be visible either way', () => {
  it('records applied:true on a delivery that was applied', () => {
    const { kind, detail } = webhookTrace('revenuecat',
      { result: 'received', eventType: 'RENEWAL', status: 'active', applied: true })
    expect(kind).toBe('revenuecat_event_received')
    expect(detail.applied).toBe(true)
    expect(detail.status).toBe('active')
  })

  // THE POINT OF THE SUCCESS TRACE. A suppressed stale delivery previously only
  // console.log'd, so the SUBS-ORDERING-REVENUECAT-01 guard could not be observed
  // firing at all. `applied:false` is correct behaviour that must leave a row.
  it('records a SUPPRESSED stale delivery rather than dropping it', () => {
    const { kind, detail } = webhookTrace('stripe',
      { result: 'received', eventType: 'customer.subscription.updated', status: 'cancelled', applied: false })
    expect(kind).toBe('stripe_event_received')
    expect(detail.applied).toBe(false)
  })
})

describe('webhookTrace — a dropped payment is not an unhandled event', () => {
  it('names the missing field so the cause is in the row, not inferred', () => {
    const { kind, detail } = webhookTrace('stripe',
      { result: 'unusable', eventType: 'customer.subscription.updated', missing: 'current_period_end' })
    expect(kind).toBe('stripe_event_unusable')
    expect(detail.missing).toBe('current_period_end')
  })

  it('keeps unusable and unhandled as different kinds', () => {
    const unusable  = webhookTrace('stripe', { result: 'unusable', eventType: 'x', missing: 'user_id' }).kind
    const unhandled = webhookTrace('stripe', { result: 'unhandled', eventType: 'x' }).kind
    expect(unusable).not.toBe(unhandled)
  })
})

describe('webhookTrace — no payload, no PII', () => {
  it('truncates a provider error string', () => {
    const long = 'x'.repeat(1000)
    const { detail } = webhookTrace('revenuecat',
      { result: 'write_failed', eventType: 'RENEWAL', status: 'active', message: long })
    expect((detail.message as string).length).toBeLessThanOrEqual(301)
    expect(detail.message).toMatch(/…$/)
  })

  it('leaves a short message intact and unmarked', () => {
    const { detail } = webhookTrace('stripe',
      { result: 'write_failed', eventType: 'RENEWAL', status: 'active', message: 'short' })
    expect(detail.message).toBe('short')
  })

  // The detail is read from a dashboard and ops_events deliberately SURVIVES
  // account deletion (anonymised, ON DELETE SET NULL), so anything here outlives
  // the account. Assert the shape is closed rather than trusting the call sites.
  it('emits only the declared keys', () => {
    const allowed = new Set(['provider', 'event_type', 'status', 'applied', 'message', 'missing'])
    for (const p of PROVIDERS) {
      for (const r of RESULTS) {
        for (const k of Object.keys(webhookTrace(p, outcomeFor(r)).detail)) {
          expect(allowed.has(k)).toBe(true)
        }
      }
    }
  })
})


// ── ENVIRONMENT (OPS-SUBS-ALERT-01 follow-up) ───────────────────────────────
// Recorded because the digest could not tell a founder sandbox redemption from a
// real lost sale, and ranked both above everything else it prints.
describe('normaliseEnvironment', () => {
  it('accepts both provider spellings, case-insensitively', () => {
    expect(normaliseEnvironment('SANDBOX')).toBe('sandbox')
    expect(normaliseEnvironment('PRODUCTION')).toBe('production')
    expect(normaliseEnvironment('sandbox')).toBe('sandbox')
    expect(normaliseEnvironment(' Production ')).toBe('production')
  })

  it('returns null — never a default — for anything it does not recognise', () => {
    // "we do not know which world this was" must not collapse into "production".
    for (const v of ['', 'live', 'test', 'PROD', undefined, null, 42, {}]) {
      expect(normaliseEnvironment(v), `${String(v)} must not resolve`).toBeNull()
    }
  })

  it('REFUSES BOOLEANS, which is the polarity guard', () => {
    // Stripe's `livemode` is true-for-live; RevenueCat's `is_sandbox` is
    // true-for-sandbox. Accepting either here would let one route silently invert
    // the other. Each converts at its own call site, beside the field name.
    expect(normaliseEnvironment(true)).toBeNull()
    expect(normaliseEnvironment(false)).toBeNull()
  })
})

describe('webhookTrace records the environment', () => {
  it('stamps it on every outcome, for both providers', () => {
    for (const p of PROVIDERS) for (const r of RESULTS) {
      expect(webhookTrace(p, outcomeFor(r), 'SANDBOX').detail.environment,
        `${p}/${r} must carry the environment`).toBe('sandbox')
    }
  })

  it('OMITS the key when unknown, rather than writing a null', () => {
    // A row with no `environment` predates the field. That is a different fact
    // from "we asked the provider and could not tell", and the two must not merge.
    const d = webhookTrace('revenuecat', outcomeFor('unusable')).detail
    expect('environment' in d).toBe(false)
    expect(webhookTrace('stripe', outcomeFor('received'), 'nonsense').detail)
      .not.toHaveProperty('environment')
  })
})
