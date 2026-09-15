import { describe, it, expect } from 'vitest'
import { targetedGrid, COHORT_PLAN_START, COHORT_REFUSAL } from './cohortGrid'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * GRID-COVERAGE-02 Phase 2 — the five fields `cohortGrid` never varies.
 *
 * `cohortGrid` is exhaustive and un-sampled and already 31,104 rows; crossing
 * these five into it would be ~500k. They gate MECHANISMS rather than cohort
 * classification, so they need REACH, not a cross — the `corpus` pattern the
 * invariant-liveness baseline already names.
 */
describe('targetedGrid — the fields the main grid cannot reach', () => {
  const grid = targetedGrid()

  it('every targeted field actually varies — a constant axis is not coverage', () => {
    // The same gate cohortShape carries. GRID-COVERAGE-01's whole lesson was that
    // a field silently held constant makes every mechanism keyed on it
    // unreachable while the suite stays green.
    const REQUIRED = [
      'injury_history', 'user_declared_level', 'weeks_at_current_volume',
      'foundation_decision', 'day_budgets',
    ] as const
    const constant: string[] = []
    for (const field of REQUIRED) {
      const seen = new Set(
        (grid as unknown as Record<string, unknown>[]).map(i => JSON.stringify(i[field] ?? null)))
      if (seen.size < 2) constant.push(`${field} (always ${Array.from(seen)[0]})`)
    }
    expect(constant, 'These fields do not vary, so this grid proves nothing about them.')
      .toEqual([])
  })

  it('every input generates or refuses by design — no hard failures', () => {
    const failures: string[] = []
    for (const input of grid) {
      try {
        generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (COHORT_REFUSAL.test(msg)) continue
        if (failures.length < 3) failures.push(msg.split('\n').slice(0, 2).join(' | '))
      }
    }
    expect(failures, 'These inputs break the constitution.').toEqual([])
  })

  it('a first-timer who DECLARES a level is a real, covered path', () => {
    // The charity-critical case, pinned because it had no coverage anywhere
    // before this grid: the wizard sends `user_declared_level`, none of the 11
    // charity personas set it, and a structural beginner who declares
    // 'intermediate' goes from 0 quality sessions to several.
    //
    // This does NOT assert the count is correct — that is a live board question
    // (CV-ELIGIBILITY-01's open half). It asserts the path is REACHED and the
    // plan is constitutional, so the question can be measured rather than
    // discovered in production.
    const base = grid.find(i =>
      (i as unknown as Record<string, unknown>).user_declared_level === undefined)!
    const declared: GeneratorInput = {
      ...base, user_declared_level: 'intermediate',
    } as GeneratorInput

    const plainPlan = generateRulePlan(base, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    const liftedPlan = generateRulePlan(declared, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)

    const qualityCount = (p: Plan) =>
      p.weeks.flatMap(w => Object.values(w.sessions))
        .filter(s => s && s.type === 'quality').length

    // The structural assessment must NOT move — §79/D2: an upward declaration
    // buys intensity only, never tonnage, and the two axes are never merged.
    expect(liftedPlan.meta.fitness_level).toBe(plainPlan.meta.fitness_level)
    expect(liftedPlan.meta.fitness_intensity_level).toBe('intermediate')

    // Both plans must be constitutional whatever the counts are.
    expect(validatePlan(plainPlan, base).filter(v => v.severity === 'error')).toEqual([])
    expect(validatePlan(liftedPlan, declared).filter(v => v.severity === 'error')).toEqual([])

    // And the declaration must actually reach the prescription, or the axis is
    // decorative and this grid is proving nothing.
    expect(qualityCount(liftedPlan)).toBeGreaterThan(qualityCount(plainPlan))
  })
})
