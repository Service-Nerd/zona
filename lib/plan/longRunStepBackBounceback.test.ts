import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §45 — the long-run progression cap and the step-back bounceback.
 *
 * TWO DEFECTS, one cause. `applyLongRunStepBacks` deliberately cuts every Nth
 * BUILD long run, in a week that is NOT a deload. The cap ran BEFORE it, so it
 * never saw the sequence the runner actually gets — and the week following a
 * step-back became a large jump that nothing re-checked. All 430 remaining
 * sweep violations of this code were that ordering.
 *
 * Reordering alone would have been worse than the bug. §45 exempts a post-DELOAD
 * bounceback because returning to a distance covered two weeks ago is not a
 * spike — chronic load has not moved — but it knew nothing about step-backs. Cap
 * after the step-backs without that exemption and every bounceback is clamped,
 * ratcheting the long run permanently down: the same fatal arithmetic D-21
 * records for volume deloads, where "the first organic user's 14-week plan
 * peaked in week 3".
 *
 * So: recognise the step-back, THEN reorder. Engine and invariant detect it the
 * same structural way (the previous week's long run is shorter than the one
 * before it) rather than re-deriving the cadence, so they cannot drift.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-04-27'

const MARATHON: GeneratorInput = {
  race_date: '2026-09-07', race_distance_km: 42.2, goal: 'finish',
  age: 35, days_available: 5, current_weekly_km: 60, longest_recent_run_km: 22,
  fitness_level: 'experienced', injury_history: [],
  resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
}

const longRuns = (p: Plan) =>
  p.weeks.map(w => {
    const lr = Object.values(w.sessions).find(s => s && isLongRun(s))
    return lr?.distance_km ?? 0
  })

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§45 — step-backs and their bouncebacks', () => {
  it('the plan contains step-backs — otherwise this proves nothing', () => {
    // Fixture guard. If the cadence changes and step-backs stop appearing, the
    // tests below would pass vacuously.
    const lrs = longRuns(generateRulePlan(MARATHON, 'paid', PLAN_START)).filter(x => x > 0)
    const dips = lrs.slice(1).filter((km, i) => km < lrs[i]).length
    expect(dips, 'fixture must contain long-run step-backs').toBeGreaterThan(1)
  })

  it('no §45 violation survives generation', () => {
    const plan = generateRulePlan(MARATHON, 'paid', PLAN_START)
    expect(validatePlan(plan, MARATHON).filter(v => v.code === 'INV-PLAN-LR-PROGRESSION-CAP')).toEqual([])
  })

  it('the long run still PROGRESSES — the bounceback is not clamped', () => {
    // The failure mode of a naive reorder: clamping every bounceback ratchets
    // the long run down and the plan peaks in week 3 (D-21).
    const lrs = longRuns(generateRulePlan(MARATHON, 'paid', PLAN_START)).filter(x => x > 0)
    const firstThird = Math.max(...lrs.slice(0, Math.floor(lrs.length / 3)))
    const peak = Math.max(...lrs)
    expect(peak, 'the long run must grow well beyond its opening weeks')
      .toBeGreaterThan(firstThird * 1.15)
  })

  it('a bounceback returns to roughly the pre-step-back distance', () => {
    const lrs = longRuns(generateRulePlan(MARATHON, 'paid', PLAN_START))
    const tol = 1 + GENERATION_CONFIG.LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT / 100
    for (let i = 2; i < lrs.length; i++) {
      const [prevPrev, prev, curr] = [lrs[i - 2], lrs[i - 1], lrs[i]]
      if (!prevPrev || !prev || !curr) continue
      if (prev >= prevPrev) continue          // not a step-back
      // After a dip, the return must not overshoot the pre-dip distance.
      expect(curr, `W${i + 1} overshot its pre-step-back distance`)
        .toBeLessThanOrEqual(Math.max(prevPrev * tol, prev + GENERATION_CONFIG.LONG_RUN_PROGRESSION_CAP_ABS_KM) + 0.01)
    }
  })

  it('engine and invariant agree — neither flags what the other allows', () => {
    // They detect a step-back the same structural way on purpose. If one is
    // changed without the other, this fails.
    for (const input of [MARATHON, { ...MARATHON, days_available: 3, current_weekly_km: 40 }]) {
      const plan = generateRulePlan(input, 'paid', PLAN_START)
      expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-LR-PROGRESSION-CAP')).toEqual([])
    }
  })
})
