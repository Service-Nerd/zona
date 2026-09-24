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
    ['CANCELLATION',          'cancelled'],
    ['EXPIRATION',            'expired'],
    ['NON_RENEWING_PURCHASE', 'active'],   // the comp path
    ['SUBSCRIPTION_EXTENDED', 'active'],
  ] as const)('%s -> %s', (event, expected) => {
    expect(toStatus(event)).toBe(expected)
  })

  it('returns null for an event it does not understand, rather than guessing', () => {
    for (const unknown of ['BILLING_ISSUE', 'PRODUCT_CHANGE', 'TRANSFER', 'SUBSCRIBER_ALIAS', 'WHAT_IS_THIS']) {
      expect(toStatus(unknown)).toBeNull()
    }
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
