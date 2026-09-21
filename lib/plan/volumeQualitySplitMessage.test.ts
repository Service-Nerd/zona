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

// The audit's Task B profile — triggers V1 in week 6, against a LOADING week.
const TASK_B: GeneratorInput = {
  // RE-DATED 2026-09-16 (§97 Am., LONG-RUNWAY-EARNS-PLAN-01). It used to say
  // 2026-11-30, which gave 13 weeks AVAILABLE and was silently truncated to 12 by
  // the old `idealWeeks` cap. Now that surplus weeks become plan weeks, that same
  // date builds 13 and the quality rotation lands on different catalogue rows.
  //
  // ⚠️ RE-DATED AGAIN 2026-09-21 (MKT-PLAN-SHAPE-01), 2026-11-23 -> 2026-12-09,
  // AND THE REASON MATTERS MORE THAN THE DATE. At 2026-11-23 this fixture's first
  // quality week (5) fell immediately after the base phase's DELOAD, and V1 fired
  // because it compared a build week against a recovery week — which is the exact
  // defect fixed that day. The fixture chosen in August to prove V1's message was
  // honest was itself an instance of V1 firing wrongly, and the test could not see
  // that because it only ever asked whether the SENTENCE was arithmetically
  // consistent, never whether the INTERVENTION was warranted.
  //
  // 2026-12-09 is a 14-week 10K whose first quality week (6) follows a LOADING
  // week (47 km) and genuinely steps up from it (47 -> 50, +6%), so V1 fires for
  // the reason it exists. `expect(adj).toBeTruthy()` below is what caught the
  // change; it is the assertion that makes this test worth having.
  race_date: '2026-12-09', race_distance_km: 10, goal: 'time_target',
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

  // MKT-PLAN-SHAPE-01 — V1 compares against the last LOADING week, never a
  // recovery week. Asserted on the produced plan rather than by reading the
  // producer's own variable, so it is a statement about the runner's plan and
  // not a restatement of the implementation.
  it('the week V1 measures against is one the runner actually loaded', () => {
    const plan = generateRulePlan(TASK_B, 'paid', PLAN_START)
    const adj = (plan.meta.rule_adjustments ?? []).find(a => a.rule === 'V1-volume-quality-split')!
    const from = Number(adj.violation.match(/from (\d+(?:\.\d+)?) to /)![1])

    const idx = plan.weeks.findIndex(w => w.n === adj.weeks_affected[0])
    const reference = plan.weeks.slice(0, idx).reverse()
      .find(w => w.type !== 'deload' && w.type !== 'race')!

    expect(reference.type, 'V1 must not hold a build week flat against a recovery week').not.toBe('deload')
    expect(from, `V1 reported "${from} km" but the last loading week was ${reference.weekly_km} km`)
      .toBe(reference.weekly_km)
  })
})
