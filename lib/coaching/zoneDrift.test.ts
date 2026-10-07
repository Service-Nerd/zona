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


// ──────────────────────────────────────────────────────────────────────────
// ANALYSIS-SUPERSEDE-PATTERN-01 (Coaching Board, §71 Amendment 2, 2026-10-07)
//
// ⚠️ APPENDED, NOT REPLACING. The §12 Amendment 1 arms above carry REAL
// production fixtures from 2026-09-13 — the six too-easy runs McMillan called
// the worst possible false positive, and the four genuine drifts — and they keep
// the OLD rule executable so the fix cannot silently revert. I overwrote this
// file with `cat >` while adding the arms below and destroyed all six; the test
// COUNT in the verify log is what caught it (514 files but +8 arms where +14 was
// expected). Look at the target before writing over it.
// ──────────────────────────────────────────────────────────────────────────

import {
  computeZoneDriftPattern, zoneDriftLine, countsForDrift,
  ZONE_DRIFT_MIN_ROWS, ZONE_DRIFT_WINDOW, type ZoneDriftRow,
} from './zoneDrift'

const row = (o: Partial<ZoneDriftRow> & { weekN: number }): ZoneDriftRow => ({
  sessionType: 'easy', hrAboveCeilingPct: 50, fromPreviousBlock: false, source: 'apple_health', ...o,
})

/** The founder's real shape: old-plan weeks, none of them in the current plan. */
const PREVIOUS_BLOCK = [31, 32, 33, 34].map(w =>
  row({ weekN: w, fromPreviousBlock: true, hrAboveCeilingPct: 60 }))

describe('ANALYSIS-SUPERSEDE-PATTERN-01 — drift reads across a race boundary', () => {
  it('fires on a window made ENTIRELY of a previous block', () => {
    const p = computeZoneDriftPattern(PREVIOUS_BLOCK)
    expect(p).not.toBeNull()
    expect(p!.count).toBe(4)
    expect(p!.crossesBlockBoundary).toBe(true)
  })

  it('🎯 McMillan BINDING: a crossing comparison NAMES the boundary', () => {
    const line = zoneDriftLine(computeZoneDriftPattern(PREVIOUS_BLOCK)!)
    expect(line).toContain('including your last block')
  })

  it('and does NOT name it when the window is all current-block', () => {
    const current = [1, 2, 3, 4].map(w => row({ weekN: w, hrAboveCeilingPct: 60 }))
    const line = zoneDriftLine(computeZoneDriftPattern(current)!)
    expect(line).not.toContain('last block')
  })

  it('a previous-block row that is FILTERED OUT must not add the clause', () => {
    // A quality run from the old block is excluded by §12, so it cannot make the
    // claim cross a boundary. Only the rows actually counted may.
    const rows = [
      ...[1, 2, 3, 4].map(w => row({ weekN: w, hrAboveCeilingPct: 60 })),
      row({ weekN: 30, fromPreviousBlock: true, sessionType: 'quality', hrAboveCeilingPct: 90 }),
    ]
    expect(computeZoneDriftPattern(rows)!.crossesBlockBoundary).toBe(false)
  })

  it('§12: a TEMPO above the ceiling is correct execution, never drift', () => {
    const quality = [1, 2, 3, 4, 5].map(w => row({ weekN: w, sessionType: 'quality', hrAboveCeilingPct: 95 }))
    expect(computeZoneDriftPattern(quality)).toBeNull()
    expect(countsForDrift(quality[0])).toBe(false)
  })

  it('an UNKNOWN type is excluded, never assumed easy', () => {
    // Pre-stamp rows with no current-plan week resolve to null. Counting them as
    // easy would invent drift out of tempo sessions.
    const unknown = [1, 2, 3, 4].map(w => row({ weekN: w, sessionType: null, hrAboveCeilingPct: 60 }))
    expect(computeZoneDriftPattern(unknown)).toBeNull()
  })

  it('manual runs are excluded: no HR stream to judge', () => {
    expect(countsForDrift(row({ weekN: 1, source: 'manual' }))).toBe(false)
  })

  it('below the floor it stays SILENT rather than reporting a zero pattern', () => {
    const three = [1, 2, 3].map(w => row({ weekN: w, hrAboveCeilingPct: 60 }))
    expect(three.length).toBeLessThan(ZONE_DRIFT_MIN_ROWS)
    expect(computeZoneDriftPattern(three)).toBeNull()
  })

  it('a runner who is holding the zone gets nothing', () => {
    const good = [1, 2, 3, 4, 5, 6].map(w => row({ weekN: w, hrAboveCeilingPct: 0 }))
    expect(computeZoneDriftPattern(good)).toBeNull()
  })

  it('running too EASY is not drift (the 27% false-positive McMillan killed)', () => {
    const tooEasy = [1, 2, 3, 4, 5].map(w => row({ weekN: w, hrAboveCeilingPct: 0 }))
    expect(computeZoneDriftPattern(tooEasy)).toBeNull()
  })

  it('the window is bounded and takes the MOST RECENT rows', () => {
    const many = Array.from({ length: 20 }, (_, i) => row({ weekN: i + 1, hrAboveCeilingPct: 60 }))
    const p = computeZoneDriftPattern(many)!
    expect(p.total).toBe(ZONE_DRIFT_WINDOW)
  })

  it('the threshold is the shared constant, not a local literal', () => {
    const atThreshold = [1, 2, 3, 4].map(w => row({ weekN: w, hrAboveCeilingPct: ZONE_DRIFT_ABOVE_CEILING_PCT }))
    expect(computeZoneDriftPattern(atThreshold)).toBeNull()   // strictly greater
    const above = [1, 2, 3, 4].map(w => row({ weekN: w, hrAboveCeilingPct: ZONE_DRIFT_ABOVE_CEILING_PCT + 1 }))
    expect(computeZoneDriftPattern(above)).not.toBeNull()
  })

  it('🩹 Willy BINDING: the line reports the window, it does not pass a verdict', () => {
    const line = zoneDriftLine(computeZoneDriftPattern(PREVIOUS_BLOCK)!)
    expect(line).not.toMatch(/fail|wrong|bad|months|always|never improve/i)
    expect(line).not.toContain('—')   // no em dash: a sentence the runner reads
  })
})
