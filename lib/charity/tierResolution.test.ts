// GTM-CHARITY-04 — the tier-resolution contract, as rules rather than wiring.
//
// getUserTier itself needs a live service-role Supabase client, so it is not
// unit-testable here. What IS testable, and what actually carries the risk, is
// the ORDER and the PREDICATES it applies. Both are asserted below against the
// same helper the real function uses.
//
// Why this file exists at all: `DashboardClient` re-implements this resolution
// on the client (it cannot call a service-role function), and the comment there
// warns that the two must agree — D-16, no parallel semantics. Changing one and
// not the other makes a comped runner `paid` on the server and `free` in the
// UI, so they see paywalls over features the API is happily serving. That
// exact split was nearly shipped while building this: the server order was
// changed first and the client mirror was two commits behind.

import { describe, it, expect } from 'vitest'
import { isGrantActive, initialGrantExpiry } from './grantWindow'

const NOW = new Date('2026-09-11T10:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const at = (n: number) => new Date(NOW.getTime() + n * DAY)

/** The resolution both sides implement: admin → subscription → charity grant →
 *  trial → free. Kept here as executable documentation of the contract. */
function resolve(input: {
  isAdmin?: boolean
  subStatus?: string | null
  subPeriodEnd?: Date | null
  grantExpiresAt?: Date | null
  trialStartedAt?: Date | null
}, now: Date): 'free' | 'trial' | 'paid' {
  if (input.isAdmin) return 'paid'
  if (
    input.subStatus &&
    ['trialing', 'active'].includes(input.subStatus) &&
    input.subPeriodEnd && input.subPeriodEnd > now
  ) return 'paid'
  if (isGrantActive(input.grantExpiresAt, now)) return 'paid'
  if (input.trialStartedAt && now.getTime() - input.trialStartedAt.getTime() < 14 * DAY) return 'trial'
  return 'free'
}

describe('tier resolution with a charity grant', () => {
  it('a live grant resolves as paid', () => {
    expect(resolve({ grantExpiresAt: at(30) }, NOW)).toBe('paid')
  })

  // The whole point of the feature. Without this, a comped charity runner
  // hits the marathon paywall the grant was meant to remove.
  it('a live grant beats an expired trial', () => {
    expect(resolve({ grantExpiresAt: at(30), trialStartedAt: at(-40) }, NOW)).toBe('paid')
  })

  it('an expired grant does not', () => {
    expect(resolve({ grantExpiresAt: at(-1), trialStartedAt: at(-40) }, NOW)).toBe('free')
  })

  it('no grant is unaffected — every other user takes the old path', () => {
    expect(resolve({ trialStartedAt: at(-2) }, NOW)).toBe('trial')
    expect(resolve({ trialStartedAt: at(-40) }, NOW)).toBe('free')
    expect(resolve({ subStatus: 'active', subPeriodEnd: at(30) }, NOW)).toBe('paid')
    expect(resolve({ isAdmin: true }, NOW)).toBe('paid')
  })

  // Order matters: a runner who later PAYS should be resolved by their payment,
  // not by an expiring gift. If the grant were checked first, their tier would
  // flip back to free the day the grant lapsed despite an active subscription.
  it('an active subscription is checked before the grant', () => {
    const bothLive = resolve({
      subStatus: 'active', subPeriodEnd: at(365), grantExpiresAt: at(30),
    }, NOW)
    expect(bothLive).toBe('paid')

    // And the subscription alone still carries them once the grant lapses.
    expect(resolve({
      subStatus: 'active', subPeriodEnd: at(365), grantExpiresAt: at(-1),
    }, NOW)).toBe('paid')
  })

  // THE RISK THE BOARD FLAGGED, as a test. The RevenueCat webhook upserts
  // `subscriptions` onConflict user_id. If a grant had been stored there (the
  // spec's original proposal), an EXPIRATION event would overwrite it and
  // silently revoke a comped runner's access mid-block. Because the grant lives
  // in its own table, an unrelated subscription event cannot touch it.
  it('a cancelled or expired subscription does not revoke a live grant', () => {
    for (const status of ['cancelled', 'expired']) {
      expect(resolve({
        subStatus: status, subPeriodEnd: at(-1), grantExpiresAt: at(30),
      }, NOW)).toBe('paid')
    }
  })

  it('the grant granted at redemption is live immediately', () => {
    expect(isGrantActive(initialGrantExpiry(NOW), NOW)).toBe(true)
  })
})
