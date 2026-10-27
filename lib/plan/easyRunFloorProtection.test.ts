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

// §82 Amendment 2 (S9-EASY-MINUTES-01): a held run lasts the day's limit, or EASY_FLOOR_HELD_MINS if the limit is
// shorter, so a held run can only exceed a limit UNDER 30 minutes. The wizard's smallest chip is 30, so this fixture
// uses 20 to keep the branch reachable; at 30 see the §82 Amendment 2 suite below.
const LOW_VOLUME_SUB30: GeneratorInput = { ...LOW_VOLUME_MARATHON, max_weekday_mins: 20 }

describe('CoachingPrinciples §82 — easy-run floor protection', () => {
  it('holds a cap-shrunk easy run at the floor instead of below it, and declares the trade', () => {
    const plan = generateRulePlan(LOW_VOLUME_SUB30, 'trial', PINNED_PLAN_START_0907)
    const errors = validatePlan(plan, LOW_VOLUME_SUB30).filter(v => v.severity === 'error')
    expect(errors).toEqual([])

    const floorProtected = plan.weeks.flatMap(w => Object.values(w.sessions))
      .filter((s): s is NonNullable<typeof s> => !!s?.floor_protected)
    expect(floorProtected.length).toBeGreaterThan(0)
    for (const s of floorProtected) {
      // Held AT the km floor, or (§82 Am. 2) below it at exactly EASY_FLOOR_HELD_MINS. Never shorter than either.
      const atKm = s.distance_km === GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy
      expect(atKm || s.duration_mins === GENERATION_CONFIG.EASY_FLOOR_HELD_MINS).toBe(true)
      // The cap is exceeded: floor protection is not free.
      expect(s.duration_mins).toBeGreaterThan(LOW_VOLUME_SUB30.max_weekday_mins!)
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
  // Under the wizard's 30-minute chip on purpose: §82 Am. 2 means a held run can only overrun a limit below 30.
  max_weekday_mins: 20,
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

  it('the held run is the LONGER of the limit and 30 minutes: cut to 25 on a 20-minute day, it fails (code review)', () => {
    const plan = generateRulePlan(SLOW_RUNNER, 'paid', PINNED_PLAN_START_0907)
    const target = plan.weeks.flatMap(w => Object.values(w.sessions))
      .find((s): s is NonNullable<typeof s> => !!s?.floor_protected
        && (s.distance_km ?? 9) < GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)
    expect(target).toBeTruthy()
    target!.duration_mins = 25   // over the 20-minute day, under the 30 the rule holds it at
    expect(validatePlan(plan, SLOW_RUNNER).some(v => v.code === 'INV-PLAN-MIN-SESSION-SIZE')).toBe(true)
  })

  it('§82 Am. 2 is not a blanket licence: a below-floor held run longer than 30 minutes still fires', () => {
    const plan = generateRulePlan(SLOW_RUNNER, 'paid', PINNED_PLAN_START_0907)
    const target = plan.weeks.flatMap(w => Object.values(w.sessions))
      .find((s): s is NonNullable<typeof s> => !!s?.floor_protected
        && (s.distance_km ?? 9) < GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)
    expect(target, 'the fixture must hold a run below the km floor').toBeTruthy()
    target!.duration_mins = GENERATION_CONFIG.EASY_FLOOR_HELD_MINS + 1
    expect(validatePlan(plan, SLOW_RUNNER).some(v => v.code === 'INV-PLAN-MAX-WEEKDAY-MINS')).toBe(true)
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

/**
 * §82 Amendment 2 (S9-EASY-MINUTES-01, Coaching Board re-sitting 2026-10-27) — at the wizard's real 30-minute limit a
 * slow runner's held easy run lasts the limit and no longer, below 4 km. Before, `SLOW_RUNNER` at 30 minutes was held at
 * 4 km, over the limit, every week the floor bound.
 */
const SLOW_RUNNER_30: GeneratorInput = { ...SLOW_RUNNER, max_weekday_mins: 30 } as GeneratorInput
const WEEKDAYS_ = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

describe('§82 Amendment 2 — at a 30-minute limit the held easy run is the limit', () => {
  const plan = generateRulePlan(SLOW_RUNNER_30, 'paid', PINNED_PLAN_START_0907)
  const weekdayEasy = plan.weeks.filter(w => w.type !== 'race').flatMap(w => WEEKDAYS_.map(d => w.sessions[d]))
    .filter((s): s is NonNullable<typeof s> => !!s && s.type === 'easy' && !/long/i.test(s.label))
  const held = weekdayEasy.filter(s => (s.distance_km ?? Infinity) < GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)

  it('reaches the case: easy runs below the km floor exist, each exactly at the limit', () => {
    expect(held.length).toBeGreaterThan(0)
    for (const s of held) expect(s.duration_mins).toBe(30)
  })
  it('no weekday easy run exceeds the limit, and none is stamped floor-protected', () => {
    for (const s of weekdayEasy) expect(s.duration_mins ?? 0).toBeLessThanOrEqual(30)
    expect(weekdayEasy.some(s => s.floor_protected)).toBe(false)
  })
  it('each week with a held run states the volume its sessions hold (the final cap pass restates it)', () => {
    let checked = 0
    for (const w of plan.weeks.filter(w => w.n > 0 && w.type !== 'race')) {
      const running = Object.values(w.sessions).filter((s): s is NonNullable<typeof s> =>
        !!s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train')
      if (!running.length || running.some(s => s.distance_km == null)) continue
      if (!running.some(s => s.type === 'easy' && (s.distance_km as number) < GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)) continue
      // `weekly_km` is a whole number by design (at a 60-minute limit this plan states 18 for 17.5), so within 0.5.
      expect(Math.abs(w.weekly_km - running.reduce((a, s) => a + (s.distance_km as number), 0)), `week ${w.n}`).toBeLessThanOrEqual(0.5)
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })
  it('the plan validates clean', () => {
    expect(validatePlan(plan, SLOW_RUNNER_30).filter(v => v.severity === 'error')).toEqual([])
  })
  it('🔴 falsified: a held run cut below the limit fails INV-PLAN-MIN-SESSION-SIZE', () => {
    const broken = JSON.parse(JSON.stringify(plan))
    const target = broken.weeks.flatMap((w: any) => WEEKDAYS_.map(d => w.sessions[d]))
      .find((s: any) => s?.type === 'easy' && (s.distance_km ?? 9) < GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)
    target.duration_mins = 25
    expect(validatePlan(broken, SLOW_RUNNER_30).some(v => v.code === 'INV-PLAN-MIN-SESSION-SIZE')).toBe(true)
  })
})
