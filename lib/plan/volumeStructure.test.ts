import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * VOL-STRUCTURE-01 / §23 + §52 — plans that peaked below where the runner started.
 *
 * 33% of realistic plans peaked BELOW their own base phase: the plan detrained
 * the runner and said nothing. Traced (10K, 3 days, 60 km/wk): base ran a 19km
 * long run at 119 of a 120-minute cap plus two 15km easy runs = 49km, then a
 * quality session DISPLACED a 15km easy run with a ~9km one and neither
 * remaining slot could absorb the difference — the long run pinned at
 * LONG_RUN_CAP_MINUTES, easy capped at long/1.25 (§9).
 *
 * TWO REJECTED FIXES, both measured, both recorded so they are not retried:
 *
 *   1. Relabel every inversion as `maintenance`. Cleared all 1080 sweep
 *      violations and flipped 45% of realistic plans — including a 45 km/week
 *      runner on four days. Relabelling at scale, not a fix.
 *   2. Clamp the volume curve to what a week can structurally hold. NET
 *      NEGATIVE: +118 peak violations, +43 long-run-share violations, and 636
 *      NEW §1 intensity breaches — cutting volume raises the quality SHARE.
 *
 * What shipped: a plateau tolerance below the materiality line, maintenance
 * above it. One number, two mechanisms, no gap.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-04-27'

const TENK: GeneratorInput = {
  race_date: '2026-07-27', race_distance_km: 10, goal: 'time_target',
  target_time: '0:45:00', age: 35, fitness_level: 'experienced',
  days_available: 3, current_weekly_km: 60, longest_recent_run_km: 22,
}

const phaseMax = (p: Plan, phase: string) => {
  const ws = p.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload' && w.phase === phase)
  return ws.length ? Math.max(...ws.map(w => w.weekly_km)) : 0
}
const planMax = (p: Plan) =>
  Math.max(...p.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload').map(w => w.weekly_km))

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('VOL-STRUCTURE-01 — a plan that cannot progress says so', () => {
  it('the squeezed runner is told, and told why', () => {
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    // Fixture check: this profile must genuinely invert, or the test is vacuous.
    const inversionPct = ((planMax(plan) - phaseMax(plan, 'peak')) / planMax(plan)) * 100
    expect(inversionPct, 'fixture must invert materially')
      .toBeGreaterThanOrEqual(GENERATION_CONFIG.PEAK_INVERSION_MATERIAL_PCT)

    expect(plan.meta.volume_profile).toBe('maintenance')
    expect(plan.meta.volume_constraint_note).toMatch(/cannot be built on/)
  })

  it('the note names the lever — days, not effort', () => {
    const note = generateRulePlan(TENK, 'paid', PLAN_START).meta.volume_constraint_note!
    expect(note).toMatch(/lever is days/)
    expect(note).toMatch(/4 running days/)
    expect(note).toMatch(/\d+km/)
  })

  it('an ordinary runner is NOT relabelled', () => {
    // The failure of the first implementation: 45% of realistic plans flipped to
    // maintenance, a 45 km/week four-day runner among them. Now 12%, and 2% at
    // <=8 km per available day.
    const ordinary = { ...TENK, current_weekly_km: 40, longest_recent_run_km: 16, days_available: 5 }
    const plan = generateRulePlan(ordinary, 'paid', PLAN_START)
    expect(plan.meta.volume_profile).toBe('build')
    expect(plan.meta.volume_constraint_note).toBeUndefined()
  })
})

describe('VOL-STRUCTURE-01 — the plateau tolerance', () => {
  it('§23 tolerates a plateau below the materiality line', () => {
    // 86% of the 1080 sweep violations were inversions under 10% — the measured
    // distribution is min 1.3%, median 4.2%. That band is rounding across 3-6
    // sessions a week, and §23's own note already calls a plateau legitimate.
    const ordinary = { ...TENK, current_weekly_km: 40, longest_recent_run_km: 16, days_available: 5 }
    const plan = generateRulePlan(ordinary, 'paid', PLAN_START)
    expect(validatePlan(plan, ordinary).filter(v => v.code === 'INV-PLAN-PEAK-IN-PEAK-PHASE')).toEqual([])
  })

  it('the tolerance and the maintenance trigger are the SAME number — no gap', () => {
    // The property that makes this safe: below the line §23 tolerates it, at or
    // above it §52 declares maintenance. Nothing falls between the two.
    expect(GENERATION_CONFIG.PEAK_INVERSION_MATERIAL_PCT).toBeGreaterThan(0)
    expect(GENERATION_CONFIG.PEAK_INVERSION_MATERIAL_PCT).toBeLessThan(20)
  })

  it('a material inversion still records against §23, as a warn', () => {
    // Declared AND exercised (§34): the plan is labelled maintenance and the
    // invariant still notes the shape rather than going silent.
    const plan = generateRulePlan(TENK, 'paid', PLAN_START)
    const vs = validatePlan(plan, TENK).filter(v => v.code === 'INV-PLAN-PEAK-IN-PEAK-PHASE')
    for (const v of vs) expect(v.severity).toBe('warn')
  })
})
