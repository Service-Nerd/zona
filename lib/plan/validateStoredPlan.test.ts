import { describe, it, expect } from 'vitest'
import { validateStoredPlan, validateSavedPlan, isBaseBuildPlan } from './validateStoredPlan'
import { validateReshapedPlan, validatePlan, type Violation } from './invariants'
import { generateGetRunningPlan } from './getRunningPlan'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Plan } from '@/types/plan'
import { PINNED_PLAN_START_1012 as PINNED } from './__fixtures__/pinnedPlanStart'

// AUDIT-PLAN-KIND-01 (2026-10-09) — the right constitution for the right plan kind.
//
// Found while stamping `generator_input` on base-build plans
// (BASEBUILD-GENINPUT-01): the stamp opens `savePlanForUser`'s validate gate, and
// the gate ran the RACE-plan validator. It turned out the daily audit had been
// doing the same thing all along.
//
// 🔴 MEASURED AGAINST PRODUCTION BEFORE THE FIX:
//   (race)        32 plans  262 errors  mean  8.2
//   base_build     2 plans  101 errors  mean 50.5   ← 28% of the fleet's errors
// Every one of the 101 a phantom. `baseBuildValidate.ts`'s header had said so in
// writing — "a SEPARATE VALIDATOR, NOT AN EXEMPTION" — and nothing read it.

const mk = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', current_weekly_km: 8, longest_recent_run_km: 3,
  age: 32, injuries: [], recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

const errs = (v: Violation[]) => v.filter(x => x.severity === 'error')
const baseBuild = (over: Partial<GeneratorInput> = {}): Plan =>
  generateGetRunningPlan(mk(over), PINNED, 29).plan

describe('AUDIT-PLAN-KIND-01 — the audit judges a base-build plan by §116', () => {
  it('the predicate narrows on the kind the producers actually write', () => {
    expect(isBaseBuildPlan(baseBuild())).toBe(true)
    expect(isBaseBuildPlan(generateRulePlan(mk({ race_distance_km: 10, current_weekly_km: 25,
      longest_recent_run_km: 8, training_age: '2-5yr' }), 'paid', PINNED))).toBe(false)
    expect(isBaseBuildPlan(null)).toBe(false)
  })

  // 🔴 THE DEFECT, AS A NUMBER. Not "fewer errors" — the race validator fires
  // dozens and §116's fires none, and the gap is the phantom count.
  it('a VALID base-build plan reports 0 errors, where the race validator reported dozens', () => {
    for (const cwk of [6, 8, 10, 12, 15]) {
      const plan = baseBuild({ current_weekly_km: cwk })
      const phantom = errs(validateReshapedPlan(plan))
      // The old behaviour, pinned — so this arm cannot pass by the phantoms
      // quietly going away for some unrelated reason.
      expect(phantom.length, `cwk=${cwk}: the race validator no longer fires; this arm is now vacuous`)
        .toBeGreaterThan(20)
      expect(phantom.map(v => v.code)).toContain('INV-PLAN-PREP-TIME-STATUS-ANNOTATED')

      expect(errs(validateStoredPlan(plan)).map(v => v.message), `cwk=${cwk}`).toEqual([])
      expect(errs(validateSavedPlan(plan, mk({ current_weekly_km: cwk }))).map(v => v.message), `cwk=${cwk}`).toEqual([])
    }
  })

  // §116's validator must still BITE. A dispatch that routes to a checker which
  // can never fire is the same green tick with nothing behind it.
  it('§116 still fires on a base-build plan that breaks it', () => {
    const plan = JSON.parse(JSON.stringify(baseBuild())) as Plan
    for (const w of plan.weeks) w.weekly_km = plan.weeks[0].weekly_km   // flatten the ramp
    expect(errs(validateStoredPlan(plan)).map(v => v.code)).toContain('INV-PLAN-ONRAMP-CURVE-CLIMBS')
    expect(errs(validateSavedPlan(plan, mk())).map(v => v.code)).toContain('INV-PLAN-ONRAMP-CURVE-CLIMBS')
  })

  it('a race plan is unchanged — the dispatch is additive, not a rewrite', () => {
    const i = mk({ race_distance_km: 21.1, race_date: '2027-03-21', current_weekly_km: 40,
      longest_recent_run_km: 14, training_age: '2-5yr', days_available: 5 })
    const plan = generateRulePlan(i, 'paid', PINNED)
    expect(validateStoredPlan(plan)).toEqual(validateReshapedPlan(plan))
    expect(validateSavedPlan(plan, i)).toEqual(validatePlan(plan, i))
  })

  // ⚠️ THE TWO POLICIES ARE NOT INTERCHANGEABLE, and this arm is why they are two
  // functions rather than one. `validateReshapedPlan` skips two race-week
  // invariants by design; reusing it on the save path would weaken that gate
  // silently, which is exactly the kind of same-shape-different-strictness slip
  // this repo has paid for.
  it('the save policy is STRICTER than the audit policy for a race plan', () => {
    const i = mk({ race_distance_km: 10, race_date: '2027-03-21', current_weekly_km: 25,
      longest_recent_run_km: 8, training_age: '2-5yr' })
    const plan = JSON.parse(JSON.stringify(generateRulePlan(i, 'paid', PINNED))) as Plan
    // Move race day out of the plan's final week. The invariant reads
    // `plan.meta.race_date`, so that is what has to move.
    plan.meta.race_date = '2028-01-01'
    ;(plan.meta.generator_input as GeneratorInput).race_date = '2028-01-01'

    expect(validateSavedPlan(plan, { ...i, race_date: '2028-01-01' }).map(v => v.code))
      .toContain('INV-PLAN-COVERS-RACE-DATE')
    expect(validateStoredPlan(plan).map(v => v.code))
      .not.toContain('INV-PLAN-COVERS-RACE-DATE')
  })
})
