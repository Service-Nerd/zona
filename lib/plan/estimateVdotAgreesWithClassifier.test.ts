import { describe, it, expect } from 'vitest'
import { GENERATION_CONFIG } from './generationConfig'
import { bracketVdotFor, estimateVdotRange } from './estimateVdot'

// INV-EST-VDOT-AGREES-WITH-CLASSIFIER — §109 Amendment 1, Coaching Board
// 2026-09-17. Artifact 3 of 3.
//
// ⚠️ NOT A `validatePlan()` INVARIANT, and the distinction is deliberate rather
// than an omission. `validatePlan` takes a Plan; this asserts that two CONFIG
// SURFACES agree with each other, and there is no plan involved at any point.
// Writing it as a plan invariant would mean it only ran when a plan happened to
// be generated, which is strictly weaker than running always.
//
// WHAT IT CAUGHT. The shipped table asserted a VDOT for each (level, training
// age) pair by hand. Six of twelve cells named a VDOT that §13's own
// `FITNESS_VDOT_THRESHOLDS` classifies as a DIFFERENT level from the one that
// selected the cell: `experienced` runners were handed 45 and 48, both below
// `experienced_min: 50`, and `beginner` runners 37, above
// `intermediate_min: 35`. Two of our own numbers disagreeing, and the one
// reaching runners was the one no principle explained.
//
// This check is total, not sampled: twelve combinations, both raw and
// discounted. It cannot go stale against a corpus because it has none.

const T = GENERATION_CONFIG.FITNESS_VDOT_THRESHOLDS
const AGES = Object.keys(GENERATION_CONFIG.ESTIMATE_VDOT_BAND_FRACTIONS) as
  (keyof typeof GENERATION_CONFIG.ESTIMATE_VDOT_BAND_FRACTIONS)[]
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const

/** §13's classifier, read from the same config the engine uses. */
function classify(vdot: number): typeof LEVELS[number] {
  if (vdot < T.intermediate_min) return 'beginner'
  if (vdot > T.experienced_min)  return 'experienced'
  return 'intermediate'
}

describe('INV-EST-VDOT-AGREES-WITH-CLASSIFIER (§109 Am.1, §13)', () => {
  it('every estimate classifies back to the level that selected it — RAW', () => {
    const offenders: string[] = []
    for (const level of LEVELS) {
      for (const age of AGES) {
        const v = bracketVdotFor(level, age)!
        if (classify(v) !== level) offenders.push(`${level}/${age}: VDOT ${v} classifies as ${classify(v)}`)
      }
    }
    expect(offenders, `the estimate contradicts §13:\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('and after the estimate discount — the discount must not move anyone across a band', () => {
    // The shipped ×0.95 pushed `experienced/2-5yr` (52) down to 49.4, BELOW
    // experienced_min. A conservatism that reclassifies the runner is not
    // conservatism, it is a different claim.
    const offenders: string[] = []
    const d = 1 - GENERATION_CONFIG.ESTIMATE_VDOT_DISCOUNT_PCT / 100
    for (const level of LEVELS) {
      for (const age of AGES) {
        const v = bracketVdotFor(level, age)! * d
        if (classify(v) !== level) offenders.push(`${level}/${age}: discounted VDOT ${v.toFixed(2)} classifies as ${classify(v)}`)
      }
    }
    expect(offenders, `the DISCOUNTED estimate contradicts §13:\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  it('training age never moves a runner across a band, only within one', () => {
    for (const level of LEVELS) {
      const vals = AGES.map(a => bracketVdotFor(level, a)!)
      expect(new Set(vals.map(classify)).size, `${level}: training age changed the level`).toBe(1)
    }
  })

  it('the estimate rises with training age, and decelerates (Seiler)', () => {
    for (const level of LEVELS) {
      const vals = AGES.map(a => bracketVdotFor(level, a)!)
      for (let i = 1; i < vals.length; i++) {
        expect(vals[i], `${level}: ${AGES[i]} must exceed ${AGES[i - 1]}`).toBeGreaterThan(vals[i - 1])
      }
      // Front-loaded: improvement in recreational runners is steepest early.
      const steps = vals.slice(1).map((v, i) => +(v - vals[i]).toFixed(3))
      expect(steps[0], `${level}: first step must be the largest (front-loaded)`).toBeGreaterThanOrEqual(steps[steps.length - 1])
    }
  })

  it('a DECLINED training age widens the estimate rather than taking the middle', () => {
    // Measured on the live database: 2 of 6 comparable plans had declined the
    // question and were shown figures IDENTICAL to the 2 who answered.
    const answered = estimateVdotRange('intermediate', '6-18mo')!
    const declined = estimateVdotRange('intermediate', undefined)!
    expect(answered.high - answered.low, 'an answered age is a point').toBeLessThan(0.05)
    expect(declined.high - declined.low, 'a declined age must widen').toBeGreaterThan(1)
    // And it must not silently BE the middle bracket.
    expect(declined.low).not.toBeCloseTo(answered.low, 1)
  })

  it('a declined answer still never leaves the runner\'s own band', () => {
    for (const level of LEVELS) {
      const r = estimateVdotRange(level, undefined)!
      expect(classify(r.low), `${level}: declined low`).toBe(level)
      expect(classify(r.high), `${level}: declined high`).toBe(level)
    }
  })

  it('the intermediate row is unchanged from what shipped — the majority path does not move', () => {
    // 58% of plans have no benchmark and 8 of 19 are intermediate. The fix is
    // confined to the two rows that were actually wrong.
    expect(AGES.map(a => bracketVdotFor('intermediate', a))).toEqual([38, 42, 45, 48])
  })
})
