// CAT-10K-RACE-SPECIFIC-01 — how many race-specific rows can each distance
// actually reach in its peak?
//
// §93 provisions a time-targeted peak with SEVERAL race-specific slots. §22's
// CD-18 amendment requires a distance whose race pace is physiologically
// distinct from I-pace to OWN a race-specific row. Neither says how many, and
// for months 10K owned exactly one — so 100% of 96 measured 10K time-target
// plans placed it twice and no plan saw two different race-specific sessions.
//
// WHAT THIS IS AND IS NOT. It is not a rule that a distance must own N rows:
// that would be a content target masquerading as a principle. It is a REGISTER,
// in the same shape as SWEEP-BASELINE-01 — it records today's depth, so a
// distance that gets thinner fails, and a known gap is tracked in the open
// rather than rediscovered by measuring plans six months from now.

import { describe, it, expect } from 'vitest'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { GENERATION_CONFIG } from './generationConfig'

const peakRaceSpecificFor = (distance: string) =>
  V1_SESSION_CATALOGUE.filter(r =>
    r.category === 'race_specific'
    && (r.distance_eligibility as readonly string[]).includes(distance)
    && (r.phase_eligibility as readonly string[]).includes('peak'))

/**
 * Peak-eligible race_specific rows per distance, as of 2026-09-11.
 *
 * A distance may only get DEEPER. Thinning one means a runner's peak repeats
 * itself, which is what this exists to stop happening silently.
 */
const DEPTH_REGISTER: Record<string, number> = {
  // MEASURED, not assumed. A first draft of this register guessed 1 for 5K, 50K
  // and 100K and the test rejected all three — they have NONE. Worth leaving in
  // the record: the register is only worth having if it records what is there.
  '5K':       0,  // EXEMPT by §22 — 5K race pace and I-pace largely coincide, so
                  // the vo2max rows already deliver race-specific physiology.
                  // `goal_pace_sharpener` covers 5K but is taper-only. Not a gap.
  '10K':      2,  // tenk_pace_intervals + tenk_race_simulation (added 2026-09-11)
  'HM':       2,  // hm_pace_intervals + hm_pace_long_run
  'MARATHON': 1,  // ⚠️ KNOWN GAP — mp_long_run only. The identical thinness 10K
                  // had, found by the same scan, at the distance the charity
                  // referral channel sends us. NOT fixed here: a marathon
                  // race-specific row is its own board sitting, and shipping one
                  // as a by-product of a 10K ruling is how unreviewed
                  // prescription gets in. Tracked by CAT-DEPTH-01.
  '50K':      0,  // ultra_specific rows carry the specificity at these distances
  '100K':     0,  // (ultra_race_sim, back_to_back_long, time_on_feet); race pace
                  // sits at long-run pace, so §22's "distinct from I-pace" test
                  // does not select them either.
}


describe('race-specific catalogue depth per distance', () => {
  it('finds rows at all (guards the guard)', () => {
    expect(V1_SESSION_CATALOGUE.filter(r => r.category === 'race_specific').length)
      .toBeGreaterThan(3)
  })

  it.each(Object.entries(DEPTH_REGISTER))(
    '%s has at least the recorded number of peak-eligible race-specific rows',
    (distance, expected) => {
      const actual = peakRaceSpecificFor(distance).length
      expect(
        actual,
        `${distance} now has ${actual} peak-eligible race_specific row(s); the register says ${expected}.\n` +
        `  If you ADDED one, raise the number here — depth is allowed to grow.\n` +
        `  If you REMOVED one, that thins a runner's peak into a repeat. Was that ruled on?`,
      ).toBeGreaterThanOrEqual(expected)
    },
  )

  it('covers every distance the engine knows about', () => {
    // A distance absent from the register would have no depth floor at all,
    // which is how 10K's single row went unnoticed for months.
    const known = Object.keys(GENERATION_CONFIG.INTENSITY_DISTRIBUTION)
    expect(Object.keys(DEPTH_REGISTER).sort()).toEqual(known.sort())
  })
})
