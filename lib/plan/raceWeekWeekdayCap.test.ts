import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

/**
 * ENRICH-ATTRIB-01 / INV-PLAN-MAX-WEEKDAY-MINS — race week honours the runner's
 * stated weekday time limit.
 *
 * The race-week branch of `buildWeekSessions` returns early and so never reached
 * the shared `max_weekday_mins` pass at the end of the function. Race-week
 * shakeouts are bounded only by RACE_WEEK_SHAKEOUT_MAX_MINS (35), so a runner
 * who told us 30 minutes was their weekday ceiling got a 35-minute weekday
 * shakeout — a life-first violation, soft-degraded to console.error in prod.
 *
 * It shipped twice on 2026-09-02 and took the AI enrichment layer down with it:
 * the post-enrich re-validation read the engine's own violation as one the
 * enricher had introduced and discarded every enriched trial plan.
 *
 * Both prod inputs are replayed verbatim below from their persisted
 * `meta.generator_input`.
 */

const FROZEN_NOW = new Date('2026-09-02T16:30:00Z')
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

// Replayed byte-for-byte from plans 731f2878 and c29db5d6 (prod, 2026-09-02).
const HYDE_PARK: GeneratorInput = {
  age: 52, goal: 'finish', terrain: 'mixed',
  benchmark: { time: '30:00', type: 'tt_30min', distance_km: 3, benchmark_date: '2026-08-29' },
  race_date: '2027-07-11', race_name: 'Hyde Park 5k run',
  training_age: '<6mo', days_available: 4, injury_history: ['shin splints'],
  max_weekday_mins: 30, race_distance_km: 5, current_weekly_km: 30,
  days_cannot_train: ['tuesday', 'thursday', 'saturday'],
  user_declared_level: 'beginner', longest_recent_run_km: 5,
  preferred_long_run_day: 'sun', hard_session_relationship: 'neutral',
}

const NEW_YEAR_5K: GeneratorInput = {
  age: 50, goal: 'finish', terrain: 'mixed',
  race_date: '2027-01-01', training_age: '<6mo', days_available: 4,
  injury_history: ['knee'], max_weekday_mins: 30, race_distance_km: 5,
  current_weekly_km: 10, days_cannot_train: ['tuesday', 'thursday', 'saturday'],
  user_declared_level: 'beginner', longest_recent_run_km: 5,
  preferred_long_run_day: 'sun', hard_session_relationship: 'avoid',
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('INV-PLAN-MAX-WEEKDAY-MINS — race week', () => {
  it.each([
    ['731f2878 — Hyde Park 5k', HYDE_PARK],
    ['c29db5d6 — 5k 2027-01-01', NEW_YEAR_5K],
  ])('%s generates with no invariant violations', (_name, input) => {
    // generateRulePlan throws on error-severity violations under NODE_ENV=test,
    // so a regression fails here first. Asserted explicitly anyway, because the
    // throw is environment-dependent and this contract is not.
    const plan = generateRulePlan(input, 'trial')
    const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
    expect(errors).toEqual([])
  })

  it('caps a race-week weekday shakeout at the runner stated limit, not at 35', () => {
    // The shakeout cap (35) is deliberately above this runner's limit (30), so
    // the two constraints genuinely conflict and life-first must win.
    expect(GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS).toBeGreaterThan(30)

    const plan = generateRulePlan(HYDE_PARK, 'trial')
    const raceWeek = plan.weeks[plan.weeks.length - 1]
    expect(raceWeek.type).toBe('race')

    const weekdaySessions = WEEKDAYS
      .map(d => raceWeek.sessions?.[d])
      .filter((s): s is NonNullable<typeof s> => !!s && s.type !== 'race')

    expect(weekdaySessions.length).toBeGreaterThan(0)
    for (const s of weekdaySessions) {
      expect(s.duration_mins ?? 0).toBeLessThanOrEqual(30)
    }
  })

  it('leaves the race itself uncapped — it is a fixed external event', () => {
    const plan = generateRulePlan(NEW_YEAR_5K, 'trial')
    const raceWeek = plan.weeks[plan.weeks.length - 1]
    const race = Object.values(raceWeek.sessions ?? {}).find(s => s?.type === 'race')

    expect(race).toBeTruthy()
    // A 5k race on a Friday would otherwise be trimmed to the 30-minute cap.
    expect(race!.distance_km).toBe(5)
  })

  it('keeps the stride note on the shortened shakeout', () => {
    // §30 — the shakeout exists for neuromuscular sharpness. Shortening it must
    // not silently drop the thing that makes it worth doing.
    const plan = generateRulePlan(HYDE_PARK, 'trial')
    const raceWeek = plan.weeks[plan.weeks.length - 1]
    const notes = Object.values(raceWeek.sessions ?? {})
      .flatMap(s => s?.coach_notes ?? [])
      .filter((n): n is string => typeof n === 'string')

    expect(notes.some(n => n.includes('strides'))).toBe(true)
  })
})
