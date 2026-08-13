import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput } from '@/types/plan'

/**
 * INV-PLAN-MIN-SESSION-SIZE must exempt race-week shakeouts STRUCTURALLY, not by
 * label. The §30 race-week shakeouts are intentionally below the session-size
 * floor. The exemption used to key off `label.includes('shakeout')`; the AI
 * enricher rewrites session labels, so a renamed shakeout silently lost the
 * exemption, tripped the floor, and route.ts reverted the entire enriched plan
 * to rule copy (D-17 — logic must not depend on a display string).
 *
 * This is the deterministic reproduction: rename the shakeout (as the enricher
 * would) and assert the floor violation does NOT reappear.
 */

// Before planStart so prep-time + staleness are deterministic.
const FROZEN_NOW = new Date('2026-08-13T09:00:00Z')
const PLAN_START = '2026-08-17'

// Thesis persona: 10K, beginner volume, 3 days — produces a 3 km race-week
// shakeout (below the 4 km easy floor), which is exactly the exempted case.
const INPUT: GeneratorInput = {
  race_date: '2026-11-08', race_distance_km: 10, goal: 'time_target', target_time: '0:52:00',
  days_available: 3, age: 34, current_weekly_km: 15, longest_recent_run_km: 7,
  resting_hr: 62, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:58:00' },
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

function minSizeViolations(plan: ReturnType<typeof generateRulePlan>) {
  return validatePlan(plan, INPUT).filter(v => v.code === 'INV-PLAN-MIN-SESSION-SIZE')
}

describe('INV-PLAN-MIN-SESSION-SIZE — structural shakeout exemption', () => {
  it('the generated race-week shakeout is below the floor but is exempt', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const raceWeek = plan.weeks.find(w => w.type === 'race')!
    expect(raceWeek).toBeTruthy()

    // Confirm the precondition: at least one race-week easy session sits below
    // the 4 km easy floor (the shakeout). If this stops being true the test is
    // no longer exercising the exemption.
    const subFloor = Object.values(raceWeek.sessions)
      .filter(s => s && s.type === 'easy' && s.distance_km != null && s.distance_km < 4)
    expect(subFloor.length).toBeGreaterThan(0)

    expect(minSizeViolations(plan)).toEqual([])
  })

  it('stays exempt after the enricher rewrites the shakeout label (the regression)', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    const raceWeek = plan.weeks.find(w => w.type === 'race')!

    // Simulate enrichment: strip the "shakeout" token from every race-week easy
    // label. Pre-fix, the label-coupled exemption vanished here and the floor
    // check fired, reverting the enriched plan.
    for (const s of Object.values(raceWeek.sessions)) {
      if (s && s.type === 'easy') s.label = 'Pre-race primer'
    }

    expect(minSizeViolations(plan)).toEqual([])
  })

  it('still flags a genuine sub-floor easy session outside the race week', () => {
    const plan = generateRulePlan(INPUT, 'paid', PLAN_START)
    // Force a real violation on a non-race build week to prove the check is live.
    const buildWeek = plan.weeks.find(w => w.type !== 'race' && Object.values(w.sessions).some(s => s?.type === 'easy'))!
    const easy = Object.values(buildWeek.sessions).find(s => s?.type === 'easy')!
    easy.distance_km = 2   // below the 4 km easy floor, non-race week

    const hits = minSizeViolations(plan)
    expect(hits.some(v => v.week === buildWeek.n)).toBe(true)
  })
})
