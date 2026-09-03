import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const FROZEN_NOW = new Date('2026-09-03T12:00:00Z')
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

/**
 * CoachingPrinciples §82 (Coaching Board, 2026-09-03) — easy runs are
 * floor-protected against the weekday cap.
 *
 * `applyWeekdayMinsCap` used to scale an easy run's distance by
 * `cap / duration_mins` with no floor check. At `max_weekday_mins: 30` this
 * lands at 3.5km against the 4km MIN_SESSION_DISTANCE_KM.easy floor for a wide
 * swath of low-volume runners — baselined as 924 INV-PLAN-MIN-SESSION-SIZE
 * sweep violations under SWEEP-VISIBLE-01, misdiagnosed there as "unrelated to
 * the weekday cap". Replayed from that sweep's own SWEEP_EXPLAIN dump.
 */

// SWEEP_EXPLAIN=INV-PLAN-MIN-SESSION-SIZE npm run verify:sweep, first sample:
// week 3 wed — got 3.5, expected 4 (pre-fix).
const LOW_VOLUME_MARATHON: GeneratorInput = {
  age: 35, race_name: 'Test', target_time: '0:45:00',
  injury_history: ['back'], race_distance_km: 42.2, race_date: '2027-02-06',
  current_weekly_km: 12, longest_recent_run_km: 6, days_available: 5,
  days_cannot_train: ['tue'], training_age: '<6mo', user_declared_level: 'intermediate',
  hard_session_relationship: 'neutral', max_weekday_mins: 30, goal: 'finish',
  resting_hr: 55, max_hr: 184, preferred_long_run_day: 'sun',
}

describe('CoachingPrinciples §82 — easy-run floor protection', () => {
  it('holds a cap-shrunk easy run at the floor instead of below it, and declares the trade', () => {
    const plan = generateRulePlan(LOW_VOLUME_MARATHON, 'trial')
    const errors = validatePlan(plan, LOW_VOLUME_MARATHON).filter(v => v.severity === 'error')
    expect(errors).toEqual([])

    const floorProtected = plan.weeks.flatMap(w => Object.values(w.sessions))
      .filter((s): s is NonNullable<typeof s> => !!s?.floor_protected)
    expect(floorProtected.length).toBeGreaterThan(0)
    for (const s of floorProtected) {
      // Held exactly at the floor, never below it.
      expect(s.distance_km).toBe(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)
      // The cap is exceeded (rounding can occasionally land exactly on it) —
      // floor protection is not free.
      expect(s.duration_mins).toBeGreaterThanOrEqual(LOW_VOLUME_MARATHON.max_weekday_mins!)
    }

    // Recurs across enough weeks in this shape to trip the disclosure obligation.
    const floorProtectedWeeks = plan.weeks.filter(w =>
      Object.values(w.sessions).some(s => s?.floor_protected),
    ).length
    if (floorProtectedWeeks >= GENERATION_CONFIG.EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS) {
      expect(plan.meta.volume_profile).toBe('maintenance')
      expect(plan.meta.volume_constraint_note).toBeTruthy()
    }
  })

  it('never floor-protects a race-week shakeout — §30 taper intent, not a floor breach', () => {
    const raceWeekInput: GeneratorInput = {
      ...LOW_VOLUME_MARATHON, race_distance_km: 5, race_date: '2027-01-01',
      current_weekly_km: 10, days_cannot_train: ['tuesday', 'thursday', 'saturday'],
    }
    const plan = generateRulePlan(raceWeekInput, 'trial')
    const raceWeek = plan.weeks[plan.weeks.length - 1]
    expect(raceWeek.type).toBe('race')
    const shakeoutOverCap = Object.values(raceWeek.sessions).some(
      s => s && s.type === 'easy' && (s.duration_mins ?? 0) > GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS,
    )
    expect(shakeoutOverCap).toBe(false)
    expect(Object.values(raceWeek.sessions).some(s => s?.floor_protected)).toBe(false)
  })
})
