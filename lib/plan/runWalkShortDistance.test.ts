// §117 Amendment 8 — SHORTDIST-RUNWALK-SCOPE-01 (Coaching Board 2026-11-12).
//
// 🔴 WHY THIS FILE EXISTS, AND WHY THE INVARIANT IS NOT THE GATE FOR THIS RULING.
// `INV-PLAN-RUNWALK-PRESCRIBED-WHEN-UNREADY` fires on
// `runWalkPrescriptionApplies(input, level) && !plan.meta.run_walk_prescribed` — it SHARES
// the producer's predicate. Narrow the gate and the invariant goes quiet with it: measured,
// reverting `RUNWALK_INSTRUCTION_RACE_KEYS` to marathon-only left the invariant counts
// BYTE-IDENTICAL (84 HM warns either way, 0 errors). So it can detect "the gate said yes and
// the plan ignored it" and can NEVER detect "the gate should have said yes", which is exactly
// what this ruling is about. That is the `deloadCadence.test.ts` class, named in CLAUDE.md:
// a checker sharing the producer's predicate cannot catch the producer being wrong.
//
// These arms assert the BEHAVIOUR instead — the runner receives the instruction — and are
// falsified by narrowing the config, which is the mutation the invariant could not see.
import { describe, it, expect } from 'vitest'
import { generateRulePlan, derivedLevelsFor } from './ruleEngine'
import { runWalkInstructionDistanceApplies, runWalkDistanceApplies, runWalkPrescriptionApplies } from './runWalkPlan'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Session } from '../../types/plan'

const PLAN_START = '2026-04-27'
const R = GENERATION_CONFIG.WIZARD_VOLUME_RULER

/** Wizard-reachable inputs only: the weekly ruler steps by 5 and the longest-run ruler by 1.
 *  `fitness_level` is UNSET because no production caller sends it (COHORT-GRID-UNSET-LEVEL-01). */
function mk(over: Partial<GeneratorInput> & { weeks?: number }): GeneratorInput {
  const weeks = over.weeks ?? 14
  const raceDate = new Date(new Date(`${PLAN_START}T00:00:00Z`).getTime() + weeks * 7 * 86_400_000)
    .toISOString().slice(0, 10)
  const { weeks: _w, ...rest } = over
  return {
    athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
    plan_start: PLAN_START, race_date: raceDate, goal: 'finish',
    days_available: 4, days_cannot_train: [], current_weekly_km: 10, longest_recent_run_km: 0,
    training_age: '<6mo', recent_quality_training: 'none',
    hard_session_relationship: 'neutral', injury_history: [], max_weekday_mins: 60,
    race_distance_km: 5, ...rest,
  } as unknown as GeneratorInput
}

const runSessions = (p: Plan): Session[] =>
  p.weeks.flatMap(w => Object.values(w.sessions ?? {})).filter(Boolean) as Session[]
const withStrategy = (p: Plan) => runSessions(p).filter(s => (s as { run_walk_strategy?: string }).run_walk_strategy)

describe('§117 Am. 8 — the run-walk INSTRUCTION reaches 5K and 10K', () => {
  it('a 5K beginner whose longest run is ZERO is prescribed a run-walk, not 16 minutes of continuous running', () => {
    // 🩹 Willy at the sitting: "sixteen minutes of continuous running for someone whose
    // longest run is zero is not a step, it is the first injury." That session is what this
    // runner used to get, with §117 silent.
    const input = mk({ race_distance_km: 5, current_weekly_km: 5, longest_recent_run_km: 0 })
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect(plan.meta.run_walk_prescribed, 'the 5K never-run beginner carries no run-walk prescription').toBe(true)
    expect(withStrategy(plan).length,
      'no session carries a run-walk strategy, so the plan only PERMITS walking — what §117 refused to ship again')
      .toBeGreaterThan(0)
  })

  it('a 10K beginner whose longest run is ZERO is prescribed a run-walk', () => {
    const input = mk({ race_distance_km: 10, current_weekly_km: 10, longest_recent_run_km: 0 })
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect(plan.meta.run_walk_prescribed).toBe(true)
    expect(withStrategy(plan).length).toBeGreaterThan(0)
  })

  it('🔴 A DECLARED ZERO IS SERVED AND AN ABSENT FIELD IS NOT — absence is not a value', () => {
    // The guard used to read `longest <= 0`, which treated "I have never run" exactly like
    // "we were not told". 0 is a real wizard value (the ruler starts at 0, step 1) and is the
    // STRONGEST case for this prescription under Am. 5. A missing field still prescribes
    // nothing, because inferring from a question nobody answered is a different decision.
    const level = (i: GeneratorInput) => derivedLevelsFor(i).structural
    const declaredZero = mk({ race_distance_km: 5, current_weekly_km: 5, longest_recent_run_km: 0 })
    expect(runWalkPrescriptionApplies(declaredZero, level(declaredZero))).toBe(true)

    const absent = mk({ race_distance_km: 5, current_weekly_km: 5 })
    delete (absent as { longest_recent_run_km?: number }).longest_recent_run_km
    expect(runWalkPrescriptionApplies(absent, level(absent)),
      'an ABSENT longest run must not be read as a declared zero').toBe(false)
  })

  it('the PEAK scope is untouched — two predicates, because one was shared', () => {
    // 🔴 The one-line fix was to widen `runWalkDistanceApplies`, and it would have moved peak
    // volume for every 5K/10K beginner: that predicate is read by `runWalkApplies` (the peak
    // reduction) as well as by the prescription gate. §117 Am. 4 separates them BY RULING and
    // the peak half (`RUNWALK-ASSESSED-LEVEL-01`) was vacated once already on a measured
    // 7 runners going served -> refused. This arm is what stops the two being re-merged.
    expect(runWalkInstructionDistanceApplies(5)).toBe(true)
    expect(runWalkInstructionDistanceApplies(10)).toBe(true)
    expect(runWalkDistanceApplies(5), 'the PEAK scope must not have widened to the 5K').toBe(false)
    expect(runWalkDistanceApplies(10), 'the PEAK scope must not have widened to the 10K').toBe(false)
    expect(runWalkDistanceApplies(42.2)).toBe(true)

    // And the peak flag itself must stay off for the newly-served cohort.
    const input = mk({ race_distance_km: 5, current_weekly_km: 5, longest_recent_run_km: 0 })
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect((plan.meta as { finish_goal_run_walk?: boolean }).finish_goal_run_walk,
      'the PEAK REDUCTION flag is set for a 5K — Am. 4 separates the instruction from the peak')
      .not.toBe(true)
  })

  it('the HALF is OUT of the ruled scope and still generates the defect — counted, not fixed', () => {
    // Measured 2026-11-13: at cw >= 10 with a longest run of 1-2 km the HM generates the same
    // 16-minute continuous long run with §117 silent. The ruling names 5K and 10K, so the HM's
    // prescription does not change here. `INV-PLAN-RUNWALK-SHORTDIST-SCOPE` raises it as a
    // `warn` so the next sitting sees a number. This arm pins BOTH halves of that: the HM is
    // not prescribed, and the gap is not silent.
    expect(runWalkInstructionDistanceApplies(21.1),
      'the HM entered the instruction scope without a ruling').toBe(false)
    const input = mk({ race_distance_km: 21.1, current_weekly_km: 10, longest_recent_run_km: 1, weeks: 20 })
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect(plan.meta.run_walk_prescribed).not.toBe(true)
  })

  it('time-goal runners are untouched — a time goal says finishing is not the point', () => {
    const input = mk({ race_distance_km: 5, current_weekly_km: 5, longest_recent_run_km: 0,
      goal: 'time_target', target_time: '0:30:00' } as Partial<GeneratorInput>)
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect(plan.meta.run_walk_prescribed).not.toBe(true)
  })

  it('the instruction scope is CONFIG, not a literal — the singularity', () => {
    expect(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS).toContain('5K')
    expect(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS).toContain('10K')
    expect(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS).toContain('MARATHON')
    expect(GENERATION_CONFIG.RUNWALK_INSTRUCTION_RACE_KEYS,
      'the HM is in the instruction scope without a ruling').not.toContain('HM')
  })

  it('the wizard can actually send these inputs — the ruler, not a convenient number', () => {
    // The item's own example was `cw 6`, which the wizard cannot send: the weekly ruler steps
    // by 5. The defect is real at 0/5/10 and the fixtures above use those, deliberately.
    expect(R.WEEKLY_KM_STEP).toBe(5)
    expect(5 % R.WEEKLY_KM_STEP).toBe(0)
    expect(10 % R.WEEKLY_KM_STEP).toBe(0)
    expect(R.LONGEST_RUN_KM_MIN).toBe(0)
  })
})
