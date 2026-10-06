/**
 * §117 Amendment 5 — the run-walk PRESCRIPTION on readiness to run.
 *
 * 🩹 WILLY'S BINDING CONDITION LIVES IN ARM 2. The ruling was granted on the
 * condition that no peak falls, and `validatePlan` cannot express that (it has
 * no counterfactual peak and no `standardLevelPeakKm`). What it CAN be pinned
 * on is the flag: `finish_goal_run_walk` is the flag that reduces a peak, and
 * the readiness route must never set it.
 *
 * ⚠️ ARM 3 IS THE `PRESCRIBED-FIELD-REACH-01` LESSON. `run_walk_prescribed` was
 * stamped in plan JSON and read by nothing for months while its invariant stayed
 * green. A meta flag is not a prescription; the walk interval on the session is.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { runWalkPrescriptionApplies } from './runWalkPlan'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const DAY = 86_400_000
const START = '2026-11-02'

function marathonBeginner(longestKm: number, weeklyKm: number): GeneratorInput {
  const start = new Date(START + 'T00:00:00Z')
  return {
    athlete_name: 'Readiness', age: 38, race_name: 'Target race',
    primary_metric: 'distance', race_distance_km: 42.195,
    race_date: new Date(start.getTime() + 20 * 7 * DAY).toISOString().slice(0, 10),
    plan_start: START,
    goal: 'finish', fitness_level: 'beginner', training_age: '6-18mo',
    resting_hr: 55, max_hr: 185,
    current_weekly_km: weeklyKm, longest_recent_run_km: longestKm,
    days_available: 4, injury_history: [],
    hard_session_relationship: 'neutral', recent_quality_training: 'occasional',
    acknowledged_days_warning: true, acknowledged_prep_warning: true,
  } as unknown as GeneratorInput
}

function planOf(input: GeneratorInput) {
  // 'paid' is what `envelopeMeasure` passes, so this test and the benchmark
  // measure the same thing. A missing tier is not a neutral default.
  const r = generateRulePlan(input, 'paid')
  return (r as unknown) as {
    weeks: { n: number; sessions: Record<string, unknown> }[]
    meta: Record<string, unknown>
  }
}

describe('§117 Am.5 — run-walk prescribed on readiness to run', () => {
  // The measured failing cohort: 15 km/week clears §117's 13 km door by two
  // kilometres, and the longest run is 7 km = 16.6% of the race.
  const UNREADY = marathonBeginner(7, 15)
  const READY = marathonBeginner(15, 35)

  it('the predicate separates the measured cohorts', () => {
    expect(runWalkPrescriptionApplies(UNREADY)).toBe(true)
    // 15 km = 35.5% of the race, above the bar.
    expect(runWalkPrescriptionApplies(READY)).toBe(false)
    // The bar itself, stated so a config change has to come through here.
    expect(G.RUNWALK_PRESCRIBE_LONGEST_RUN_PCT_OF_RACE).toBe(25)
  })

  it('a runner who is ready is NOT given the prescription by this route', () => {
    // Guards the direction that would be invisible: over-prescribing walk
    // breaks to a runner who does not need them.
    expect(runWalkPrescriptionApplies(marathonBeginner(11, 25))).toBe(false)
    expect(runWalkPrescriptionApplies(marathonBeginner(20, 50))).toBe(false)
  })

  it('only beginners with a finish goal at marathon+ reach it', () => {
    const notBeginner = { ...UNREADY, fitness_level: 'intermediate' } as GeneratorInput
    const notFinish = { ...UNREADY, goal: 'time_target', target_time: '4:15:00' } as unknown as GeneratorInput
    const halfMarathon = { ...UNREADY, race_distance_km: 21.1 } as GeneratorInput
    expect(runWalkPrescriptionApplies(notBeginner)).toBe(false)
    expect(runWalkPrescriptionApplies(notFinish)).toBe(false)
    expect(runWalkPrescriptionApplies(halfMarathon)).toBe(false)
  })

  it('a missing or zero longest run does not reach it', () => {
    // §18's INV-INPUT-LONGEST-LE-WEEKLY means a stated longest is trustworthy;
    // an ABSENT one is not evidence of anything, and must not buy a prescription.
    expect(runWalkPrescriptionApplies({ ...UNREADY, longest_recent_run_km: undefined } as unknown as GeneratorInput)).toBe(false)
    expect(runWalkPrescriptionApplies({ ...UNREADY, longest_recent_run_km: 0 } as unknown as GeneratorInput)).toBe(false)
  })

  it('the unready runner GETS the prescription, and the plan validates', () => {
    const p = planOf(UNREADY)
    expect(p.meta.run_walk_prescribed).toBe(true)
    const errs = validatePlan(p as never, UNREADY).filter(v => v.severity === 'error')
    expect(errs.map(v => v.code)).toEqual([])
  })

  // 🩹 WILLY: no peak may fall.
  it('ARM 2 — the readiness route does NOT set the peak-reduction flag', () => {
    const p = planOf(UNREADY)
    expect(p.meta.run_walk_prescribed).toBe(true)
    // `finish_goal_run_walk` is what swaps `standardLevelPeakKm` for
    // `runWalkPeakKm()`. Unset means the peak is the one they would have had.
    expect(p.meta.finish_goal_run_walk).toBeUndefined()
  })

  it('ARM 3 — the walk interval reaches the SESSIONS, not just the meta', () => {
    const p = planOf(UNREADY)
    let running = 0, withInterval = 0
    for (const w of p.weeks) {
      for (const s of Object.values(w.sessions ?? {})) {
        const sess = s as { type?: string; run_walk_strategy?: unknown }
        if (!sess || sess.type === 'rest' || sess.type === 'strength' || sess.type === 'cross') continue
        running++
        if (sess.run_walk_strategy) withInterval++
      }
    }
    expect(running).toBeGreaterThan(20)
    expect(withInterval).toBe(running)
  })

  it('the invariant fires when the stamp is missing', () => {
    const p = planOf(UNREADY)
    delete p.meta.run_walk_prescribed
    const codes = validatePlan(p as never, UNREADY).map(v => v.code)
    expect(codes).toContain('INV-PLAN-RUNWALK-PRESCRIBED-WHEN-UNREADY')
  })
})
