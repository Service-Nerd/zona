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
import { ZONE_DRIFT_ABOVE_CEILING_PCT, ZONE_DRIFT_ELIGIBLE_SESSION_TYPES } from './constants'

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
  isDriftEligibleType, driftRowsFromActivities,
  ZONE_DRIFT_MIN_ROWS, ZONE_DRIFT_WINDOW,
  type ZoneDriftRow, type DriftActivity, type DayPrescription,
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

// ── §12 AMENDMENT 5 — THE PRESCRIBED DAY, NOT THE MATCH ─────────────────────
//
// ⚠️ `validatePlan()` CANNOT CHECK THIS. It reads a plan; this rule reads a RUN
// against a plan, so there is no plan-only predicate to assert. Same reasoning
// §12 Am. 3 and Am. 4 recorded for `zoneTrace` and `completionCopy`.
//
// 📐 The numbers these arms defend, measured 2026-11-11 against production:
// 419 activities across 24 runners carry `hr_above_ceiling_pct`; the detector
// reached 77 across 3. Of the 419, 34 have no live plan and 353 fall outside
// every live plan week, leaving 27 eligible — 4 already analysed, 23 new. The
// note goes from silent for 5 of 5 runners with eligible runs to firing for 3.
describe('§12 Am. 5 — an unmatched run on an easy-prescribed day still counts', () => {
  const EASY: DayPrescription = { weekN: 4, sessionType: 'easy' }
  const act = (over: Partial<DriftActivity> = {}): DriftActivity => ({
    startDate: '2026-11-03T07:00:00Z',
    hrAboveCeilingPct: 44,
    source: 'apple_health',
    alreadyAnalysed: false,
    ...over,
  })
  const always = (p: DayPrescription | null) => () => p

  it('counts a run the matcher refused, because the DAY was prescribed easy', () => {
    const rows = driftRowsFromActivities([act()], always(EASY))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ weekN: 4, sessionType: 'easy', hrAboveCeilingPct: 44 })
  })

  it('never double-counts an activity a live analysis already speaks for', () => {
    expect(driftRowsFromActivities([act({ alreadyAnalysed: true })], always(EASY))).toEqual([])
  })

  it('is silent on a day the plan prescribed quality — above Z2 there is COMPLIANCE', () => {
    expect(driftRowsFromActivities([act()], always({ weekN: 4, sessionType: 'quality' }))).toEqual([])
  })

  it('is silent on a day outside the live plan, where there is no prescription to borrow', () => {
    expect(driftRowsFromActivities([act()], always(null))).toEqual([])
  })

  it('excludes a manual row and a run with no heart-rate stream', () => {
    expect(driftRowsFromActivities([act({ source: 'manual' })], always(EASY))).toEqual([])
    expect(driftRowsFromActivities([act({ hrAboveCeilingPct: null })], always(EASY))).toEqual([])
  })

  it('reads the day from the ACTIVITY, so the resolver is asked about the run it is judging', () => {
    const asked: string[] = []
    driftRowsFromActivities([act({ startDate: '2026-11-05T18:30:00Z' })], d => {
      asked.push(d.toISOString())
      return EASY
    })
    expect(asked).toEqual(['2026-11-05T18:30:00.000Z'])
  })

  it('never claims a cross-block reach it does not have', () => {
    // §71 Am. 1's boundary clause belongs to the analysis rows. The resolver
    // returns null outside the live plan, so these rows are always in-block —
    // and a false `true` here would add ", including your last block" to the
    // runner's sentence on evidence that cannot support it.
    expect(driftRowsFromActivities([act()], always(EASY))[0].fromPreviousBlock).toBe(false)
  })

  it('COMPOSES: the new rows reach the pattern and the floor still holds', () => {
    const four = [0, 1, 2, 3].map(i => act({ startDate: `2026-11-0${i + 1}T07:00:00Z` }))
    const rows = driftRowsFromActivities(four, always(EASY))
    expect(rows).toHaveLength(4)
    const p = computeZoneDriftPattern(rows)
    expect(p).toMatchObject({ count: 4, total: 4, crossesBlockBoundary: false })
    // Three is a bad fortnight, not a pattern: the floor is a SILENCE rule.
    expect(computeZoneDriftPattern(rows.slice(0, 3))).toBeNull()
  })

  it('the eligible-type set is the ONE owner, shared with countsForDrift', () => {
    for (const t of ZONE_DRIFT_ELIGIBLE_SESSION_TYPES) {
      expect(isDriftEligibleType(t)).toBe(true)
      expect(countsForDrift({ weekN: 1, sessionType: t, hrAboveCeilingPct: 44, fromPreviousBlock: false })).toBe(true)
      expect(driftRowsFromActivities([act()], always({ weekN: 1, sessionType: t }))).toHaveLength(1)
    }
    expect(isDriftEligibleType(null)).toBe(false)
    expect(isDriftEligibleType('long')).toBe(false)   // §12 Am. 5 declined to extend it
  })
})

// ── ZONE-DRIFT-WEEK-COLLISION-01 — the live block must never lose the window ──
//
// 🔴 Found by code review of §12 Am. 5, and it is a defect in the PRE-EXISTING sort:
// `b.weekN - a.weekN` treats a week number as a time axis, and old plans REUSE week
// numbers (`PLAN-WEEK-COLLISION-01`). The founder's hidden rows are weeks 15-35, so a
// block he had left outranked the live one and consumed all 8 slots.
//
// ⚠️ It restores §71 Am. 1's stated intent: the previous block EXTENDS the window when
// the live block has too few rows. It was never meant to displace it.
describe('ZONE-DRIFT-WEEK-COLLISION-01 — a finished block extends the window, never displaces it', () => {
  const clean = (weekN: number): ZoneDriftRow =>
    ({ weekN, sessionType: 'easy', hrAboveCeilingPct: 2, fromPreviousBlock: true, source: 'strava' })
  const drifted = (weekN: number): ZoneDriftRow =>
    ({ weekN, sessionType: 'easy', hrAboveCeilingPct: 55, fromPreviousBlock: false, source: 'strava' })

  it('still speaks when a HIGHER-numbered finished block would have filled the window', () => {
    const live = [1, 2, 3, 4].map(() => drifted(4))
    const old  = [28, 29, 30, 31, 32, 33, 34, 35].map(clean)
    // The whole defect in one assertion: 4 live drifted runs, 8 clean rows from a plan
    // the runner has left. Under the old sort this was null — total silence. Now the live
    // four take the front of the window and the finished block fills the rest, so the
    // sentence reads "4 of your last 8 ... including your last block": both halves true.
    expect(computeZoneDriftPattern([...live, ...old])).toMatchObject({ count: 4, total: 8, crossesBlockBoundary: true })
  })

  it('still lets the finished block EXTEND a thin live block, which is §71 Am. 1', () => {
    const p = computeZoneDriftPattern([drifted(2), drifted(3), ...[20, 21, 22].map(w => ({ ...clean(w), hrAboveCeilingPct: 55 }))])
    expect(p).toMatchObject({ count: 5, total: 5, crossesBlockBoundary: true })
  })

  it('orders by week number WITHIN a block, where only one plan is in play', () => {
    const rows: ZoneDriftRow[] = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(w => ({ ...drifted(w), hrAboveCeilingPct: w === 1 ? 2 : 55 }))
    // Nine live rows, the OLDEST of them clean: the window drops week 1, not week 9.
    expect(computeZoneDriftPattern(rows)).toMatchObject({ count: 8, total: 8 })
  })
})

// ── §12 Am. 5, code-review round: THE LONG RUN WAS NEVER ACTUALLY EXCLUDED ──
//
// 🔴 The amendment's own text says *"the board did not extend it, deliberately"* about the
// long run. **Nothing excluded it.** A generated long run carries `type: 'easy'` with
// `role: 'long_run'`, and `run_analysis.session_type` is stamped straight from
// `session.type`, so `'easy'` matched it on BOTH paths. 📐 Measured across stored plans:
// **537 of 2,054 `easy`-typed sessions (26.1%) are long runs.**
//
// ⚠️ IT WAS WRONG ON THE SHIPPED ANALYSIS PATH BEFORE THIS AMENDMENT EXISTED. The
// amendment did not introduce it; the amendment's DOC asserted it was handled when it was
// not, which is a false record rather than a mis-measurement.
describe('§12 Am. 5 — a long run is not an easy session for this rule', () => {
  const easyRow = (over: Partial<ZoneDriftRow> = {}): ZoneDriftRow =>
    ({ weekN: 3, sessionType: 'easy', hrAboveCeilingPct: 55, fromPreviousBlock: false, ...over })

  it('EXCLUDES an analysis row flagged as a long run, though its type says easy', () => {
    expect(countsForDrift(easyRow({ isLongRun: true }))).toBe(false)
    // The type alone still reads eligible — which is exactly why the flag is needed.
    expect(isDriftEligibleType('easy')).toBe(true)
  })

  it('still counts an ordinary easy run', () => {
    expect(countsForDrift(easyRow())).toBe(true)
    expect(countsForDrift(easyRow({ isLongRun: false }))).toBe(true)
  })

  it('EXCLUDES a prescribed long-run day on the unmatched path', () => {
    const act = {
      startDate: '2026-11-03T07:00:00Z', hrAboveCeilingPct: 55,
      source: 'apple_health', alreadyAnalysed: false,
    }
    expect(driftRowsFromActivities([act], () =>
      ({ weekN: 3, sessionType: 'easy', isLongRun: true }))).toEqual([])
    // and the same day without the flag still counts, so the arm is not vacuous
    expect(driftRowsFromActivities([act], () =>
      ({ weekN: 3, sessionType: 'easy', isLongRun: false }))).toHaveLength(1)
  })

  it('stamps isLongRun: false on the rows it does emit, never leaves it absent', () => {
    const rows = driftRowsFromActivities(
      [{ startDate: '2026-11-03T07:00:00Z', hrAboveCeilingPct: 55, source: 'strava', alreadyAnalysed: false }],
      () => ({ weekN: 3, sessionType: 'easy' }),
    )
    expect(rows[0].isLongRun).toBe(false)
  })

  it('a long run never reaches the pattern, even four of them', () => {
    const four = [0, 1, 2, 3].map(i => ({
      startDate: `2026-11-0${i + 1}T07:00:00Z`, hrAboveCeilingPct: 55,
      source: 'strava', alreadyAnalysed: false,
    }))
    expect(computeZoneDriftPattern(
      driftRowsFromActivities(four, () => ({ weekN: 3, sessionType: 'easy', isLongRun: true })),
    )).toBeNull()
  })
})
