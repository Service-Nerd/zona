import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * CoachingPrinciples §80 (HR-MAX-01 part 3, Coaching Board) — a finish-goal peak
 * long run's prescription IS time on feet, so it stays duration-anchored whatever
 * the runner's metric preference. §79 keys the default metric to experience, so a
 * finish-goal runner can now default to distance — this guard keeps §80 intact.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// HM finish-goal. Experienced enough to default to distance metric — the case the
// anchoring must survive.
const HM_FINISH: GeneratorInput = {
  race_date: '2026-12-14', race_distance_km: 21.1, goal: 'finish',
  days_available: 4, age: 40,
  current_weekly_km: 45, longest_recent_run_km: 18,
  training_age: '2-5yr', preferred_long_run_day: 'sun',
}

const anchored = (p: Plan) =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter(s => s && s.duration_anchored))

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§80 — finish-goal peak long run stays duration-anchored', () => {
  const plan = generateRulePlan(HM_FINISH, 'paid', PLAN_START)

  it('anchors at least one peak long run to duration', () => {
    expect(anchored(plan).length).toBeGreaterThan(0)
  })

  it('every anchored session keeps duration_mins and is duration-primary', () => {
    for (const s of anchored(plan)) {
      expect(s!.primary_metric).toBe('duration')
      expect(typeof s!.duration_mins).toBe('number')
      expect(s!.duration_mins!).toBeGreaterThan(0)
    }
  })

  it('carries distance as a secondary value (not stripped)', () => {
    // The runner can still see the distance; it is just not the headline.
    for (const s of anchored(plan)) {
      expect(typeof s!.distance_km).toBe('number')
    }
  })

  it('passes validatePlan (INV-PLAN-DURATION-ANCHORED-KEEPS-MINUTES)', () => {
    expect(validatePlan(plan, HM_FINISH).filter(v => v.severity === 'error')).toEqual([])
  })
})
