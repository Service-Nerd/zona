// TIER-ENFORCE-01 — the distance paywall, as a rule rather than as two screens.
//
// The boundary used to live only inside `GeneratePlanScreen` (a client
// component). `/api/generate-plan` now enforces it too, through the SAME
// predicate, so the lock a runner sees and the 403 the server returns cannot
// disagree.
//
// THE RISK THIS FILE EXISTS FOR is not a free user slipping through — that is a
// hand-crafted request against a personalised version of a plan we publish for
// free on the website anyway. It is the OPPOSITE: a paying, trialling or COMPED
// runner being refused a plan because tier resolution went wrong. Adding a 403
// to the most important route in the product is only safe if that case is
// pinned, so it is pinned first and hardest.

import { describe, it, expect } from 'vitest'
import { canGenerateDistance, isPaidDistance } from './canUseFeature'
import { PLAN_SIGNATURES } from './planSignatures'
import { resolveTier } from '@/lib/trial'
import type { UserTier } from '@/lib/trial'

const FREE_DISTANCES = [5, 10, 21.1]
const PAID_DISTANCES = [42.2, 50, 100]

describe('nobody who is entitled gets refused', () => {
  it.each(PAID_DISTANCES)('a TRIAL runner may build %s km', km => {
    expect(canGenerateDistance(km, 'trial')).toBe(true)
  })

  it.each(PAID_DISTANCES)('a PAID runner may build %s km', km => {
    expect(canGenerateDistance(km, 'paid')).toBe(true)
  })

  // The charity cohort, end to end: a redeemed code resolves to `paid` through
  // resolveTier BEFORE the trial arm is reached, so a Make-A-Wish marathon
  // runner never meets this gate. Composed deliberately rather than asserting
  // canGenerateDistance('paid') — the claim is about the whole path.
  it('a COMPED charity runner may build a marathon, even with a long-dead trial', () => {
    const now = new Date('2026-09-11T10:00:00.000Z')
    const day = 24 * 60 * 60 * 1000
    const { tier, reason } = resolveTier({
      grantExpiresAt: new Date(now.getTime() + 80 * day),
      trialStartedAt: new Date(now.getTime() - 200 * day),
    }, now)
    expect(reason).toBe('grant')
    expect(canGenerateDistance(42.2, tier)).toBe(true)
  })

  it('an ADMIN may build a marathon', () => {
    const { tier } = resolveTier({ isAdmin: true }, new Date())
    expect(canGenerateDistance(42.2, tier)).toBe(true)
  })

  it.each(FREE_DISTANCES)('a FREE runner may still build %s km', km => {
    expect(canGenerateDistance(km, 'free')).toBe(true)
  })
})

describe('the gate itself', () => {
  it.each(PAID_DISTANCES)('a FREE runner may not build %s km', km => {
    expect(canGenerateDistance(km, 'free')).toBe(false)
  })

  // The predicate must read PLAN_SIGNATURES, not restate it. A second copy of
  // the free/paid split is how the wizard and the server would drift apart,
  // which is the entire reason this moved out of the component.
  it('derives from PLAN_SIGNATURES rather than a second list', () => {
    for (const [key, sig] of Object.entries(PLAN_SIGNATURES)) {
      const km = { '5K': 5, '10K': 10, 'HM': 21.1, 'MARATHON': 42.2, '50K': 50, '100K': 100 }[key]
      if (km == null) continue
      expect(isPaidDistance(km), `${key}`).toBe(!sig.free_tier_available)
    }
  })

  // Guards the guard: if every distance were free, every assertion above about
  // refusal would pass vacuously.
  it('is comparing a real split, not an all-free table', () => {
    expect(FREE_DISTANCES.filter(isPaidDistance)).toEqual([])
    expect(PAID_DISTANCES.every(isPaidDistance)).toBe(true)
  })

  // Fail CLOSED on an unknown tier string, never open.
  it('refuses a paid distance for any tier that is not trial or paid', () => {
    for (const t of ['free', 'expired', ''] as unknown as UserTier[]) {
      expect(canGenerateDistance(42.2, t)).toBe(false)
    }
  })
})
