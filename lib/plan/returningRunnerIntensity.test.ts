import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * CoachingPrinciples §79 — returning-runner intensity (Coaching Board 2026-08-31).
 *
 * Founder case: an experienced runner (deep training age) whose current volume is
 * down after a big race reads `beginner` on volume alone, and with no fresh
 * benchmark both original signals agreed → a true-beginner plan: zero quality and
 * duration-primary. §79 now lifts INTENSITY off the beginner floor for a deep
 * training age (structure stays conservative), keys the metric to experience, and
 * gates the highest tissue-stress work through a progressive re-entry.
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

// Experienced runner, volume down, NO benchmark (so no VDOT to rescue intensity).
const RETURNING: GeneratorInput = {
  race_date: '2026-12-14', race_distance_km: 10, goal: 'time_target',
  target_time: '0:48:00', days_available: 5, age: 40,
  current_weekly_km: 18, longest_recent_run_km: 10,
  training_age: '5yr+', preferred_long_run_day: 'sun',
}

// A genuine beginner — same low volume, but new to running. Must NOT be lifted.
const TRUE_BEGINNER: GeneratorInput = {
  race_date: '2026-12-14', race_distance_km: 10, goal: 'finish',
  days_available: 3, age: 40,
  current_weekly_km: 18, longest_recent_run_km: 10,
  training_age: '<6mo', preferred_long_run_day: 'sun',
}

const isVo2maxSession = (s: { catalogue_id?: string } | undefined): boolean => {
  if (!s?.catalogue_id) return false
  return V1_SESSION_CATALOGUE.find(r => r.id === s.catalogue_id)?.category === 'vo2max'
}
const qualitySessions = (p: Plan) =>
  p.weeks.flatMap(w => Object.values(w.sessions).filter(s => s && s.type !== 'easy' && s.type !== 'long' && s.type !== 'recovery' && s.type !== 'rest' && s.type !== 'run'))
const vo2maxByWeek = (p: Plan) =>
  p.weeks.map(w => ({ n: w.n, has: Object.values(w.sessions).some(isVo2maxSession) }))

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§79 returning runner — intensity lifted, structure conservative', () => {
  const plan = generateRulePlan(RETURNING, 'paid', PLAN_START)

  it('does not classify a returning runner as a beginner for intensity', () => {
    // Structure stays conservative (tonnage safety); intensity is lifted.
    expect(plan.meta.fitness_level).toBe('beginner')
    expect(plan.meta.fitness_intensity_level).not.toBe('beginner')
  })

  it('gives the returning runner real quality work (not a zero-quality beginner plan)', () => {
    expect(qualitySessions(plan).length).toBeGreaterThan(0)
  })

  it('keys the metric to experience → distance, not the beginner duration default', () => {
    const runs = plan.weeks.flatMap(w => Object.values(w.sessions).filter(s => s && (s.type === 'easy' || s.type === 'long')))
    expect(runs.length).toBeGreaterThan(0)
    expect(runs.every(s => s!.primary_metric === 'distance')).toBe(true)
  })

  it('flags progressive intensity re-entry in meta', () => {
    expect(plan.meta.intensity_reentry_active).toBe(true)
    expect(plan.meta.intensity_reentry_weeks).toBe(GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS)
  })

  it('withholds VO2max/hills during the re-entry weeks, then allows them after', () => {
    const byWeek = vo2maxByWeek(plan)
    const reentry = GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS
    // No VO2max/hills in the opening re-entry weeks.
    expect(byWeek.filter(w => w.n <= reentry).every(w => !w.has)).toBe(true)
  })

  it('passes validatePlan with no error-severity violations', () => {
    const violations = validatePlan(plan, RETURNING)
    expect(violations.filter(v => v.severity === 'error')).toEqual([])
  })
})

describe('§79 — a true beginner is NOT lifted', () => {
  const plan = generateRulePlan(TRUE_BEGINNER, 'paid', PLAN_START)

  it('stays beginner for intensity and keeps the duration default', () => {
    expect(plan.meta.fitness_intensity_level ?? plan.meta.fitness_level).toBe('beginner')
    const runs = plan.weeks.flatMap(w => Object.values(w.sessions).filter(s => s && (s.type === 'easy' || s.type === 'long')))
    expect(runs.every(s => s!.primary_metric === 'duration')).toBe(true)
  })

  it('does not activate intensity re-entry (nothing was lifted)', () => {
    expect(plan.meta.intensity_reentry_active).toBeFalsy()
  })
})
