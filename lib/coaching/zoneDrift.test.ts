// §12 Amendment 1 / R30-DIRECTIONAL-01 — zone drift has a direction.
//
// The shipped R30 detector (PAID, 2026-05-04) fired on `hr_in_zone_pct < 60`.
// That is a BAND. §12 prescribes a CAP — "Easy runs are capped at the top of
// Z2" — so running BELOW Z2 breaks no principle and must not be counted.
//
// Measured in production 2026-09-13: **6 of 22 flagged runs (27%) were
// predominantly too EASY**, the worst at 17% in zone with 83% below the floor
// and 0% above the ceiling. The Coaching Board ruled the shipped detector
// INCORRECT, unanimously.
//
// McMillan's objection is the one worth encoding: those six runs belong to the
// runner who has finally understood the product, and the app was flagging them.
//
// The fixtures below are the REAL production above-ceiling values, so a
// regression here is a regression against observed data rather than invented
// numbers.
import { describe, it, expect } from 'vitest'
import { ZONE_DRIFT_ABOVE_CEILING_PCT } from './constants'

/** The rule as shipped, kept executable so the fix cannot silently revert. */
const oldRuleFlags = (r: Row) => r.inZone < 60
/** The rule as ruled. */
const newRuleFlags = (r: Row) => r.above > ZONE_DRIFT_ABOVE_CEILING_PCT

type Row = { inZone: number; above: number; below: number }

// Production rows, 2026-09-13, that the OLD rule flagged (in-zone < 60).
// Split by which direction actually dominated.
const FLAGGED_TOO_EASY: Row[] = [
  { inZone: 17.36, above: 0,     below: 82.64 },  // the worst: 0% above the ceiling
  { inZone: 47.48, above: 1.82,  below: 50.70 },
  { inZone: 51.83, above: 0,     below: 48.17 },
  { inZone: 52.48, above: 0.82,  below: 46.69 },
  { inZone: 55.00, above: 3.00,  below: 42.00 },
  { inZone: 50.00, above: 18.75, below: 31.25 },  // closest to the line, still too easy
]

const FLAGGED_TOO_HARD: Row[] = [
  { inZone: 55, above: 23, below: 22 },           // the lowest genuine drift observed
  { inZone: 40, above: 40, below: 20 },
  { inZone: 30, above: 65, below: 5 },
  { inZone: 5,  above: 94, below: 1 },
]

describe('§12 Amendment 1 — drift is measured above the ceiling, not outside a band', () => {
  it('the OLD rule flagged every one of the too-easy runs (the defect)', () => {
    // Falsification of the fix: if this stops being true the fixtures have
    // drifted from the defect they were captured to describe.
    for (const r of FLAGGED_TOO_EASY) {
      expect(oldRuleFlags(r), `in-zone ${r.inZone}% was flagged by the old rule`).toBe(true)
    }
  })

  it('the NEW rule flags none of them', () => {
    for (const r of FLAGGED_TOO_EASY) {
      expect(
        newRuleFlags(r),
        `in-zone ${r.inZone}% with only ${r.above}% above the ceiling is not drift`,
      ).toBe(false)
    }
  })

  it('a run with ZERO time above the ceiling can never be drift', () => {
    // The clearest statement of the principle. 83% below the floor is a runner
    // jogging gently; under §12's cap that breaks nothing at all.
    const gentle = { inZone: 17.36, above: 0, below: 82.64 }
    expect(oldRuleFlags(gentle), 'the old rule called this drift').toBe(true)
    expect(newRuleFlags(gentle), 'it is not').toBe(false)
  })

  it('genuine drift is still caught', () => {
    for (const r of FLAGGED_TOO_HARD) {
      expect(newRuleFlags(r), `${r.above}% above the ceiling is drift`).toBe(true)
    }
  })

  it('the threshold sits inside the observed gap, not on a value', () => {
    // Production separated cleanly with NO overlap:
    //   too-easy  0, 0, 1, 2, 3, 19  % above ceiling
    //   too-hard 23, 40, 47 … 94     % above ceiling
    // A threshold on either edge would be a coin-flip on the next sample; one
    // inside the gap is robust to both. This guards the choice, not the number.
    const worstTooEasy = Math.max(...FLAGGED_TOO_EASY.map(r => r.above))   // 18.75
    const mildestTooHard = Math.min(...FLAGGED_TOO_HARD.map(r => r.above)) // 23
    expect(ZONE_DRIFT_ABOVE_CEILING_PCT).toBeGreaterThan(worstTooEasy)
    expect(ZONE_DRIFT_ABOVE_CEILING_PCT).toBeLessThan(mildestTooHard)
  })

  it('catches drift the old rule MISSED — the second half of the defect', () => {
    // A run mostly in zone but with a quarter of it above the ceiling. The old
    // rule saw 65% in zone and said nothing; a quarter of an easy run spent
    // above its cap is exactly what §1 exists to name.
    const sneaky = { inZone: 65, above: 26, below: 9 }
    expect(oldRuleFlags(sneaky), 'the old rule let this through').toBe(false)
    expect(newRuleFlags(sneaky), 'the new rule does not').toBe(true)
  })
})
