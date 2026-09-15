import { describe, it, expect } from 'vitest'
import { FEATURE_GATES, type GatedFeature } from './featureGates'
import { canUseFeature, isFeatureAllowed } from './canUseFeature'
import type { UserTier } from '@/lib/trial'

/**
 * §15 — Option A tier semantics: granted-at-trial, retained-in-free.
 *
 * "What a user gets during their 14-day trial is theirs to keep within the free
 * tier, for the plan they generated. Ongoing intelligence becomes paid-only at
 * downgrade." That is the commercial line the whole brand promise rests on
 * ("free users are never abandoned"), and `canUseFeature` is where it is
 * actually enforced — with, until now, no test of its own. `distancePaywall.
 * test.ts` lives in the same module and tests a different gate entirely.
 *
 * Not an invariant: §15 governs ACCESS, not plan shape. `validatePlan` receives
 * a plan and an input and never sees a tier, so it is structurally unable to
 * assert this.
 */
const TIERS: UserTier[] = ['free', 'trial', 'paid']
const list = (k: keyof typeof FEATURE_GATES) => FEATURE_GATES[k] as readonly string[]

describe('§15 — the three buckets are three buckets', () => {
  it('no feature appears in two of them (D-08: one concern, one owner)', () => {
    const seen = new Map<string, string>()
    const dupes: string[] = []
    for (const k of ['GRANTED_AT_TRIAL_RETAINED_IN_FREE', 'PAID_ONLY_ONGOING', 'FREE_ALWAYS'] as const) {
      for (const f of list(k)) {
        const prev = seen.get(f)
        if (prev) dupes.push(`${f} is in both ${prev} and ${k}`)
        else seen.set(f, k)
      }
    }
    // A name in two buckets resolves by declaration ORDER inside canUseFeature,
    // which is an accident, not a decision.
    expect(dupes).toEqual([])
  })

  it('every bucket has members — an empty one is a silently deleted tier line', () => {
    expect(list('FREE_ALWAYS').length).toBeGreaterThan(0)
    expect(list('GRANTED_AT_TRIAL_RETAINED_IN_FREE').length).toBeGreaterThan(0)
    expect(list('PAID_ONLY_ONGOING').length).toBeGreaterThan(0)
  })
})

describe('§15 — retained-in-free is the half that gets forgotten', () => {
  it('a downgraded user keeps EVERY granted-at-trial feature', () => {
    // This is the clause that makes "free users are never abandoned" true.
    // If one of these ever resolves paid_required on `free`, the trial has
    // become a rental.
    for (const f of list('GRANTED_AT_TRIAL_RETAINED_IN_FREE')) {
      const r = canUseFeature(f as GatedFeature, 'free')
      expect(r.allowed, `${f} was stripped from a downgraded user`).toBe(true)
      expect(r.reason).toBe('granted_at_trial_retained')
    }
  })

  it('free-always features are free on every tier', () => {
    for (const f of list('FREE_ALWAYS')) {
      for (const t of TIERS) {
        expect(isFeatureAllowed(f as GatedFeature, t), `${f} on ${t}`).toBe(true)
      }
    }
    expect(canUseFeature(list('FREE_ALWAYS')[0] as GatedFeature, 'free').reason).toBe('free_always')
  })
})

describe('§15 — ongoing intelligence is what the subscription buys', () => {
  it('paid-only features are refused on free and allowed on trial and paid', () => {
    for (const f of list('PAID_ONLY_ONGOING')) {
      expect(canUseFeature(f as GatedFeature, 'free'),  `${f} leaked to free`).toEqual({ allowed: false, reason: 'paid_required' })
      expect(canUseFeature(f as GatedFeature, 'trial'), `${f} on trial`).toEqual({ allowed: true, reason: 'trial_active' })
      expect(canUseFeature(f as GatedFeature, 'paid'),  `${f} on paid`).toEqual({ allowed: true, reason: 'paid_active' })
    }
  })

  it('the trial is FULL access — nothing is withheld from it', () => {
    const everything = [...list('FREE_ALWAYS'), ...list('GRANTED_AT_TRIAL_RETAINED_IN_FREE'), ...list('PAID_ONLY_ONGOING')]
    for (const f of everything) {
      expect(isFeatureAllowed(f as GatedFeature, 'trial'), `${f} withheld during the trial`).toBe(true)
    }
  })
})

describe('§15 — an unknown gate fails CLOSED', () => {
  it('refuses a name no bucket declares', () => {
    // The API route is the auth boundary (ADR-003). A typo'd gate string must
    // not read as free access.
    expect(canUseFeature('not_a_real_gate' as GatedFeature, 'free'))
      .toEqual({ allowed: false, reason: 'paid_required' })
    expect(isFeatureAllowed('not_a_real_gate' as GatedFeature, 'paid')).toBe(false)
  })
})
