import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

/**
 * V1-volume-quality-split — the adjustment message must describe what actually
 * happened.
 *
 * The defect (fixed 2026-08-20): the message interpolated `curr.weekly_km`, but
 * that field is reassigned to the CORRECTED volume a few lines earlier. So the
 * engine trimmed 39km back to 32km and then reported:
 *
 *   "stepped volume up from 32 to 32 km (>5% bump)"
 *
 * — a sentence whose own numbers refute it. Claim/computation mismatch: the
 * engine did the right thing and described it wrongly. Silent, because nothing
 * reads `rule_adjustments` looking for arithmetic sense.
 *
 * Caught by scripts/trace-plan.ts, which is why that tool is committed.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// The audit's Task B profile — reliably triggers V1 in week 5.
const TASK_B: GeneratorInput = {
  race_date: '2026-11-30', race_distance_km: 10, goal: 'time_target',
  target_time: '0:44:59', days_available: 4, age: 43,
  current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
  injury_history: ['Left knee, posterior, recurring'],
  fitness_level: 'experienced', training_age: '2-5yr',
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('V1-volume-quality-split — the message matches the arithmetic', () => {
  it('reports the PRE-correction volume, not the corrected one', () => {
    const plan = generateRulePlan(TASK_B, 'paid', PLAN_START)
    const adj = (plan.meta.rule_adjustments ?? []).find(a => a.rule === 'V1-volume-quality-split')
    expect(adj, 'Task B must trigger V1 or this test proves nothing').toBeTruthy()

    const m = adj!.violation.match(/from (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?) km/)
    expect(m, `could not parse volumes out of: ${adj!.violation}`).toBeTruthy()

    const [from, to] = [Number(m![1]), Number(m![2])]

    // The whole point: a "stepped volume UP" claim must show an actual increase.
    // Pre-fix this was 32 → 32 and the assertion fails.
    expect(to, `"stepped volume up from ${from} to ${to}" is not an increase`).toBeGreaterThan(from)
  })

  it('the resolution reports the volume the week actually ended at', () => {
    const plan = generateRulePlan(TASK_B, 'paid', PLAN_START)
    const adj = (plan.meta.rule_adjustments ?? []).find(a => a.rule === 'V1-volume-quality-split')!
    const held = Number(adj.resolution.match(/Held weekly volume at (\d+(?:\.\d+)?) km/)![1])

    const week = plan.weeks.find(w => w.n === adj.weeks_affected[0])!
    expect(held).toBe(week.weekly_km)
  })
})
