import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { deliveredPeakKm } from './baseVolume'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

// S106-RACE-PEAK-01 — §111's numerator excludes the race week.
//
// THE DEFECT. `deliveredPeakKm` filtered foundation weeks and `n > 0` and
// stopped, so for a marathon the 42.2 km RACE ITSELF was counted as training
// volume. Measured on a beginner marathon, 20 km/week start:
//
//   week 16 (peak, training)  weekly_km 52  <- exactly PEAK_KM_BY_LEVEL
//   week 20 (race)            weekly_km 59  <- the marathon plus shakeouts
//
// §111 scored every marathon runner's build **13% higher than the training they
// actually do**, so the minimum base it demanded was 14.75 km/week instead of
// 13. Measured effect on the door: a beginner with a 29-week runway is now
// admitted from **12 km/week instead of 16**.
//
// ⚠️ DEFECT FIX, NOT A DOCTRINE CHANGE — stated because §111 is board-ratified.
// §111's own header defines the metric as "the acute stimulus" and ratified it
// citing "5 km/week -> 47 km peak", a figure that already excluded the race.
// The code never matched the principle it was written from.
//
// ⚠️ NEITHER PLAN GRID CAN SEE THIS. Their minimum `current_weekly_km` is 20,
// so `cohort:shape` and `measure:fitness` report no change — the same blindness
// recorded for CB-SUBFLOOR-ADMIT-01. This file is the check.

const START = '2026-10-12'

const beginner = (cwk: number, raceKm = 42.2): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'L', primary_metric: 'distance',
  plan_start: START, race_distance_km: raceKm, race_date: '2027-04-25', goal: 'finish',
  resting_hr: 60, max_hr: 184, current_weekly_km: cwk,
  longest_recent_run_km: Math.max(3, Math.round(cwk * 0.4)),
  fitness_level: 'beginner', training_age: '<6mo', recent_quality_training: 'none',
  days_available: 4, days_cannot_train: [], injury_history: [],
} as unknown as GeneratorInput)

describe('S106-RACE-PEAK-01 — the race week is not a training peak', () => {
  const plan = generateRulePlan(beginner(20), 'paid', START)

  it('the case is real: a race week EXISTS and is the biggest week', () => {
    // Anti-vacuous. If the race stops being the largest week this file is inert.
    const race = plan.weeks.find(w => w.type === 'race')
    expect(race, 'no race week').toBeTruthy()
    const others = plan.weeks.filter(w => w.n > 0 && w.type !== 'race')
    expect(race!.weekly_km!).toBeGreaterThan(Math.max(...others.map(w => w.weekly_km ?? 0)))
  })

  it('🔴 deliveredPeakKm ignores it', () => {
    const race = plan.weeks.find(w => w.type === 'race')!
    expect(deliveredPeakKm(plan)).toBeLessThan(race.weekly_km!)
  })

  it('🔴 the peak it reports IS the training target, not the race', () => {
    // 52 for a beginner marathon — PEAK_KM_BY_LEVEL, reached in the peak phase.
    const target = GENERATION_CONFIG.PEAK_KM_BY_LEVEL.MARATHON.beginner
    expect(deliveredPeakKm(plan)).toBeLessThanOrEqual(target + 0.51)
  })

  it('🔴 a 12 km/week beginner with a long runway is ADMITTED', () => {
    // The door this opened. At the race-inflated peak they needed 14.75 km/wk.
    expect(() => generateRulePlan(beginner(12), 'paid', START)).not.toThrow()
  })

  it('and a genuinely under-based runner is still refused', () => {
    // ⚠️ 10 -> 3 on 2026-09-20. §117 admits 10: the finish-goal run-walk shape
    // builds to a 32 km peak, so 32 / 4.0 = 8 is the door for that cohort and
    // the runner's delivered ratio is 3.2x — inside the band §111's own
    // rationale ratifies (M1 passes at 3.13x). See §111 Amendment 3.
    //
    // §111 is still not neutered, and this is what that now means: the CAP is
    // untouched at 4.0, and a runner far enough below any peak still fails.
    expect(() => generateRulePlan(beginner(3), 'paid', START)).toThrow()
  })
})
