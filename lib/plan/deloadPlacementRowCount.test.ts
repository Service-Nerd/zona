import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * INV-PLAN-DELOAD-PLACEMENT emits ONE row per offence, not one per week.
 *
 * The check is plan-level: it builds a phase map from `plan.weeks` and iterates
 * them itself. It nonetheless sat inside `validatePlan`'s `for (const w of
 * plan.weeks)` loop, ~760 lines below the loop header, so it ran once per week
 * and a single bad deload emitted one identical row for every week in the plan.
 *
 * ⚠️ WHY THIS TEST AND NOT JUST THE MOVE. The duplication was invisible on
 * healthy plans: measured across the full 45,776-plan corpus the check fires
 * ZERO times, so nothing counted it and no baseline recorded it. It is also
 * absent from `invariantLivenessBaseline.json`, meaning the liveness harness
 * has proven it CAN be woken — a live rule that is simply silent on good
 * plans. A defect that is latent, wakeable and uncounted is exactly the kind
 * this repo has shipped before, so the row count gets a test rather than a
 * comment.
 */

const input: GeneratorInput = {
  race_date: '2027-01-17', race_distance_km: 21.1, goal: 'finish',
  days_available: 4, age: 40, current_weekly_km: 35, longest_recent_run_km: 14,
  resting_hr: 50, max_hr: 186, preferred_long_run_day: 'sun',
} as GeneratorInput

/** Force the offence the invariant exists to catch: a deload opening a phase. */
function withDeloadOpeningAPhase(plan: Plan): Plan {
  const forged = structuredClone(plan)
  const weeks = forged.weeks.filter(w => w.n >= 1)
  const i = weeks.findIndex((w, n) => n > 0 && w.phase === 'build' && weeks[n - 1].phase === 'base')
  if (i < 0) return forged
  const target = forged.weeks.find(w => w.n === weeks[i].n)!
  ;(target as Plan['weeks'][number] & { type?: string }).type = 'deload'
  return forged
}

describe('INV-PLAN-DELOAD-PLACEMENT — one row per offence', () => {
  const plan = generateRulePlan(input, 'paid', '2026-09-28')

  it('a healthy plan emits none, which is why the duplication stayed invisible', () => {
    const v = validatePlan(plan, input).filter(x => x.code === 'INV-PLAN-DELOAD-PLACEMENT')
    expect(v).toHaveLength(0)
  })

  it('a deload opening a phase emits ONE row, not one per week', () => {
    const forged = withDeloadOpeningAPhase(plan)
    const rows = validatePlan(forged, input).filter(x => x.code === 'INV-PLAN-DELOAD-PLACEMENT')

    // Guard the guard: if the forge stopped reproducing the offence this test
    // would pass vacuously, which is the failure mode it exists to prevent.
    expect(rows.length, 'the forged plan must actually violate the rule').toBeGreaterThan(0)

    const weekCount = forged.weeks.filter(w => w.n >= 1).length
    expect(weekCount, 'a multi-week plan, or duplication could not show').toBeGreaterThan(4)

    // Before the fix this was `weekCount` rows (one per iteration of the
    // enclosing per-week loop) for a single offending week.
    const offendingWeeks = new Set(rows.map(r => r.week)).size
    expect(rows.length, `${rows.length} rows for ${offendingWeeks} offending week(s) across ${weekCount} weeks`)
      .toBe(offendingWeeks)
  })
})
