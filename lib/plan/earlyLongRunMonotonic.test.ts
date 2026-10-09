import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionFloorsFor } from './sessionFloors'
import { sessionKmSelfPaced } from './sessionDistance'
import { easyPaceFromPlan } from './easyPace'
import { assessLongRunReadiness, weeksToReachFloor, minLongestRunKm } from './longRunReadiness'
import { isLongRun } from './sessionRole'
import type { GeneratorInput } from '@/types/plan'

// §10 Amendment / WIZARD-ZERO-VOLUME-REFUSAL-01 Amendment 2 — Coaching Board
// 2026-10-09.
//
// 🔴 WHAT THIS GUARDS, AND WHY IT IS A PROPERTY RATHER THAN A NUMBER. The
// defect was not a wrong value; it was a wrong ORDERING. `longest_recent_run_km`
// reached the engine through a `> 0` guard at three sites, so a DECLARED zero
// was read as "unknown" and §9/§45's week-1/2 long-run cap was skipped
// entirely. Measured before the fix, week-1 long run across the ladder:
//
//     lrr        0     1     2     3     4     5     6     8
//     5K/20/3d   8.0   2.0   2.0   3.0   4.0   5.5   6.5   8.0
//     10K/30/4d  8.5   2.0   2.0   3.0   4.0   5.5   6.5   8.5
//     HM/30/3d  12.5   2.0   2.0   3.0   4.0   5.5   6.5   8.5
//     M/60/5d    9.0   2.0   2.0   3.0   4.0   5.5   6.5   8.5
//
// Monotone at every rung except 0->1. **Declaring one kilometre instead of zero
// cut the first long run from 12.5 km to 2.0**, so the honest answer was
// punished and the most deconditioned runner got the largest opening week.
//
// ⚠️ A SINGLE-PLAN INVARIANT CANNOT SEE THIS. `validatePlan` is handed one plan
// and one input; the defect only exists in the relationship between two runners
// who differ in one field. `INV-PLAN-WEEK-1-2-LONG-CAP` is the per-plan half and
// was itself blind (it carried the same `> 0`); this file is the other half, and
// it is the half the board named as the artifact.
//
// ⚠️ AND NO STANDING HARNESS REACHES IT. `cohortGrid` and `targetedGrid` carry a
// minimum `longest_recent_run_km` of 8 — measured 0 of 37,248 rows below 5 — so
// `verify:parity`, `cohort:shape` and `measure:fitness` all report NO CHANGE on
// this work. Same blindness `subFloorAdmission.test.ts` was written against.

const START = '2026-10-12'

/** The rungs. 0 is the defect; 0.5 proves a sub-1 km declaration behaves; the
 *  rest walk out past the configured floor so the ordering is tested on both
 *  sides of it. */
const LADDER = [0, 0.5, 1, 2, 3, 4, 4.5, 5, 6, 8, 10, 14, 20] as const

interface Cohort { name: string; race: number; cwk: number; days: number; raceDate: string }

/** Four distances x volume x days. Each cohort is a column of the table above. */
const COHORTS: Cohort[] = [
  { name: '5K  / 20 km / 3 d',  race: 5,    cwk: 20, days: 3, raceDate: '2027-04-25' },
  { name: '10K / 30 km / 4 d',  race: 10,   cwk: 30, days: 4, raceDate: '2027-04-25' },
  { name: 'HM  / 30 km / 3 d',  race: 21.1, cwk: 30, days: 3, raceDate: '2027-06-20' },
  { name: 'HM  / 40 km / 5 d',  race: 21.1, cwk: 40, days: 5, raceDate: '2027-06-20' },
  { name: 'M   / 60 km / 5 d',  race: 42.2, cwk: 60, days: 5, raceDate: '2027-06-20' },
]

const runner = (c: Cohort, longestKm: number): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'Target', primary_metric: 'distance',
  plan_start: START, race_distance_km: c.race, race_date: c.raceDate, goal: 'finish',
  resting_hr: 60, max_hr: 184, current_weekly_km: c.cwk, longest_recent_run_km: longestKm,
  fitness_level: 'beginner', training_age: '<6mo', recent_quality_training: 'none',
  days_available: c.days, days_cannot_train: [], injury_history: [],
} as unknown as GeneratorInput)

/** Week N's long run, through the owner — a beginner plan is duration-anchored,
 *  so `distance_km` is null on 95.8% of their sessions (SESSION-KM-01). */
const longRunKm = (plan: any, n: number): number | null => {
  const w = plan.weeks.find((x: any) => x.n === n)
  if (!w) return null
  let m = 0
  for (const s of Object.values(w.sessions ?? {}) as any[])
    if (s && isLongRun(s)) m = Math.max(m, sessionKmSelfPaced(s) ?? 0)
  return m
}

/** null where the engine REFUSES — a refusal is not a long run, and §111/§113
 *  are allowed to refuse a rung. Comparing a refusal as 0 would manufacture an
 *  inversion at every gate boundary. */
const week1 = (c: Cohort, longestKm: number): number | null => {
  try { return longRunKm(generateRulePlan(runner(c, longestKm), 'paid', START), 1) }
  catch { return null }
}

describe('§10 Amendment — the week-1 long run is MONOTONIC in longest_recent_run_km', () => {
  it('🔴 a SMALLER declared longest run never produces a LARGER week-1 long run', () => {
    const inversions: string[] = []
    for (const c of COHORTS) {
      const seen = LADDER.map(l => [l, week1(c, l)] as const).filter(([, v]) => v !== null)
      for (let i = 1; i < seen.length; i++) {
        const [lo, a] = seen[i - 1] as [number, number]
        const [hi, b] = seen[i] as [number, number]
        if (b < a - 1e-9) inversions.push(`${c.name}: lrr ${lo} -> ${hi} gives ${a} -> ${b} km`)
      }
    }
    expect(inversions, 'declaring more may not buy an easier first week').toEqual([])
  })

  it('a declared ZERO lands on the same rung as a declared 1 km, not above it', () => {
    // The board's first amendment said a declared zero caps at
    // MIN_SESSION_DISTANCE_KM.long (5). Amendment 2 superseded it because 5 sits
    // ABOVE the 2.0 km rung §113 Am.1 ratified for a declared 1 km, so it cannot
    // be monotone. This arm is that supersession, asserted.
    for (const c of COHORTS) {
      const z = week1(c, 0)
      const one = week1(c, 1)
      if (z === null || one === null) continue
      expect(z, `${c.name}: declared zero`).toBeLessThanOrEqual(one + 1e-9)
    }
  })

  it('a declared zero still gets a REAL session — never below the absolute floor', () => {
    // The inverse failure. "Lowest state" must not collapse to nothing: a long
    // run under MIN_SESSION_DISTANCE_ABSOLUTE_KM is not a session.
    //
    // ⚠️ THE TOLERANCE IS DERIVED, NOT PICKED, and the first version of this arm
    // failed on it. A beginner plan is DURATION-anchored (SESSION-KM-01:
    // `duration_mins` set, `distance_km` null on 95.8% of their sessions), so the
    // engine floors in km, converts to WHOLE MINUTES, and `sessionKmSelfPaced`
    // converts back — which can land one minute of easy pace below the floor.
    // Measured 1.939 km against a 2.0 km floor on the 5K cohort. That is the
    // rounding, not a breach, and asserting the bare floor would have made this
    // gate red for a correct engine. The tolerance is read from the plan's own
    // pace guide so it cannot drift from what the producer used.
    const abs = GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM
    for (const c of COHORTS) {
      let plan: any
      try { plan = generateRulePlan(runner(c, 0), 'paid', START) } catch { continue }
      const z = longRunKm(plan, 1)
      if (z === null) continue
      const minPerKm = easyPaceFromPlan(plan)
      // One whole minute of easy running, in km. No pace resolved -> no
      // tolerance, which is the strict direction.
      const oneMinuteKm = minPerKm && minPerKm > 0 ? 1 / minPerKm : 0
      expect(z, `${c.name}: declared zero (floor ${abs}, one-minute tolerance ${oneMinuteKm.toFixed(3)} km)`)
        .toBeGreaterThanOrEqual(abs - oneMinuteKm - 1e-9)
      expect(z, `${c.name}: a declared zero must still get a session`).toBeGreaterThan(0)
    }
  })

  it('ABSENCE is still not a declaration — an undefined longest run keeps the configured floors', () => {
    // §113's own rule, and the `?? 0` class this repo has paid for four times.
    // `sessionFloorsFor` must treat the gap and the answer differently.
    expect(sessionFloorsFor(undefined).long).toBe(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long)
    expect(sessionFloorsFor(null).long).toBe(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long)
    expect(sessionFloorsFor(0).long).toBe(GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM)
  })
})

describe('INV-PLAN-WEEK-1-2-LONG-CAP — the checker can now SEE a declared zero', () => {
  // 🔴 The third site. Before this, the guard was the producer's own
  // `input.longest_recent_run_km > 0`, so the one invariant written to catch an
  // over-large opening long run could not fire on the cohort that got one —
  // measured capFires = 0 at every rung, including the 12.5 km week one.
  // ⚠️ THE 10K COHORT, NOT THE HM ONE. The first version of these arms used
  // HM / 30 km / 3 d because that is where the 12.5 km week one was measured —
  // and Amendment 3 now REFUSES a declared-zero half marathon, so the arms were
  // asserting against a plan that no longer exists. A checker pointed at a
  // refused cohort is the "population excludes the cases" class, arrived at from
  // the other direction: the population emptied under me.
  const cohort = COHORTS[1]   // 10K / 30 km / 4 d — generates at a declared zero
  const fires = (plan: any, input: GeneratorInput) =>
    validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-WEEK-1-2-LONG-CAP')

  it('a VALID declared-zero plan is clean', () => {
    const input = runner(cohort, 0)
    expect(fires(generateRulePlan(input, 'paid', START), input)).toEqual([])
  })

  it('🔴 and the check FIRES when a declared-zero plan is mutated past the cap', () => {
    // Falsification without reverting source: hand the validator the plan a
    // broken producer would have emitted. Pre-fix this returned [] because the
    // `> 0` guard skipped the whole block.
    const input = runner(cohort, 0)
    const plan: any = JSON.parse(JSON.stringify(generateRulePlan(input, 'paid', START)))
    const w1 = plan.weeks.find((w: any) => w.n === 1)
    for (const [day, s] of Object.entries(w1.sessions) as any[]) {
      if (s && isLongRun(s)) { w1.sessions[day] = { ...s, distance_km: 12.5, duration_mins: 100 }; break }
    }
    const v = fires(plan, input)
    expect(v.length, 'a 12.5 km week-1 long run on a declared zero must be caught').toBeGreaterThan(0)
    expect(v[0].severity).toBe('error')
  })
})

describe('§113 Amendment / WIZARD-ZERO-VOLUME-REFUSAL-01 Am.3 — the fourth copy of `> 0`', () => {
  // 🔴 THE INVERSION THE PRODUCT COULD NOT DEFEND. `assessLongRunReadiness`
  // guarded on `!(longest > 0)`, so a declared zero fell through as "nothing
  // stated" and was ADMITTED while a declared 1 km was REFUSED. Measured on
  // HM / 2 days / 10 weeks, before:
  //
  //     longest 0 -> ADMITTED, weekly [4,4,8,17,18,21,24,28,24]: +112% at week
  //                  4, the TAPER carrying the plan's largest long run (16.0 km
  //                  against a peak-phase best of 11.0), 7 warns + 1 error
  //     longest 1 -> REFUSED
  //     longest 2 -> REFUSED
  //
  // The honest answer bought the worse outcome.
  const FLOOR = minLongestRunKm()
  const hmInput = (longest: number): GeneratorInput => runner(
    { name: 'HM / 30 km / 2 d', race: 21.1, cwk: 30, days: 2, raceDate: '2026-12-20' }, longest)

  it('a declared ZERO is refused at half marathon and above, exactly as a declared 1 km is', () => {
    expect(assessLongRunReadiness(hmInput(0), 10).ok, 'declared zero, 10 weeks').toBe(false)
    expect(assessLongRunReadiness(hmInput(1), 10).ok, 'declared 1 km, 10 weeks').toBe(false)
  })

  it('and no runway rescues it, because compounding from zero never arrives', () => {
    // §113 Am.1 admits a sub-floor runner whose runway covers the ramp. A
    // declared 1 km with a long runway IS admitted; a declared zero never is,
    // and that is arithmetic rather than a threshold.
    expect(weeksToReachFloor(0, FLOOR)).toBe(Number.POSITIVE_INFINITY)
    expect(weeksToReachFloor(1, FLOOR)).toBeGreaterThan(0)
    expect(weeksToReachFloor(1, FLOOR)).toBeLessThan(Number.POSITIVE_INFINITY)
    expect(assessLongRunReadiness(hmInput(0), 200).ok, 'declared zero, 200 weeks').toBe(false)
    expect(assessLongRunReadiness(hmInput(1), 200).ok, 'declared 1 km, 200 weeks').toBe(true)
  })

  it('ABSENCE is still admitted — §113 must not turn an unanswered question into a rejection', () => {
    const absent = { ...hmInput(0) } as any
    delete absent.longest_recent_run_km
    expect(assessLongRunReadiness(absent as GeneratorInput, 10).ok).toBe(true)
  })

  it('the refusal still names what would change it (§44)', () => {
    // ⚠️ NOT the 10K door — that is marathon-only and the boundary is pinned by
    // `longRunReadiness.test.ts`. Widening it to every distance §113 governs was
    // tried in this session and BACKED OUT: the hardcoded `42` is already owned
    // by the filed item `LR-ALT-42-CONFIG-01`, and moving it edits
    // `generationConfig.ts`. What §44 requires is that a refusal names what would
    // change it, and for an HM that is the 5 km run plus the correction path.
    const r = assessLongRunReadiness(hmInput(0), 10)
    expect(r.alternatives.length, 'a refusal with no door is a wall').toBeGreaterThan(0)
    expect(r.alternatives.join(' '), 'name the thing that would change it')
      .toMatch(/Build up to one \d+ km run/)
  })

  it('and §111/§113 leave the 5K and 10K declared-zero runner alone (board part 4)', () => {
    // Neither refused nor on-ramped — the scope the board ratified. They get a
    // plan opening at the absolute floor.
    for (const c of COHORTS.filter(x => x.race <= 10)) {
      expect(week1(c, 0), `${c.name}: declared zero must still generate`).not.toBeNull()
    }
  })
})
