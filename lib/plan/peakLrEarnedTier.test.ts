import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * §35 — floors are minimums, and the tier is a SIZING floor.
 *
 * Coaching Board LR-EARNED-TIER-01, 2026-09-15: §35 Amendment 1 rules that the
 * earned tier is applied when the peak long run is SIZED, and that §45, §47 and
 * §9 govern what is delivered. `INV-PLAN-PEAK-LR-EARNED-TIER` was retired in the
 * same commit because it asserted the tier on the DELIVERED run and fired on 8
 * plans that were correct.
 *
 * So this file pins what is actually true and actually observable, which is a
 * smaller claim than the invariant made and a true one.
 */
const PLAN_START = '2026-04-27'

const runner = (over: Record<string, unknown> = {}): GeneratorInput => ({
  age: 35, injury_history: [], plan_start: PLAN_START,
  race_distance_km: 21.1, race_date: '2026-07-27', goal: 'time_target',
  target_time: '1:45:00', current_weekly_km: 35, longest_recent_run_km: 19,
  days_available: 5, training_age: '2-5yr', recent_quality_training: 'regular',
  resting_hr: 55, max_hr: 184, preferred_long_run_day: 'sun', ...over,
} as unknown as GeneratorInput)

const peakLongRunKm = (input: GeneratorInput): number => {
  const plan: Plan = generateRulePlan(input, 'paid', PLAN_START)
  return Math.max(0, ...plan.weeks
    .filter(w => w.n >= 1 && w.type !== 'race')
    .flatMap(w => Object.values(w.sessions))
    .filter((s): s is Session => !!s && isLongRun(s))
    .map(s => s.distance_km ?? 0))
}

describe('§35 — the tier lift is REAL where it is observable', () => {
  it('a runner who has proven the distance gets a longer peak long run than one who has not', () => {
    // THE HALF THAT WORKS, and the half §35 was written for. `longest_recent_run_km`
    // clearing §24's floor selects the TARGET tier; not clearing it leaves the
    // runner on the floor. Measured across 36 comparable plans: the target lift
    // is observable in 33 of them.
    const earned = peakLongRunKm(runner())                              // 19 km recent
    const floorOnly = peakLongRunKm(runner({ longest_recent_run_km: 4 }))
    expect(earned, 'the tier lift no longer changes anything — §35 is inert')
      .toBeGreaterThan(floorOnly)
  })

  it('never drops below §24\'s floor, which is the half that protects the runner', () => {
    const floor = 21.1 * G.PEAK_LR_RATIO_VS_RACE.HM - G.DISTANCE_ROUNDING_PRECISION_KM
    expect(peakLongRunKm(runner())).toBeGreaterThanOrEqual(floor)
  })
})

describe('§35 Amendment 1 — the tier YIELDS to §45/§47/§9 at delivery', () => {
  it('a plan whose earned tier is eroded by the periodisation passes is VALID', () => {
    // The regression this file exists to prevent. The retired invariant failed
    // this plan; §35 Amendment 1 says it is correct, because §45 wins by its own
    // clause and §47's alternation is doing its job. If someone re-adds a
    // delivered-tier check, this goes red.
    const input = runner({
      current_weekly_km: 60, longest_recent_run_km: 30,
      hard_session_relationship: 'love', injury_history: ['back'],
      days_available: 4, max_weekday_mins: 60,
    })
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    expect(validatePlan(plan, input).filter(v => v.severity === 'error')).toEqual([])
  })

  it('INV-PLAN-PEAK-LR-EARNED-TIER stays retired', () => {
    const input = runner({ hard_session_relationship: 'love', longest_recent_run_km: 30 })
    const codes = validatePlan(generateRulePlan(input, 'paid', PLAN_START), input).map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-PEAK-LR-EARNED-TIER')
  })
})

describe('§35 Amendment 2 — the tier is TWO rungs, and the third is gone', () => {
  // Coaching Board LR-TIER-GATE-RECONCILE-01, 2026-09-15. The stretch rung was
  // removed for two reasons that pointed the same way:
  //
  //  1. ITS GATE WAS THE WEAKER OF TWO ANSWERING ONE QUESTION. §35's stretch
  //     turned on `hard_session_relationship: 'love'` with no training-age floor
  //     and only a partial injury test, while §47's consecutive-peak exception
  //     decides the same thing requiring no injury at all AND `5yr+`. Sims: the
  //     weaker gate was the one adding distance.
  //  2. IT WAS INERT. Measured across 36 comparable plans, it changed the
  //     delivered peak long run in 0 of 36 while the target lift moved 33.
  //
  // So removal had provably no effect on any runner, which is what made it a
  // safe change to make three days before the charity showcase.
  it('the config key is GONE, not merely unused', () => {
    expect(G as Record<string, unknown>).not.toHaveProperty('PEAK_LR_RATIO_STRETCH')
  })

  it('two rungs remain, still ordered', () => {
    expect(G.PEAK_LR_RATIO_VS_RACE.HM).toBeLessThan(G.PEAK_LR_RATIO_TARGET.HM)
    expect(G.PEAK_LR_RATIO_TARGET.HM).toBeLessThan(1)
  })

  it('a `love` runner and a `neutral` runner now get the SAME peak long run', () => {
    // Before Amendment 2 these differed in config and not in delivery. Now they
    // do not differ at all, which is the honest state. If this ever goes red,
    // someone has reintroduced a self-report path into long-run load.
    const love    = peakLongRunKm(runner({ hard_session_relationship: 'love',    longest_recent_run_km: 30 }))
    const neutral = peakLongRunKm(runner({ hard_session_relationship: 'neutral', longest_recent_run_km: 30 }))
    expect(love).toBe(neutral)
  })
})
