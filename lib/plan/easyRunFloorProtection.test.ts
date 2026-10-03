import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'
// TEST-CLOCK-PINSWEEP-01 — pinned, or nextMonday() walks this fixture into §44.
import { PINNED_PLAN_START_0907 } from './__fixtures__/pinnedPlanStart'

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
// ⚠️ RE-ANCHORED 2026-09-18 (§111), current_weekly_km 12 -> 16. The original 12km
// sample is now refused for a marathon (BaseVolumeError): 12km is at the base-build
// ceiling for this shape. 16km clears it and still reproduces the floor-protection
// case, because that is driven by the 30-minute weekday cap (max_weekday_mins),
// not the base volume — the cap still shrinks weekday easy runs to the distance
// floor. This test is about §82, not the base gate.
const LOW_VOLUME_MARATHON: GeneratorInput = {
  age: 35, race_name: 'Test', target_time: '0:45:00',
  injury_history: ['back'], race_distance_km: 42.2, race_date: '2027-02-06',
  current_weekly_km: 16, longest_recent_run_km: 6, days_available: 5,
  days_cannot_train: ['tue'], training_age: '<6mo', user_declared_level: 'intermediate',
  hard_session_relationship: 'neutral', max_weekday_mins: 30, goal: 'finish',
  resting_hr: 55, max_hr: 184, preferred_long_run_day: 'sun',
}

describe('CoachingPrinciples §82 — easy-run floor protection', () => {
  it('holds a cap-shrunk easy run at the floor instead of below it, and declares the trade', () => {
    const plan = generateRulePlan(LOW_VOLUME_MARATHON, 'trial', PINNED_PLAN_START_0907)
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
    const plan = generateRulePlan(raceWeekInput, 'trial', PINNED_PLAN_START_0907)
    const raceWeek = plan.weeks[plan.weeks.length - 1]
    expect(raceWeek.type).toBe('race')
    const shakeoutOverCap = Object.values(raceWeek.sessions).some(
      s => s && s.type === 'easy' && (s.duration_mins ?? 0) > GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS,
    )
    expect(shakeoutOverCap).toBe(false)
    expect(Object.values(raceWeek.sessions).some(s => s?.floor_protected)).toBe(false)
  })
})

/**
 * MWM-FLOOR-VALIDATOR-01 (2026-10-03) — §82 IS AN EXEMPTION FROM
 * INV-PLAN-MAX-WEEKDAY-MINS, AND THE CHECK DID NOT KNOW.
 *
 * `applyWeekdayMinsCap` has THREE ways to leave a weekday session over its cap:
 * the long run (§81), a structured session (§81), and §82's floor protection.
 * The validator mirrored the first two and not the third, so every plan where the
 * floor binds raised error-severity violations for doing exactly what the board
 * ratified. Measured: two live paid marathon plans at 19 and 46 violations, and
 * 10,096 across the sweep once a slow benchmark could reach the cohort.
 *
 * 🔴 WHY THE TESTS ABOVE DID NOT CATCH IT, AND THIS IS THE WHOLE LESSON.
 * `LOW_VOLUME_MARATHON` produces 3 floor-protected sessions and all three land at
 * EXACTLY 30 minutes against a 30-minute cap. The assertion above is
 * `toBeGreaterThanOrEqual(cap)`, which passes on the boundary, and the invariant
 * only fires STRICTLY over. So the test written for §82 had a fixture that could
 * not reach §82's failure — the population-excludes-the-case-at-risk class, inside
 * the guard for the principle itself.
 *
 * The gate is PACE: a 30-minute cap covers the 4 km floor only at 7:30/km, so the
 * floor binds for runners slower than that and for nobody faster. `SLOW_RUNNER`
 * below carries a benchmark that puts it the right side of that line, and the
 * first arm asserts the fixture STRICTLY exceeds — so this file cannot rot back
 * into the boundary case it was written to escape.
 */
const SLOW_RUNNER: GeneratorInput = {
  ...LOW_VOLUME_MARATHON,
  // HM 2:30 => easy pace well slower than 7:30/km, which is what makes the floor bind.
  benchmark: { type: 'race', distance_km: 21.1, time: '2:30:00' },
  current_weekly_km: 15, longest_recent_run_km: 9,
} as GeneratorInput

describe('§82 floor protection is an exemption the VALIDATOR shares (MWM-FLOOR-VALIDATOR-01)', () => {
  it('has a fixture that STRICTLY exceeds the cap — the arm the old fixture could not reach', () => {
    const plan = generateRulePlan(SLOW_RUNNER, 'paid', PINNED_PLAN_START_0907)
    const over = plan.weeks.flatMap(w => Object.values(w.sessions))
      .filter((s): s is NonNullable<typeof s> =>
        !!s?.floor_protected && (s.duration_mins ?? 0) > SLOW_RUNNER.max_weekday_mins!)
    // Not >= . If this ever reads 0 the rest of this file is vacuous.
    expect(over.length).toBeGreaterThan(0)
  })

  it('raises NO INV-PLAN-MAX-WEEKDAY-MINS for a floor-protected run over the cap', () => {
    const plan = generateRulePlan(SLOW_RUNNER, 'paid', PINNED_PLAN_START_0907)
    const mwm = validatePlan(plan, SLOW_RUNNER)
      .filter(v => v.code === 'INV-PLAN-MAX-WEEKDAY-MINS')
    expect(mwm).toEqual([])
  })

  it('does NOT take the stamp on trust — floor_protected away from the floor still fires', () => {
    const plan = generateRulePlan(SLOW_RUNNER, 'paid', PINNED_PLAN_START_0907)
    // §82's justification is that the session sits AT the floor. Move it off the
    // floor and the exemption must not apply, or the arm is a hole one boolean wide.
    const target = plan.weeks.flatMap(w => Object.values(w.sessions))
      .find((s): s is NonNullable<typeof s> => !!s?.floor_protected)
    expect(target).toBeTruthy()
    target!.distance_km = GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy + 1
    target!.duration_mins = SLOW_RUNNER.max_weekday_mins! + 20
    const mwm = validatePlan(plan, SLOW_RUNNER)
      .filter(v => v.code === 'INV-PLAN-MAX-WEEKDAY-MINS')
    expect(mwm.length).toBeGreaterThan(0)
  })

  it('stays narrow — an UNSTAMPED easy run over the cap still fires', () => {
    const plan = generateRulePlan(SLOW_RUNNER, 'paid', PINNED_PLAN_START_0907)
    const target = plan.weeks.flatMap(w => Object.values(w.sessions))
      .find((s): s is NonNullable<typeof s> => !!s?.floor_protected)
    expect(target).toBeTruthy()
    delete target!.floor_protected
    const mwm = validatePlan(plan, SLOW_RUNNER)
      .filter(v => v.code === 'INV-PLAN-MAX-WEEKDAY-MINS')
    expect(mwm.length).toBeGreaterThan(0)
  })
})
