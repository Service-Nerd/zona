import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * INTENSITY-FOUNDATION-BLIND-01 (2026-09-09).
 *
 * `INV-PLAN-INTENSITY-DISTRIBUTION` (§1) counts running sessions off `plan.weeks`,
 * and `validatePlan` runs twice on different objects (the §91 note in ruleEngine):
 * once on the BARE plan inside `generateRulePlan` (`ruleEngine.ts:5814`, before
 * `composePlanWithFoundation` prepends the §57 foundation weeks) and again on the
 * ASSEMBLED plan. Foundation weeks (n <= 0) are all-easy running, so they enlarge
 * the §1 denominator and lower the quality share — the bare plan therefore reads a
 * stricter, WRONG verdict than the runner's actual plan. It console.error'd a false
 * positive in prod and THREW in dev/test on plans that ship clean.
 *
 * Fix: the check DEFERS when a block is pending (`foundation_weeks_planned > 0`) but
 * not yet present (no n <= 0 week) — the assembled-plan check owns the verdict. When
 * no block is coming (== 0), the bare plan IS the delivered plan and the check binds
 * in full. Because `composePlanWithFoundation` uses the same `plannedFoundationWeeks`
 * as generation, `fwp > 0` on a DELIVERED plan always coincides with the weeks being
 * present — so the defer never masks a real delivered breach; it only skips the
 * transient mid-generation state.
 *
 * AMENDED by INTENSITY-FOUNDATION-BLIND-02 (2026-09-10). The last sentence above
 * was true but incomplete, and the gap it left was live: `fwp > 0` is not the only
 * state in which a block is coming. On the >28-day 'choice' band
 * `plannedFoundationWeeks` returns 0 unless the decision is ALREADY 'add', and on
 * that band the decision arrives later from POST /api/generate-plan/foundation —
 * so a plan is 0-weeks-planned at generation and 3-weeks-delivered, the defer
 * never fired, and the false positive this file was written to kill survived
 * there. The defer now also covers `foundation_decision_pending`, and ends at
 * `foundation_composed` so declining the block cannot leave §1 permanently
 * unchecked. See intensityFoundationBlindChoice.test.ts.
 *
 * The cases below still hold as written — they construct meta explicitly and are
 * scoped to the fwp axis.
 */

const TENK_INPUT: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
}

/** Build a minimal over-ceiling 10K plan: 10 quality of 20 running = 50% >> 25%. */
function overCeilingPlan(fwp: number, foundationWeeks = 0): Plan {
  const easy = { type: 'easy', label: 'Easy', distance_km: 5, zone: 'Zone 2', hr_target: '<145' }
  const qual = { type: 'quality', label: 'Threshold', distance_km: 5, zone: 'Zone 3', hr_target: '150-160' }
  const weeks: Week[] = []
  // 10 build weeks, each 1 quality + 1 easy → 10 quality / 20 running.
  for (let n = 1; n <= 10; n++) {
    weeks.push({ n, phase: 'build', sessions: { mon: qual, thu: easy } } as unknown as Week)
  }
  // Optional all-easy foundation weeks (n <= 0) that a delivered plan would carry.
  for (let i = 0; i < foundationWeeks; i++) {
    weeks.unshift({ n: -i, phase: 'foundation', sessions: { mon: easy, thu: easy } } as unknown as Week)
  }
  return {
    weeks,
    meta: { volume_profile: 'build', foundation_weeks_planned: fwp },
  } as unknown as Plan
}

const intensityViolations = (plan: Plan) =>
  validatePlan(plan, TENK_INPUT).filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')

describe('INTENSITY-FOUNDATION-BLIND-01 — §1 is measured on the delivered plan', () => {
  it('DELIVERED plan with no block (fwp = 0) — the check binds and a real breach fires', () => {
    // This is the INTENSITY-LONGDIST-LOWDAY-01 detection path: no foundation is
    // coming, so the bare plan IS what the runner gets. The ceiling must bite.
    const found = intensityViolations(overCeilingPlan(0))
    expect(found.length, 'no block → check binds on the bare/delivered plan').toBeGreaterThan(0)
    expect(found[0].message).toContain('above the 10K ceiling')
  })

  it('BARE plan with a block PENDING (fwp > 0, no n<=0 week) — deferred, no false positive', () => {
    // The transient mid-generation state. The block will enlarge the denominator;
    // the assembled-plan check owns the verdict. Firing here is the false positive
    // that threw in dev/test on plans that ship clean.
    const found = intensityViolations(overCeilingPlan(3))
    expect(found.length, 'block pending → defer to the assembled-plan check').toBe(0)
  })

  it('ASSEMBLED plan (fwp > 0, foundation weeks PRESENT) — the check binds again', () => {
    // Once the weeks exist in plan.weeks the plan is delivered; the guard must let
    // the check run. Here the 3 all-easy weeks (6 easy runs) still leave 10/26 =
    // 38% over the ceiling, so it correctly fires — proving the defer is scoped to
    // the pending state, not a permanent exemption for any plan with fwp > 0.
    const found = intensityViolations(overCeilingPlan(3, 3))
    expect(found.length, 'foundation present → delivered → check binds').toBeGreaterThan(0)
  })
})
