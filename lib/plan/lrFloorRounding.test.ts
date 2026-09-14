// §24 Amendment 1 — the floor comparison is not decided by the engine's own rounding.
//
// Coaching Board 2026-09-13, MARATHON-MAINT-LABEL-01 re-opened. The batch
// sitting's item 2 held that time-target marathons are pinned at `maintenance`
// because §24's 31.65 km floor is unreachable under LONG_RUN_CAP_MINUTES = 210.
// Measured, that is false: 210 minutes at the engine's actual easy pace
// (6.26 min/km) buys 33.5 km, ABOVE the floor, at every volume 50–110 km/wk.
// Implemented as ruled it flipped ZERO plans, and substituting §45 as the
// blocker was ruled INCORRECT because §45 already legislates the downgrade in
// its own words. Only ONE part survived: the comparison itself.
//
// The peak long run is floor-rounded to DISTANCE_ROUNDING_PRECISION_KM by the
// producer and was then compared against an UNROUNDED threshold. A computed
// 31.9 km is stored as 31.5 and fails a 31.65 km floor by 150 metres.
// Measured: 9 of 162 marathon plans below the floor sit in that dead band, and
// 6 of 78 HM plans. Willy: 0.5 km on a 31.65 km long run is a comparison bug,
// not a load change. McMillan: six kilometres short is a coaching fact worth
// telling the runner; 150 metres is not, and both read the same sentence.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

const PLAN_START = '2026-09-14'
const STEP = GENERATION_CONFIG.DISTANCE_ROUNDING_PRECISION_KM
const LR_REASON = /Peak long run ([\d.]+) km is below the ([\d.]+) km floor/

const base = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-06-13', goal: 'time_target',
  age: 40, resting_hr: 55, max_hr: 180,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

/** Every time-target HM/marathon plan across a grid wide enough to hold the dead band. */
function grid(): { input: GeneratorInput; plan: Plan }[] {
  const out: { input: GeneratorInput; plan: Plan }[] = []
  for (const km of [21.1, 42.2]) {
    for (const lvl of ['beginner', 'intermediate', 'experienced'] as const) {
      for (const days of [3, 4, 5, 6]) {
        for (const vol of [20, 35, 50, 70, 90, 110]) {
          const input = base({
            race_distance_km: km,
            target_time: km > 40 ? '4:00:00' : '1:55:00',
            current_weekly_km: vol,
            longest_recent_run_km: Math.max(6, Math.round(vol * 0.35)),
            days_available: days, fitness_level: lvl,
          } as Partial<GeneratorInput>)
          let plan: Plan
          try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { continue }
          out.push({ input, plan })
        }
      }
    }
  }
  return out
}

describe('§24 Amendment 1 — a rounding step never decides the cohort', () => {
  it('no plan is told it missed the floor by less than one rounding step', () => {
    let checked = 0, withReason = 0
    const offenders: string[] = []
    for (const { plan } of grid()) {
      checked++
      const m = LR_REASON.exec(plan.meta.volume_constraint_note ?? '')
      if (!m) continue
      withReason++
      const shortfall = Number(m[2]) - Number(m[1])
      if (shortfall > 0 && shortfall < STEP - 0.05) {
        offenders.push(`${m[1]} km vs ${m[2]} km floor (short ${shortfall.toFixed(2)} km)`)
      }
    }
    expect(checked, 'grid must generate').toBeGreaterThan(50)
    expect(withReason, 'and must still produce real §24 shortfalls to check').toBeGreaterThan(0)
    expect(offenders).toEqual([])
  })

  it('a REAL shortfall is still reported — the tolerance did not silence §24', () => {
    // 66.7% of marathon plans below the floor are short by more than 6 km. If the
    // tolerance had swallowed those the label would have stopped meaning anything,
    // which is the opposite failure from the one being fixed.
    let bigShortfalls = 0
    for (const { plan } of grid()) {
      const m = LR_REASON.exec(plan.meta.volume_constraint_note ?? '')
      if (!m) continue
      if (Number(m[2]) - Number(m[1]) > 1) bigShortfalls++
    }
    expect(bigShortfalls, 'genuine shortfalls must still be named').toBeGreaterThan(0)
  })

  it('the invariant goes RED on the artefact sentence', () => {
    const input = base({
      race_distance_km: 42.2, target_time: '4:00:00',
      current_weekly_km: 70, longest_recent_run_km: 25,
      days_available: 5, fitness_level: 'experienced',
    } as Partial<GeneratorInput>)
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const sabotaged: Plan = JSON.parse(JSON.stringify(plan))
    sabotaged.meta.volume_constraint_note =
      'Peak long run 31.5 km is below the 31.7 km floor (75% of race distance).'
    const vs = validatePlan(sabotaged, input)
      .filter(v => v.code === 'INV-PLAN-LR-FLOOR-NOT-ROUNDING')
    expect(vs.length, 'a 0.2 km stated shortfall must fire').toBeGreaterThan(0)
  })

  it('and stays GREEN on a genuine shortfall', () => {
    const input = base({
      race_distance_km: 42.2, target_time: '4:00:00',
      current_weekly_km: 70, longest_recent_run_km: 25,
      days_available: 5, fitness_level: 'experienced',
    } as Partial<GeneratorInput>)
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const sabotaged: Plan = JSON.parse(JSON.stringify(plan))
    sabotaged.meta.volume_constraint_note =
      'Peak long run 24.0 km is below the 31.7 km floor (75% of race distance).'
    expect(
      validatePlan(sabotaged, input).filter(v => v.code === 'INV-PLAN-LR-FLOOR-NOT-ROUNDING'),
    ).toEqual([])
  })

  it('the two §24 enforcement sites agree on what the floor is', () => {
    // The classifier's tolerance flips near-miss plans maintenance → build, and
    // INV-PLAN-PEAK-LR-RACE-RATIO is EXEMPT while a plan is maintenance. Without
    // the same tolerance there, the amendment un-exempts exactly the plans it
    // just forgave and errors on them — measured as 3 hard failures in the
    // cohort grid before this was fixed.
    for (const { input, plan } of grid()) {
      const errs = validatePlan(plan, input).filter(v =>
        v.severity === 'error' && v.code === 'INV-PLAN-PEAK-LR-RACE-RATIO')
      expect(errs, `${input.race_distance_km}km/${input.fitness_level} must not error`).toEqual([])
    }
  })
})
