import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { sessionFloorsFor } from './sessionFloors'
import { sessionKmSelfPaced } from './sessionDistance'
import { isLongRun } from './sessionRole'
import type { GeneratorInput } from '@/types/plan'

// CB-SUBFLOOR-ADMIT-01 — the cohort the engine used to refuse.
//
// ⚠️ THIS FILE EXISTS BECAUSE NO STANDING HARNESS CAN SEE THESE RUNNERS.
// Measured before the change: **0 of 37,248 rows** across `cohortGrid` and
// `targetedGrid` carry `longest_recent_run_km < 5` — the minimum is 8. So
// `verify:parity`, `cohort:shape` and `measure:fitness` all report NO CHANGE
// from this work, and that is blindness, not safety. The property sweep reaches
// them (it generated **1,216 more plans** after this shipped, 13,014 -> 14,230),
// but it asserts validity, not that a first-timer is actually being built.
//
// The runners here are the ~500 Make-A-Wish first-timers: a charity place, a
// code in hand, London in seven months, and a longest run of 3 km.

const START = '2026-10-12'
const LONDON = '2027-04-25'          // ~29 weeks — the real cohort's runway

const firstTimer = (longestKm: number, cwk: number, raceDate = LONDON): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'London', primary_metric: 'distance',
  plan_start: START, race_distance_km: 42.2, race_date: raceDate, goal: 'finish',
  resting_hr: 60, max_hr: 184, current_weekly_km: cwk, longest_recent_run_km: longestKm,
  fitness_level: 'beginner', training_age: '<6mo', recent_quality_training: 'none',
  days_available: 4, days_cannot_train: [], injury_history: [],
} as unknown as GeneratorInput)

/** Long run per week, through the owner — a beginner plan is duration-anchored. */
const longRuns = (plan: any): number[] =>
  plan.weeks.map((w: any) =>
    Math.max(...Object.values(w.sessions).map((s: any) =>
      s && isLongRun(s) ? (sessionKmSelfPaced(s) ?? 0) : 0)))

const ABS = GENERATION_CONFIG.MIN_SESSION_DISTANCE_ABSOLUTE_KM
const FLOOR = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long

describe('CB-SUBFLOOR-ADMIT-01 — a first-timer with a real runway gets a plan', () => {
  // The whole cohort, not one persona.
  const cases = [2, 2.5, 3, 4, 4.5].flatMap(l => [15, 20, 25].map(c => [l, c] as const))

  it('🔴 every sub-floor first-timer with 29 weeks is ADMITTED', () => {
    const refused: string[] = []
    for (const [longest, cwk] of cases) {
      try { generateRulePlan(firstTimer(longest, cwk), 'paid', START) }
      catch (e: any) { refused.push(`longest ${longest}, ${cwk}km/wk -> ${e.name}`) }
    }
    expect(refused, 'these runners hold a charity code and seven months').toEqual([])
  })

  it('🔴 week one is a STEP, not a leap — §45, with no floor override', () => {
    // The defect in one assertion. The flat 5 km floor turned a +10% opening
    // week into +67% and §113 then refused the runner for it.
    const mult = GENERATION_CONFIG.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER
    for (const [longest, cwk] of cases) {
      const plan = generateRulePlan(firstTimer(longest, cwk), 'paid', START)
      const wk1 = longRuns(plan)[0]!
      expect(wk1, `longest ${longest}, ${cwk}km/wk: week 1 long run ${wk1}km`)
        .toBeLessThanOrEqual(longest * mult + 0.01)
    }
  })

  it('🔴 the plan actually BUILDS them — not a flat 29 weeks', () => {
    // A plan that admits someone and then never progresses is a worse outcome
    // than the refusal, because it costs them the whole block to find out.
    for (const [longest, cwk] of cases) {
      const lrs = longRuns(generateRulePlan(firstTimer(longest, cwk), 'paid', START))
      const peak = Math.max(...lrs)
      expect(peak, `longest ${longest}, ${cwk}km/wk built to only ${peak}km`)
        .toBeGreaterThan(longest * 3)
    }
  })

  it('carries zero ERROR violations', () => {
    for (const [longest, cwk] of cases) {
      const input = firstTimer(longest, cwk)
      const errs = validatePlan(generateRulePlan(input, 'paid', START), input)
        .filter(v => v.severity === 'error')
      expect(errs.map(e => `${e.code} ${e.message}`), `longest ${longest}, ${cwk}km/wk`).toEqual([])
    }
  })

  it('🔴 a SHORT runway is still refused — the board did not open the door to everyone', () => {
    // "A 3 km runner with eight weeks is still correctly refused." If this ever
    // passes, §113 has become a formality rather than a gate.
    expect(() => generateRulePlan(firstTimer(2, 15, '2026-12-28'), 'paid', START)).toThrow()
  })

  it('below the absolute minimum the floor stops collapsing', () => {
    expect(sessionFloorsFor(0.5).long).toBe(ABS)
    expect(ABS).toBeLessThan(FLOOR)
  })
})
