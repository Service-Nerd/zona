import { describe, it, expect, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * ADR-020 Option A — composePlanWithFoundation is the single owner of
 * plan.weeks mutation post-generation. Covers every gapClass × decision
 * combination, and falsifies the specific historical bug CB-2 fixed once
 * already: a filter that silently discarded real violations
 * (v.code === 'INV-PLAN-FOUNDATION-BLOCK' kept only the foundation-specific
 * code and threw away INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS — see
 * foundationDayFitting.test.ts / the FOUNDATION-DAYS-01 incident).
 */

const PLAN_START = '2026-11-30'

const INPUT: GeneratorInput = {
  race_date: '2027-04-11', race_distance_km: 10, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4,
  age: 40, preferred_long_run_day: 'sun',
}

function mainPlan(): Plan {
  return generateRulePlan(INPUT, 'trial', PLAN_START)
}

// The '2026-11-30' passed above is only a MINIMUM bound — §44 prep-time
// pushes the engine's actual plan.meta.plan_start later (confirmed: this
// input lands on '2027-01-18', not the passed literal). Compute "today" as
// an offset from the ENGINE'S OWN plan_start, never a guessed literal date.
function daysBefore(planStart: string, days: number): string {
  return new Date(new Date(planStart).getTime() - days * 86_400_000)
    .toISOString().slice(0, 10)
}

describe('composePlanWithFoundation', () => {
  it("gapClass 'none' (<7 days) — no weeks added, plan unchanged", () => {
    const main = mainPlan()
    const today = daysBefore(main.meta.plan_start, 5)
    const { plan, gapClass } = composePlanWithFoundation(main, INPUT, today)
    expect(gapClass).toBe('none')
    expect(plan.weeks.some(w => w.n <= 0)).toBe(false)
    expect(plan.weeks).toBe(main.weeks)   // untouched, not even a new array
  })

  it("gapClass 'auto' (7-28 days) — weeks added without a decision", () => {
    const main = mainPlan()
    const today = daysBefore(main.meta.plan_start, 14)
    const { plan, gapClass } = composePlanWithFoundation(main, INPUT, today)
    expect(gapClass).toBe('auto')
    expect(plan.weeks.some(w => w.n <= 0)).toBe(true)
  })

  it("gapClass 'choice' (>28 days), no decision — weeks NOT added", () => {
    const main = mainPlan()
    const today = daysBefore(main.meta.plan_start, 45)
    const { plan, gapClass } = composePlanWithFoundation(main, INPUT, today)
    expect(gapClass).toBe('choice')
    expect(plan.weeks.some(w => w.n <= 0)).toBe(false)
    expect(plan.weeks).toBe(main.weeks)
  })

  it("gapClass 'choice', decision 'add' — weeks added", () => {
    const main = mainPlan()
    const today = daysBefore(main.meta.plan_start, 45)
    const { plan, gapClass } = composePlanWithFoundation(main, INPUT, today, 'add')
    expect(gapClass).toBe('choice')
    expect(plan.weeks.some(w => w.n <= 0)).toBe(true)
  })

  it.each(['skip', 'start_now'] as const)("gapClass 'choice', decision '%s' — weeks NOT added", (decision) => {
    const main = mainPlan()
    const today = daysBefore(main.meta.plan_start, 45)
    const { plan, gapClass } = composePlanWithFoundation(main, INPUT, today, decision)
    expect(gapClass).toBe('choice')
    expect(plan.weeks.some(w => w.n <= 0)).toBe(false)
  })

  it("decision 'add' in the 'none' band is a no-op — too close to add anything meaningful", () => {
    const main = mainPlan()
    const today = daysBefore(main.meta.plan_start, 5)
    const { plan, gapClass } = composePlanWithFoundation(main, INPUT, today, 'add')
    expect(gapClass).toBe('none')
    expect(plan.weeks.some(w => w.n <= 0)).toBe(false)
  })

  // Falsification (feedback_verification_must_reach_the_change): the old
  // client-side check filtered by invariant CODE
  // (v.code === 'INV-PLAN-FOUNDATION-BLOCK'), discarding real violations
  // landing on a foundation week under a DIFFERENT code — exactly how
  // FOUNDATION-DAYS-01 shipped invisibly. A clean generated plan has zero
  // violations either way, so this constructs a plan that ALREADY carries a
  // foundation week violating a blocked day, with a 'none' gap so
  // composePlanWithFoundation doesn't reconstruct anything — it must simply
  // validate what it's given, unfiltered. Manually confirmed to fail (red)
  // against a `.filter(v => v.code === 'INV-PLAN-FOUNDATION-BLOCK')`
  // reintroduced at the call site — see the ADR-020 commit for the check.
  it('violations are the FULL, unfiltered validatePlan output — nothing discarded', () => {
    const blockedInput: GeneratorInput = { ...INPUT, days_cannot_train: ['monday'] }
    const main = generateRulePlan(blockedInput, 'trial', PLAN_START)
    const brokenFoundationWeek: Plan['weeks'][number] = {
      n: 0, date: main.meta.plan_start, label: 'Foundation 1', theme: 'x',
      type: 'normal', phase: 'foundation',
      sessions: { mon: { type: 'easy', label: 'Easy run', detail: null, distance_km: 5, zone: 'Zone 2' } },
      long_run_hrs: null, weekly_km: 5,
    }
    const planWithBrokenWeek: Plan = { ...main, weeks: [brokenFoundationWeek, ...main.weeks] }
    const today = daysBefore(planWithBrokenWeek.meta.plan_start, 3)   // 'none' band
    const { gapClass, violations } = composePlanWithFoundation(planWithBrokenWeek, blockedInput, today)
    expect(gapClass).toBe('none')
    expect(violations).toEqual(validatePlan(planWithBrokenWeek, blockedInput))
    expect(violations.map(v => v.code)).toContain('INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS')
  })

  it('is pure — never throws, never logs, regardless of gapClass', () => {
    const main = mainPlan()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const days of [5, 14, 45]) {
      const today = daysBefore(main.meta.plan_start, days)
      expect(() => composePlanWithFoundation(main, INPUT, today, 'add')).not.toThrow()
    }
    expect(consoleSpy).not.toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
