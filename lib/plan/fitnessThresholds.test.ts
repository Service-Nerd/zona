import { describe, it, expect } from 'vitest'
import { fitnessFromVdot, fitnessFromVolume, assessFitness, FITNESS_RANK } from './fitnessAssessment'
import { GENERATION_CONFIG } from './generationConfig'

/**
 * §13 — the three fitness levels and their thresholds.
 *
 * §13's DERIVATION rule was superseded by §79 (dual-signal) in 2026-08-06's
 * GEN-FIX-07/D2. What §13 still owns, and what nothing asserted, is the
 * definition: three levels, and the VDOT and volume boundaries that separate
 * them. That is the half worth pinning — the §79 combination rule is already
 * covered by `userDeclaredLevel.test.ts` and `INV-PLAN-USER-LEVEL-NO-UPWARD-
 * TONNAGE`, and neither of them touches where a boundary actually falls.
 *
 * Boundaries are read from config, never retyped, so a Coaching Board change to
 * `FITNESS_VDOT_THRESHOLDS` moves the test with the rule rather than against it.
 * What the test fixes is the SHAPE: which side of each boundary each level sits,
 * and that volume's two signals are OR-ed downward and AND-ed upward.
 */
const V = GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS
const K = GENERATION_CONFIG.FITNESS_VOLUME_THRESHOLDS

describe('§13 — fitness levels by VDOT', () => {
  it('below intermediate_min is a beginner, at it is not', () => {
    expect(fitnessFromVdot(V.intermediate_min - 0.1)).toBe('beginner')
    expect(fitnessFromVdot(V.intermediate_min)).toBe('intermediate')
  })

  it('experienced_min is INCLUSIVE of intermediate — you must clear it', () => {
    // The off-by-one that matters: `<=` means a VDOT of exactly 50 reads
    // intermediate, not experienced. Asserted so a later `<` is a visible change.
    expect(fitnessFromVdot(V.experienced_min)).toBe('intermediate')
    expect(fitnessFromVdot(V.experienced_min + 0.1)).toBe('experienced')
  })

  it('the three levels are ordered', () => {
    expect(FITNESS_RANK.beginner).toBeLessThan(FITNESS_RANK.intermediate)
    expect(FITNESS_RANK.intermediate).toBeLessThan(FITNESS_RANK.experienced)
  })
})

describe('§13 — fitness levels by volume', () => {
  it('EITHER weekly volume OR longest run below its floor reads beginner', () => {
    // OR, deliberately: a runner covering 60 km/week whose longest is 5 km has
    // not built the single-session durability the long run demands.
    expect(fitnessFromVolume(K.beginner_max_weekly_km - 1, K.experienced_min_long_km)).toBe('beginner')
    expect(fitnessFromVolume(K.experienced_min_weekly_km, K.beginner_max_long_km - 1)).toBe('beginner')
  })

  it('BOTH must clear their ceilings to read experienced', () => {
    expect(fitnessFromVolume(K.experienced_min_weekly_km, K.experienced_min_long_km)).toBe('experienced')
    expect(fitnessFromVolume(K.experienced_min_weekly_km - 1, K.experienced_min_long_km)).toBe('intermediate')
    expect(fitnessFromVolume(K.experienced_min_weekly_km, K.experienced_min_long_km - 1)).toBe('intermediate')
  })

  it('the band between the two is intermediate', () => {
    expect(fitnessFromVolume(K.beginner_max_weekly_km, K.beginner_max_long_km)).toBe('intermediate')
  })
})

describe('§13 + §79 — the two signals, when they disagree', () => {
  it('with no VDOT, volume alone decides and the signals cannot disagree', () => {
    const a = assessFitness(K.beginner_max_weekly_km - 1, K.beginner_max_long_km - 1)
    expect(a.structural).toBe('beginner')
    expect(a.intensity).toBe('beginner')
    expect(a.signalsDisagree).toBe(false)
  })

  it('structure takes the LOWER signal and intensity the higher (§79)', () => {
    // The 30 km/week runner with one slow 5K — the exact misclassification
    // §13's superseding note records. Structure stays cautious; intensity does not.
    const a = assessFitness(30, 12, V.intermediate_min - 5)
    expect(a.structural).toBe('beginner')
    expect(a.intensity).toBe('intermediate')
    expect(a.signalsDisagree).toBe(true)
  })
})
