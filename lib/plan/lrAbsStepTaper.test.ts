import { describe, it, expect } from 'vitest'
import { GENERATION_CONFIG as G } from './generationConfig'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isLongRun } from './sessionRole'
import { sessionKmSelfPaced } from './sessionDistance'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * §45 Amendment 2 — LR-ABS-CAP-LOWVOL-01 (Coaching Board 2026-09-17).
 *
 * §45's absolute arm was a flat +5km regardless of how small the week was. On a
 * 30km long run that is +17%; on a 6km one it is +83%, arriving in a single week,
 * on the runner in the population with the least tissue conditioning.
 *
 * ⚠️ THE MEASUREMENT THAT SETTLED IT IS THE CONTROL GROUP, not the cohort. The
 * absolute arm binds MORE often on ordinary runners (37.8% of steps vs 29.2%) —
 * frequency was never the tell. Of cohort steps taken on the absolute arm, 32.5%
 * were >= +40% in one week against 2.7% in the control: a twelve-fold difference
 * in MAGNITUDE that a whole-population average would have hidden completely.
 */
const PLAN_START = '2026-09-21'
const km = (s: unknown) => sessionKmSelfPaced(s as never) ?? 0
const longOf = (w: Week) => km(Object.values(w.sessions).find(s => s && isLongRun(s)))

const lowVolume = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  athlete_name: 'LV', age: 35, race_name: 'Charity HM', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 21.1, race_date: '2026-12-27', goal: 'finish',
  resting_hr: 58, max_hr: 186, current_weekly_km: 18, longest_recent_run_km: 8,
  fitness_level: 'beginner', recent_quality_training: 'none',
  hard_session_relationship: 'neutral', training_age: '<6mo',
  days_available: 4, days_cannot_train: [], injury_history: [],
  ...over,
} as unknown as GeneratorInput)

describe('§45 Am.2 — the absolute long-run step tapers on a small week', () => {
  it('the numeric is the board\'s "15% of the week" re-expressed on the long run (§9)', () => {
    // Not a number picked to make a chart look right — this is the derivation
    // that answered Hutchinson's "a 33% ceiling is a number I made up".
    // The board ruled 15% of the prior WEEK. §9 sizes the build-phase long run at
    // 30% of the week, so 15% of the week IS 50% of the long run — the same rule
    // on an input that is stable mid-pipeline. If §9's build share moves, this
    // derivation must be revisited.
    const weekBasisPct = G.LONG_RUN_PCT_OF_WEEKLY_VOLUME.build / 2        // 15
    expect(G.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR)
      .toBe(weekBasisPct / (G.LONG_RUN_PCT_OF_WEEKLY_VOLUME.build / 100)) // 50
  })

  it('a SMALL long run gets a smaller absolute step than the flat +5km it used to get', () => {
    // The arithmetic the amendment turns on, asserted directly so the intent
    // survives a refactor of the producer. A 6km long run may now step +3km,
    // not +5km — the 6 -> 11km (+83%) case the measurement found.
    const tapered = Math.min(
      G.LONG_RUN_PROGRESSION_CAP_ABS_KM,
      6 * G.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR / 100,
    )
    expect(tapered).toBeLessThan(G.LONG_RUN_PROGRESSION_CAP_ABS_KM)
    expect(tapered).toBeCloseTo(3.0, 5)
  })

  it('an ORDINARY long run is UNAFFECTED — the flat +5km still binds', () => {
    // The control group's finding, pinned: this must not become a cap on
    // ordinary runners. At a 15km long run, 50% is 7.5km, so +5km still wins.
    const tapered = Math.min(
      G.LONG_RUN_PROGRESSION_CAP_ABS_KM,
      15 * G.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR / 100,
    )
    expect(tapered).toBe(G.LONG_RUN_PROGRESSION_CAP_ABS_KM)
  })

  it('no low-volume plan takes a long-run step above the tapered cap', () => {
    // FALSIFIABLE END-TO-END: this fails if the producer stops applying the
    // taper, which is the regression that matters.
    const plan: Plan = generateRulePlan(lowVolume(), 'trial', PLAN_START, undefined, PLAN_START)
    const breaches: string[] = []
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1], curr = plan.weeks[i]
      if (curr.n < 1 || prev.n < 1 || curr.type === 'race' || prev.type === 'deload') continue
      const p = longOf(prev), c = longOf(curr)
      if (p <= 0 || c <= p) continue
      const allowed = Math.max(
        p * G.LONG_RUN_PROGRESSION_CAP_PCT / 100,
        Math.min(G.LONG_RUN_PROGRESSION_CAP_ABS_KM,
          p * G.LONG_RUN_ABS_STEP_MAX_PCT_OF_LR / 100),
      ) + G.DISTANCE_ROUNDING_PRECISION_KM
      if (c - p > allowed + 0.01) breaches.push(`w${curr.n}: ${p}→${c}km vs allowed +${allowed.toFixed(1)}`)
    }
    expect(breaches).toEqual([])
  })

  it('the plan stays constitutional — the cap must not create a new violation', () => {
    // §24's floor is the known cost (18 of 1,149 plans reclassify to
    // maintenance-grade). That is a CLASSIFICATION, not a violation, and the
    // runner is told via volume_constraint_note. Nothing may go error-severity.
    const input = lowVolume()
    const plan = generateRulePlan(input, 'trial', PLAN_START, undefined, PLAN_START)
    const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
    expect(errors.map(e => e.code)).toEqual([])
  })
})
