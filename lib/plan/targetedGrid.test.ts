import { describe, it, expect } from 'vitest'
import { cohortGrid, targetedGrid, COHORT_PLAN_START, isDesignedRefusal } from './cohortGrid'
import { derivedLevelsFor, generateRulePlan } from './ruleEngine'
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
        if (isDesignedRefusal(e)) continue
        if (failures.length < 3) failures.push(msg.split('\n').slice(0, 2).join(' | '))
      }
    }
    expect(failures, 'These inputs break the constitution.').toEqual([])
  }, 120_000)

  // ── COHORT-GRID-UNSET-LEVEL-01 (2026-11-03) — ONE ARM BECAME TWO, and the
  // reason is a measured coverage MOVE, not a loosening.
  //
  // This grid used to force `fitness_level: 'beginner'` on all 6,144 rows. That
  // floored STRUCTURE at beginner, and since a declaration binds structure downward
  // only (§79), all three of its upward declarations were upward *from beginner* —
  // so the grid held the over-claim shape and could not hold the opposite one. The
  // field is gone (no production caller sends it) and 30 km/week with a 12 km
  // longest run assesses INTERMEDIATE, which inverts exactly that:
  //
  //   · over-claim (declared > assessed structural): this grid **3,072 -> 1,536**,
  //     `cohortGrid` **0 -> 19,008**. It moved corpus;
  //     `corpusProductionShape.test.ts` asserts it stays reached there.
  //   · credible caution (declared < assessed structural): this grid **0 -> 1,536**,
  //     `cohortGrid` 0 -> 8,640. §79's downward arm had NO coverage in this grid at
  //     all, because the forced beginner floor made a 'beginner' declaration a no-op.
  //   · structure moves on 4,608 of 6,144 rows (75.0%) and INTENSITY on 1,536 (25.0%)
  //     — the undeclared rows, pinned to beginner intensity by the forced field.
  //
  // So each direction is now asserted on the corpus that actually holds it.
  const levelsOf = (i: GeneratorInput) => derivedLevelsFor(i)
  const qualityCount = (p: Plan) =>
    p.weeks.flatMap(w => Object.values(w.sessions))
      .filter(s => s && s.type === 'quality').length
  const planOf = (i: GeneratorInput) =>
    generateRulePlan(i, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START)

  it('UPWARD — a structural beginner who DECLARES intermediate is a real, covered path', () => {
    // The charity-critical case: the wizard sends `user_declared_level`, none of the
    // 11 plan personas set it, and a structural beginner who declares 'intermediate'
    // goes from 0 quality sessions to several.
    //
    // 🔴 NEITHER GRID CAN BUILD THIS RUNNER, AND THAT IS A MEASURED CORPUS GAP, NOT a
    // reason to skip the arm. `cohortGrid`'s volumes are 20/35/50/70 km and its longest
    // runs 8/14/20/28 km — and `FITNESS_VOLUME_THRESHOLDS` is
    // `beginner_max_weekly_km: 20`, `beginner_max_long_km: 8`, both strictly-less-than.
    // So the grid sits EXACTLY ONE UNIT above the beginner band on both axes, and
    // `assessedIntensity` is 'beginner' on 0 of 41,472 rows (0 of 6,144 here).
    // The forced `fitness_level` used to manufacture 13,824 of them.
    //
    // Consequence: an upward declaration cannot LIFT intensity anywhere in these grids,
    // because the assessment is already intermediate. So the base is this grid's row
    // with the volume lowered under the threshold — every other axis still the grid's.
    // Filed as `GRID-NO-ASSESSED-BEGINNER-01`.
    const row = grid[0]
    const plain = { ...row, current_weekly_km: 12, longest_recent_run_km: 5 } as unknown as GeneratorInput
    delete (plain as unknown as Record<string, unknown>).user_declared_level
    const declared = { ...plain, user_declared_level: 'intermediate' } as unknown as GeneratorInput

    // The premise, asserted — otherwise this arm silently stops testing a lift.
    expect(levelsOf(plain).assessedStructural).toBe('beginner')
    expect(levelsOf(plain).assessedIntensity).toBe('beginner')

    const plainPlan = planOf(plain)
    const liftedPlan = planOf(declared)

    // The structural assessment must NOT move — §79/D2: an upward declaration buys
    // intensity only, never tonnage, and the two axes are never merged.
    expect(liftedPlan.meta.fitness_level).toBe(plainPlan.meta.fitness_level)
    expect(liftedPlan.meta.fitness_level).toBe('beginner')
    expect(liftedPlan.meta.fitness_intensity_level).toBe('intermediate')

    // This does NOT assert the count is correct — that is a live board question
    // (CV-ELIGIBILITY-01's open half). It asserts the path is REACHED and the plan is
    // constitutional, so the question can be measured rather than discovered in
    // production.
    expect(validatePlan(plainPlan, plain).filter(v => v.severity === 'error')).toEqual([])
    expect(validatePlan(liftedPlan, declared).filter(v => v.severity === 'error')).toEqual([])
    expect(qualityCount(liftedPlan)).toBeGreaterThan(qualityCount(plainPlan))
  })

  it('DOWNWARD — a runner who DECLARES beginner against an intermediate read moves STRUCTURE', () => {
    // §79's other half, and the one this grid could never reach: a runner
    // volunteering caution is credible about caution, so a downward declaration
    // binds TONNAGE as well as intensity. Measured 1,536 of 6,144 rows.
    const row = grid.find(i =>
      (i as unknown as Record<string, unknown>).user_declared_level === 'beginner')!
    const base = { ...row } as Record<string, unknown>
    delete base.user_declared_level
    const plain = base as unknown as GeneratorInput

    expect(levelsOf(plain).structural).toBe('intermediate')
    expect(levelsOf(row).structural).toBe('beginner')

    const plainPlan = planOf(plain)
    const cautiousPlan = planOf(row)
    expect(plainPlan.meta.fitness_level).toBe('intermediate')
    expect(cautiousPlan.meta.fitness_level).toBe('beginner')
    // Tonnage follows it down — that is what distinguishes this arm from the one above.
    expect(cautiousPlan.meta.peak_km_target ?? 0)
      .toBeLessThan(plainPlan.meta.peak_km_target ?? 0)

    expect(validatePlan(plainPlan, plain).filter(v => v.severity === 'error')).toEqual([])
    expect(validatePlan(cautiousPlan, row).filter(v => v.severity === 'error')).toEqual([])
  })
})
