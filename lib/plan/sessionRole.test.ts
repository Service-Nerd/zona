import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { isLongRun, isShakeout, coachingSessionType } from './sessionRole'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput, Session } from '@/types/plan'

function s(partial: Partial<Session>): Session {
  return { type: 'easy', label: '', detail: null, ...partial }
}

describe('sessionRole — structural classification', () => {
  it('reads the generator-stamped role, ignoring the label', () => {
    // The enrichment failure mode: role stamped, label rewritten to something
    // with no structural keyword. Classification must follow the role.
    expect(isLongRun(s({ role: 'long_run', label: 'Sunday distance builder' }))).toBe(true)
    expect(isShakeout(s({ role: 'long_run', label: 'Sunday distance builder' }))).toBe(false)
    expect(isShakeout(s({ role: 'shakeout', label: 'Pre-race primer' }))).toBe(true)
    expect(isLongRun(s({ role: 'shakeout', label: 'Pre-race primer' }))).toBe(false)
  })

  it('falls back to the label heuristic only for legacy (unstamped) sessions', () => {
    expect(isLongRun(s({ label: 'Long run — Zone 2' }))).toBe(true)
    expect(isShakeout(s({ label: 'Pre-race shakeout' }))).toBe(true)
    expect(isLongRun(s({ label: 'Easy run — Zone 2' }))).toBe(false)
    // Legacy long-run heuristic still requires type easy.
    expect(isLongRun(s({ type: 'quality', label: 'Long intervals' }))).toBe(false)
  })

  it('recognises an explicit type:long (legacy/gist/manual)', () => {
    expect(isLongRun(s({ type: 'long', label: 'whatever' }))).toBe(true)
  })
})

describe('coachingSessionType — the single-owner coaching signal', () => {
  it('classifies a long run (type:easy) as "long", not "easy"', () => {
    // This is the whole bug: session.type is 'easy', so the coaching engine
    // (HARD_TYPES gate, fatigue/readiness trim, limiter) would miss it. The
    // signal must say 'long'.
    expect(coachingSessionType(s({ type: 'easy', role: 'long_run', label: 'Sunday builder' }))).toBe('long')
    expect(coachingSessionType(s({ type: 'long' }))).toBe('long')
  })

  it('passes non-long types straight through', () => {
    expect(coachingSessionType(s({ type: 'easy', label: 'Easy run' }))).toBe('easy')
    expect(coachingSessionType(s({ type: 'quality', label: 'Threshold' }))).toBe('quality')
    expect(coachingSessionType(s({ type: 'recovery' }))).toBe('recovery')
    expect(coachingSessionType(s({ type: 'shakeout' as never, role: 'shakeout' }))).toBe('shakeout')
  })
})

describe('generateRulePlan — stamps role structurally', () => {
  const FROZEN_NOW = new Date('2026-08-13T09:00:00Z')
  const INPUT: GeneratorInput = {
    race_date: '2026-11-08', race_distance_km: 10, goal: 'time_target', target_time: '0:52:00',
    days_available: 3, age: 34, current_weekly_km: 15, longest_recent_run_km: 7,
    resting_hr: 62, max_hr: 188, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 10, time: '0:58:00' },
  }

  beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
  afterAll(() => { vi.useRealTimers() })

  it('every long run carries role:long_run and every race-week shakeout role:shakeout', () => {
    const plan = generateRulePlan(INPUT, 'paid', '2026-08-17')

    // Exactly one long run per non-empty week, each stamped.
    const longRuns = plan.weeks.flatMap(w => Object.values(w.sessions)).filter((x): x is Session => !!x && isLongRun(x))
    expect(longRuns.length).toBeGreaterThan(0)
    expect(longRuns.every(x => x.role === 'long_run')).toBe(true)

    const raceWeek = plan.weeks.find(w => w.type === 'race')!
    const shakeouts = Object.values(raceWeek.sessions).filter((x): x is Session => !!x && x.type === 'easy')
    expect(shakeouts.length).toBeGreaterThan(0)
    expect(shakeouts.every(x => x.role === 'shakeout')).toBe(true)
  })
})
