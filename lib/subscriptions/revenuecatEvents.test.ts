// Guards the single writer of `subscriptions`, which getUserTier reads for
// every tier decision in the app. The SLT review asked for a case per event
// type, not a test of only the new one, because a wrong mapping mis-tiers a
// real paying customer.

import { describe, it, expect } from 'vitest'
import { toStatus, isGrantEvent, NON_EXPIRING_GRANT_YEARS } from './revenuecatEvents'

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
