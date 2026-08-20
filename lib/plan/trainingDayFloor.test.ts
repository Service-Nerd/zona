import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §52b / INPUT-FLOOR-01 — a training day must be able to carry a real session.
 *
 * A runner on 12km a week who selects seven days was given seven ~1.7km jogs:
 * the quality session fell under MIN_SESSION_DISTANCE_KM and the long run was
 * barely longer than the rest. Nothing in the week did anything.
 *
 * THE QUESTION AS FILED WAS WRONG, which is the finding worth keeping. It was
 * filed as "minimum weekly volume per race distance". Held against weekly volume
 * alone, or against race distance alone, the signal is FLAT ZERO. It only
 * appears in the interaction — sub-floor sessions run at 13% below 2 km per
 * training day, 7% at 2-3, and zero at 3+.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-04-27'

const LOW_VOLUME_MANY_DAYS: GeneratorInput = {
  race_date: '2026-07-06', race_distance_km: 5, goal: 'time_target',
  target_time: '0:25:00', age: 35, days_available: 7,
  current_weekly_km: 12, longest_recent_run_km: 6,
  fitness_level: 'experienced', injury_history: [],
  resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
}

const runsPerWeek = (p: Plan) =>
  p.weeks.filter(w => w.type !== 'race')
    .map(w => Object.values(w.sessions).filter(s => s && s.type !== 'rest').length)

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§52b — fewer days, real sessions', () => {
  it('12km a week does not become seven jogs', () => {
    const plan = generateRulePlan(LOW_VOLUME_MANY_DAYS, 'paid', PLAN_START)
    expect(Math.max(...runsPerWeek(plan)),
      'a 12km week cannot fill seven training days').toBeLessThan(7)
  })

  it('every placed run clears the easy floor', () => {
    const plan = generateRulePlan(LOW_VOLUME_MANY_DAYS, 'paid', PLAN_START)
    for (const w of plan.weeks) {
      for (const s of Object.values(w.sessions)) {
        if (!s || s.type === 'rest' || s.type === 'strength') continue
        if (s.distance_km == null) continue
        expect(s.distance_km, `W${w.n} ${s.label} is ${s.distance_km}km`)
          .toBeGreaterThanOrEqual(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)
      }
    }
  })

  it('the floor is the LARGEST session floor, not the smallest', () => {
    // A day must carry the biggest thing that might land on it. Set to the easy
    // floor (4) first; measurement showed the quality session then landed under
    // its own 5km floor, and moving to 5 cleared a further 114 sub-floor
    // sessions. The day is sized for its worst case.
    expect(GENERATION_CONFIG.MIN_KM_PER_TRAINING_DAY)
      .toBe(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.quality)
    expect(GENERATION_CONFIG.MIN_KM_PER_TRAINING_DAY)
      .toBeGreaterThanOrEqual(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.easy)
  })

  it('never drops below 3 days — that is §52 territory', () => {
    const tiny = { ...LOW_VOLUME_MANY_DAYS, current_weekly_km: 5, longest_recent_run_km: 3 }
    const plan = generateRulePlan(tiny, 'paid', PLAN_START)
    const runs = runsPerWeek(plan).filter(n => n > 0)
    expect(Math.max(...runs)).toBeGreaterThanOrEqual(3)
  })

  it('a runner with enough volume keeps all their days', () => {
    // Guards the blast radius: this must not quietly shrink normal plans.
    const ample = { ...LOW_VOLUME_MANY_DAYS, current_weekly_km: 50, longest_recent_run_km: 18, days_available: 5 }
    const plan = generateRulePlan(ample, 'paid', PLAN_START)
    expect(Math.max(...runsPerWeek(plan))).toBe(5)
  })

  it('does not override life-first — availability is still respected', () => {
    // §18: the runner said 7 days. We decline to SPREAD 12km across them; we do
    // not hand a well-fuelled runner fewer days than they asked for.
    const ample = { ...LOW_VOLUME_MANY_DAYS, current_weekly_km: 60, longest_recent_run_km: 20 }
    const plan = generateRulePlan(ample, 'paid', PLAN_START)
    expect(Math.max(...runsPerWeek(plan)))
      .toBe(GENERATION_CONFIG.MAX_TRAINING_DAYS_PER_WEEK)   // §64 caps at 6, not this rule
  })
})
