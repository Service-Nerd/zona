import { describe, it, expect } from 'vitest'
import { readEntitlement, type RevenueCatSubscriber } from './entitlement'
import { toStatus, isSupabaseAppUserId } from './revenuecatEvents'

// CHARITY-OFFER-CODE-01. This decides who gets paid access, so it is tested
// against the journeys a Make-A-Wish runner actually takes, not against shapes.

const NOW = new Date('2026-09-28T12:00:00Z')
const sub = (ents: Record<string, unknown>, subs: Record<string, unknown> = {}): RevenueCatSubscriber =>
  ({ subscriber: { entitlements: ents as never, subscriptions: subs as never } })

describe('readEntitlement', () => {
  it('is not entitled on an empty or absent payload', () => {
    expect(readEntitlement(null, NOW).entitled).toBe(false)
    expect(readEntitlement({}, NOW).entitled).toBe(false)
    expect(readEntitlement(sub({}), NOW).entitled).toBe(false)
  })

  it('is entitled while an entitlement is in date', () => {
    const r = readEntitlement(sub({ pro: { expires_date: '2027-09-28T12:00:00Z' } }), NOW)
    expect(r.entitled).toBe(true)
    expect(r.entitlementId).toBe('pro')
  })

  it('is NOT entitled once it has expired', () => {
    expect(readEntitlement(sub({ pro: { expires_date: '2026-09-27T12:00:00Z' } }), NOW).entitled).toBe(false)
  })

  // 🔴 THE `?? 0` CLASS. A null expiry is a LIFETIME grant, which is exactly the
  // shape a charity partnership hands out. Reading it as "no date, therefore not
  // active" would deny access to the cohort this work exists for.
  it('treats a null expiry as LIFETIME, not as expired', () => {
    const r = readEntitlement(sub({ pro: { expires_date: null } }), NOW)
    expect(r.entitled).toBe(true)
    expect(r.expiresAt).toBeNull()
  })

  it('keeps the LONGEST entitlement when several are active', () => {
    const r = readEntitlement(sub({
      pro:   { expires_date: '2026-12-01T00:00:00Z' },
      wish:  { expires_date: '2027-06-01T00:00:00Z' },
    }), NOW)
    // Never take access away from someone who already paid for longer.
    expect(r.expiresAt).toBe('2027-06-01T00:00:00Z')
  })

  it('a lifetime entitlement beats a dated one', () => {
    const r = readEntitlement(sub({
      dated: { expires_date: '2027-01-01T00:00:00Z' },
      life:  { expires_date: null },
    }), NOW)
    expect(r.expiresAt).toBeNull()
  })

  it('ignores an unparseable expiry rather than granting on it', () => {
    expect(readEntitlement(sub({ pro: { expires_date: 'not-a-date' } }), NOW).entitled).toBe(false)
  })
})

describe('readEntitlement — the cohort key', () => {
  it('reports the offer code for the entitled product', () => {
    const r = readEntitlement(sub(
      { pro: { expires_date: '2027-09-28T12:00:00Z', product_identifier: 'zonna_annual' } },
      { zonna_annual: { offer_code: 'WISHHERO27' } },
    ), NOW)
    expect(r.offerCode).toBe('WISHHERO27')
  })

  it('reports null — never a default — when no code is present', () => {
    const r = readEntitlement(sub(
      { pro: { expires_date: '2027-09-28T12:00:00Z', product_identifier: 'zonna_annual' } },
      { zonna_annual: {} },
    ), NOW)
    expect(r.offerCode).toBeNull()
  })

  it('refuses to guess when two different codes are present', () => {
    const r = readEntitlement(sub(
      { pro: { expires_date: '2027-09-28T12:00:00Z' } },
      { a: { offer_code: 'WISHHERO27' }, b: { offer_code: 'OTHER' } },
    ), NOW)
    // Attributing the wrong cohort is worse than attributing none.
    expect(r.offerCode).toBeNull()
  })
})

describe('the two event types the offer-code journey needs', () => {
  // TRANSFER is the only event that can re-key a purchase made before the runner
  // had an account: SUBSCRIBER_ALIAS is deprecated and not sent to new projects.
  it('TRANSFER grants access to the destination user', () => {
    expect(toStatus('TRANSFER')).toBe('active')
  })

  it('PRODUCT_CHANGE keeps them subscribed', () => {
    expect(toStatus('PRODUCT_CHANGE')).toBe('active')
  })

  // ⚠️ Deliberate: a billing issue opens Apple's grace period and the runner
  // still has access. Revoking here would cut off a paying customer mid-grace;
  // if the retry fails, EXPIRATION follows and IS handled.
  it('BILLING_ISSUE and SUBSCRIPTION_PAUSED do NOT revoke access', () => {
    expect(toStatus('BILLING_ISSUE')).toBeNull()
    expect(toStatus('SUBSCRIPTION_PAUSED')).toBeNull()
    expect(toStatus('EXPIRATION')).toBe('expired')
  })
})

describe('isSupabaseAppUserId — the bug that dropped the entitlement', () => {
  it('accepts a real user id', () => {
    expect(isSupabaseAppUserId('193f4b38-fd41-4d78-a7c7-46cee5786c12')).toBe(true)
  })

  // Verified against production: apply_subscription_event answers
  // "invalid input syntax for type uuid" for this, the route 500s, and
  // RevenueCat retries forever because the id never becomes valid.
  it('rejects a RevenueCat anonymous id', () => {
    expect(isSupabaseAppUserId('$RCAnonymousID:abc123')).toBe(false)
  })

  it('rejects the shapes that would slip past a loose check', () => {
    for (const bad of [null, undefined, '', 'undefined', 123, {}, '193f4b38fd414d78a7c746cee5786c12']) {
      expect(isSupabaseAppUserId(bad as never), String(bad)).toBe(false)
    }
  })
})
