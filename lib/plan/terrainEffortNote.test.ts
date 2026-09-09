import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §40b Amendment 3 / Coaching Board CB-TERRAIN-01 (2026-09-09).
 *
 * The runner-environment `terrain` input (road/trail/mixed) was a PAID wizard step
 * subtitled "Affects pace targets" that the engine read for nothing (INERT-INPUTS-01).
 * The board VETOED a terrain→pace multiplier (§40b: do not invent a number the runner
 * cannot act on; trail pace swings too far with grade/footing) and wired terrain to an
 * effort-lead note instead: off-road, effort/HR leads and pace is a road reference.
 * `INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED` makes the wired effect un-droppable.
 */

const base = (terrain: GeneratorInput['terrain']): GeneratorInput => ({
  race_date: '2026-12-06', race_distance_km: 10, goal: 'time_target', target_time: '0:45:00',
  days_available: 4, age: 40, current_weekly_km: 35, longest_recent_run_km: 14,
  resting_hr: 50, max_hr: 186, preferred_long_run_day: 'sun', terrain,
  benchmark: { type: 'race', distance_km: 10, time: '0:49:00' },
} as GeneratorInput)

const noteViolations = (plan: Plan, input: GeneratorInput) =>
  validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-TERRAIN-EFFORT-NOTE-DECLARED')

describe('CB-TERRAIN-01 — terrain drives an effort-lead note, not a pace number', () => {
  for (const terrain of GENERATION_CONFIG.TERRAIN_EFFORT_GOVERNS) {
    it(`terrain '${terrain}' carries meta.terrain_effort_note and validates clean`, () => {
      const input = base(terrain)
      const plan = generateRulePlan(input, 'paid')
      expect(plan.meta.terrain_effort_note, 'effort-lead note stamped').toBeTruthy()
      // §40b: the note must NOT invent a pace number — it points to effort/HR + a road reference.
      expect(plan.meta.terrain_effort_note!.toLowerCase()).toContain('road reference')
      expect(noteViolations(plan, input)).toHaveLength(0)
    })
  }

  it("terrain 'road' is the pace-anchor baseline — no note, no violation", () => {
    const input = base('road')
    const plan = generateRulePlan(input, 'paid')
    expect(plan.meta.terrain_effort_note, 'road carries no effort-lead note').toBeFalsy()
    expect(noteViolations(plan, input)).toHaveLength(0)
  })

  it('the wired effect cannot silently vanish — a trail plan missing the note is an error', () => {
    const input = base('trail')
    const plan = generateRulePlan(input, 'paid')
    const forged = structuredClone(plan)
    delete (forged.meta as unknown as Record<string, unknown>).terrain_effort_note
    const found = noteViolations(forged, input)
    expect(found.length, 'missing note on trail terrain must be caught').toBeGreaterThan(0)
    expect(found[0].severity).toBe('error')
  })
})
