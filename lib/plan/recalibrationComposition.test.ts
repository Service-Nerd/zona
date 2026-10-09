import { describe, it, expect } from 'vitest'
import { generateRulePlan, applyRecalibration } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { inRecalibrationScope, writeScoped } from './recalibrationScope'
import { PINNED_PLAN_START_0907 } from './__fixtures__/pinnedPlanStart'
import type { GeneratorInput, Plan, Session, Week } from '@/types/plan'
import type { BenchmarkInput } from '@/types/plan'

/**
 * RECAL-PACE-TWO-WRITER-01 Stage 3 — THE GATE WHOSE ABSENCE LET THIS LIVE.
 *
 * 🔴 ZERO HARNESSES CALLED `applyRecalibration`. Measured 2026-10-09 across the
 * property sweep, the cohort grid and the fitness harness: not one of them ever
 * ran a recalibrated plan. `generateRulePlan` is swept over 14,268 inputs and
 * `verify:parity` diffs 6,066 — and both produce only plans that have never been
 * re-priced. So a writer that broke §120 on every recalibration sat behind a
 * green suite for as long as it existed, and `/ship`'s own pre-ship gate names
 * this class (item 3: "two subsystems compose over the same data — test the
 * COMPOSED path") with no mechanical enforcement for this pair.
 *
 * This walks the composition: generate, recalibrate, validate.
 */

const base = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2027-03-21', race_distance_km: 21.1, goal: 'finish',
  benchmark: { type: 'race', distance_km: 5, time: '0:24:00' },
  current_weekly_km: 40, longest_recent_run_km: 14, days_available: 4, age: 35,
  preferred_long_run_day: 'sun', training_age: '2-5yr',
  user_declared_level: 'intermediate', recent_quality_training: 'regular',
  terrain: 'road', injury_history: [], hard_session_relationship: 'neutral',
  ...o,
} as GeneratorInput)

const RACE_DATES: Record<number, string> = {
  5: '2027-01-10', 10: '2027-02-14', 21.1: '2027-03-21', 42.2: '2027-06-06',
}

/** Derived from the producer, never typed out. */
const GRID: GeneratorInput[] = [5, 10, 21.1, 42.2].flatMap(km =>
  [20, 40, 70].flatMap(weekly => [3, 4, 5].map(days => base({
    race_distance_km: km, race_date: RACE_DATES[km],
    current_weekly_km: weekly,
    longest_recent_run_km: Math.max(4, Math.round(weekly * 0.35)),
    days_available: days,
  }))))

/**
 * Both directions, because the residual is SYMMETRIC — an improving runner is
 * mis-sized exactly as much as a declining one, and only one of those was the
 * reported case.
 */
const BENCHMARKS: BenchmarkInput[] = ['0:21:00', '0:23:00', '0:26:00', '0:29:00']
  .map(time => ({ type: 'race', distance_km: 5, time } as BenchmarkInput))

interface Case { input: GeneratorInput; before: Plan; after: Plan; bm: BenchmarkInput }

const CASES: Case[] = (() => {
  const out: Case[] = []
  for (const input of GRID) {
    let before: Plan
    try { before = generateRulePlan(input, 'paid', PINNED_PLAN_START_0907) } catch { continue }
    for (const bm of BENCHMARKS) {
      out.push({ input, before, after: applyRecalibration(before, bm, 1), bm })
    }
  }
  return out
})()

const quality = (p: Plan): Session[] =>
  p.weeks.filter(w => w.n > 0)
    .flatMap(w => Object.values(w.sessions).filter((s): s is Session => !!s && s.type === 'quality'))

const workPaces = (s: Session): string[] =>
  (s.derived_set?.blocks ?? []).flatMap(b => b.steps)
    .filter(st => st.role === 'work' && st.pace).map(st => st.pace as string)

describe('recalibration composition — the population', () => {
  // An empty population passes every arm below.
  it('actually recalibrates a meaningful number of real plans', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(100)
    expect(quality(CASES[0].after).length).toBeGreaterThanOrEqual(1)
  })
})

const introducedBy = (cases: Case[]): Record<string, number> => {
  const out = new Map<string, number>()
  for (const c of cases) {
    const was = new Set(validatePlan(c.before, c.input).map(v => `${v.code}|${v.week}|${v.message}`))
    for (const v of validatePlan(c.after, c.input)) {
      const key = `${v.code}|${v.week}|${v.message}`
      if (!was.has(key)) out.set(v.code, (out.get(v.code) ?? 0) + 1)
    }
  }
  return Object.fromEntries(out)
}

describe('recalibration composition — the plan stays valid', () => {
  /**
   * 🔴 A DECLARED REGISTER, NOT A TOLERANCE. Same pattern as
   * `SWEEP-BASELINE-01` and the liveness baseline: the residual is named with
   * its reason and its count, so anything NEW fails the build while the known
   * item stays visible and countable. **It is not permission.** Filed as
   * `RECAL-DISTANCE-REPS-01` and routed to the Coaching Board.
   *
   * The residual is §125's own clauses contradicting each other on a
   * DISTANCE-ANCHORED REP ROW: clause 1 fixes the work-minute dose, clause 2
   * re-derives every pace, and 6 × 1600 m run slower takes longer — so the
   * session's true duration moves while `duration_mins` does not, and §8's
   * coherence check correctly says so.
   *
   * ⚠️ LEAVING THOSE ROWS STALE WAS MEASURED AND IS WORSE: it trips §125's own
   * `INV-PLAN-STEP-PACE-FROM-GUIDE` at EVERY magnitude (24–51 per 36 plans)
   * instead of §8's at the large ones only. Both options breach something; this
   * is the smaller and the more honest, and the alternative is on the record so
   * nobody re-proposes it as the obvious fix.
   */
  const RESIDUAL = { 'INV-PLAN-STRUCTURED-SESSION-DURATION-COHERENT': 33 }

  it('introduces nothing beyond the one declared, routed residual', () => {
    expect(introducedBy(CASES)).toEqual(RESIDUAL)
  })

  /**
   * ⚠️ THE STRONGER ARM, AND THE REASON CLAUSE 3 IS DEFERRED. At the ±4–8%
   * magnitudes that are the common case the fix introduces NOTHING AT ALL —
   * which is exactly what re-deriving the distance (§125 clause 3) would have
   * broken: measured 10–13 new `INV-PLAN-DELIVERED-RAMP` breaches per 36 plans
   * in this same band. A fix that breaches a load rule at the common magnitude
   * is not a fix.
   */
  it('introduces NOTHING at the common magnitudes', () => {
    const modest = CASES.filter(c => c.bm.time === '0:23:00' || c.bm.time === '0:26:00')
    expect(modest.length).toBeGreaterThanOrEqual(50)
    expect(introducedBy(modest)).toEqual({})
  })

  /** A recalibration to the benchmark the runner already had must be a no-op. */
  it('is IDEMPOTENT — the same benchmark yields a byte-identical plan', () => {
    let checked = 0
    for (const input of GRID) {
      let before: Plan
      try { before = generateRulePlan(input, 'paid', PINNED_PLAN_START_0907) } catch { continue }
      const same = input.benchmark as BenchmarkInput
      const after = applyRecalibration(before, same, 1)
      expect(JSON.stringify(after.weeks)).toBe(JSON.stringify(before.weeks))
      checked++
    }
    expect(checked).toBeGreaterThanOrEqual(30)
  })
})

describe('recalibration composition — §125', () => {
  it('clause 1 — the DOSE is untouched on every session', () => {
    const moved: string[] = []
    for (const c of CASES) {
      for (const w of c.before.weeks) {
        if (w.n < 1) continue
        const aw = c.after.weeks.find(x => x.n === w.n) as Week | undefined
        for (const [day, s] of Object.entries(w.sessions)) {
          const a = aw?.sessions?.[day as keyof Week['sessions']]
          if (!s || !a) continue
          if (s.duration_mins !== a.duration_mins) {
            moved.push(`${s.label}: ${s.duration_mins} -> ${a.duration_mins}`)
          }
        }
      }
    }
    expect(Array.from(new Set(moved))).toEqual([])
  })

  it('clause 2 — no work step keeps a pace the OLD fitness produced', () => {
    const stale: string[] = []
    for (const c of CASES) {
      const beforeQ = quality(c.before)
      quality(c.after).forEach((a, i) => {
        const b = beforeQ[i]
        if (!b) return
        const bp = workPaces(b), ap = workPaces(a)
        // Identical step paces after a benchmark change means nothing was
        // re-derived. A legitimately unchanged step is possible (an anchor the
        // guide no longer produces), so this is asserted on the SESSION SET, not
        // every session: if every session is identical, the writer is inert.
        if (bp.length && JSON.stringify(bp) === JSON.stringify(ap)) stale.push(`${a.label}`)
      })
    }
    // Not zero — some sessions legitimately hold. But not ALL of them.
    expect(stale.length).toBeLessThan(CASES.length * quality(CASES[0].after).length)
  })

  it('clause 2 — the variant never changes (re-derivation, not re-selection)', () => {
    const reselected: string[] = []
    for (const c of CASES) {
      const beforeQ = quality(c.before)
      quality(c.after).forEach((a, i) => {
        const b = beforeQ[i]
        if (!b) return
        const shape = (s: Session) => JSON.stringify(
          (s.derived_set?.blocks ?? []).map(bl => ({ repeat: bl.repeat, lengths: bl.steps.map(st => st.length) })),
        )
        if (b.catalogue_id !== a.catalogue_id || shape(b) !== shape(a)) {
          reselected.push(`${b.label} -> ${a.label}`)
        }
      })
    }
    expect(Array.from(new Set(reselected))).toEqual([])
  })

  it('weeks BEFORE the recalibration point are untouched', () => {
    const from = 4
    for (const input of GRID.slice(0, 6)) {
      let before: Plan
      try { before = generateRulePlan(input, 'paid', PINNED_PLAN_START_0907) } catch { continue }
      const after = applyRecalibration(before, BENCHMARKS[0], from)
      for (const w of before.weeks.filter(w => w.n > 0 && w.n < from)) {
        const aw = after.weeks.find(x => x.n === w.n)
        expect(JSON.stringify(aw?.sessions)).toBe(JSON.stringify(w.sessions))
      }
    }
  })
})

describe('recalibration scope — the declared list is the authority', () => {
  it('declares every field the code writes, and nothing it does not', () => {
    const s = GENERATION_CONFIG.RECALIBRATION_SCOPE
    // Both directions. A field here that nothing writes is a promise nothing
    // keeps; a field written and not here is the defect this item fixed.
    expect(inRecalibrationScope('structured', 'distance_km')).toBe(true)
    expect(inRecalibrationScope('structured', 'pace_target')).toBe(true)
    expect(inRecalibrationScope('session', 'pace_target')).toBe(true)
    expect(inRecalibrationScope('derived_step', 'pace')).toBe(true)
    expect(inRecalibrationScope('meta', 'benchmark')).toBe(true)
    // ⚠️ THE DOSE. Willy's binding amendment: adding this is a board question.
    expect(inRecalibrationScope('structured', 'duration_mins')).toBe(false)
    expect(s.session_fields).not.toContain('duration_mins')
    // An easy session may not take a structured-only field.
    expect(inRecalibrationScope('session', 'distance_km')).toBe(false)
  })

  it('FALSIFICATION — an undeclared write throws outside production', () => {
    expect(() => writeScoped({} as object, 'structured', 'duration_mins', 1)).toThrow(/§125 does not declare/)
    expect(() => writeScoped({} as object, 'session', 'label', 'x')).toThrow(/does not declare/)
  })
})
