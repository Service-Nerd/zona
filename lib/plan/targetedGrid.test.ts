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
      'foundation_decision', 'day_budgets', 'hard_session_relationship',
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

  // ⚠️ EXPLICIT TIMEOUT — CI-TIMEOUT-01 again, and this time the wall was real.
  //
  // MEASURED 2026-09-18, and the FIRST measurement was misleading, which is the
  // part worth keeping. Run ALONE this file takes 8.7s; run inside the full
  // suite, where workers contend, the same test takes **15.3s**. `ubuntu-latest`
  // is the measured **3.5x** slower runner (CI-TIMEOUT-01), so the real
  // projection is **~54s** against a 30s budget — not the ~31s an isolated
  // measurement suggests. **Measure a timeout in the context it times out in.**
  //
  // Both sides of the same day's change: 8.65s before, 8.77s after (+1.4%, the
  // new INV-PLAN-LR-SHORTFALL-CAUSE walking weeks). The 30s budget breaks at
  // ~8,571ms of local work even in ISOLATION, so **this test was already over
  // the line before the change** — CI was a coin flip that landed red.
  //
  // The grid is exhaustive by doctrine (GRID-COVERAGE-02) and will only grow,
  // so a budget that merely clears today's number is the same race one test
  // from now — CI-TIMEOUT-01's own stated reasoning. 120s is ~2.2x the
  // realistic ~54s. A genuinely hung test still trips well inside the job's
  // 20-minute bound.
  //
  // ⚠️ `slowTestThreshold: 1000` was supposed to make this drift visible, and
  // it did: 8.7s has been printed on every run for some time. **Printing is not
  // a gate** — nobody reads a green run's output. Tracked as CI-SLOW-DRIFT-01.
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
  }, 120_000)

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
