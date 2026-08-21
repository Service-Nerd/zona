import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { mainSetMinutes } from './sessionFormat'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Session } from '@/types/plan'

/**
 * SC-10 / CD-14 — VO2max main-set absolute ceiling (Coaching Board 2026-08-21).
 * The flat 18% share sized VO2max at a share of weekly volume, so the hardest
 * session GREW into peak (measured p50 25 min). VO2max is the least sustainable
 * work per minute, so its main set is now capped in absolute minutes
 * (VO2MAX_MAIN_SET_MAX_MINS), decoupled from weekly volume; freed distance
 * redistributes to easy running (volume preserved). Applies to paced flat
 * intervals only — effort-governed hills/hikes are lower impact (SC-09).
 */

const FROZEN_NOW = new Date('2026-08-20T09:00:00Z')
const PLAN_START = '2026-09-07'

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

function quality(plan: ReturnType<typeof generateRulePlan>): { week: number; phase: string; s: Session }[] {
  return plan.weeks.flatMap(w =>
    Object.values(w.sessions)
      .filter((s): s is Session => !!s && s.type === 'quality')
      .map(s => ({ week: w.n, phase: w.phase, s })))
}

// 10K time-target on high volume → real flat VO2max in peak, previously oversized.
const TENK_HIGH: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:40:00',
  days_available: 5, age: 35, current_weekly_km: 70, longest_recent_run_km: 24,
  resting_hr: 45, max_hr: 190, preferred_long_run_day: 'sun',
}

describe('SC-10 — VO2max main-set ceiling', () => {
  it('no paced VO2max session exceeds the ceiling (+ rounding), even on high volume', () => {
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const paced = quality(plan).filter(q => q.s.stimulus === 'vo2max' && q.s.pace_target)
    expect(paced.length).toBeGreaterThan(0)
    const cap = GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS + GENERATION_CONFIG.MAIN_SET_ORDERING_TOLERANCE_MINS
    for (const q of paced) {
      expect(mainSetMinutes(q.s.duration_mins ?? 0), `W${q.week} "${q.s.label}"`).toBeLessThanOrEqual(cap)
    }
  })

  it('the ceiling binds in PEAK — the biggest weeks (Willy)', () => {
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const peakVo2 = quality(plan).filter(q => q.phase === 'peak' && q.s.stimulus === 'vo2max' && q.s.pace_target)
    expect(peakVo2.length).toBeGreaterThan(0)
    for (const q of peakVo2) {
      expect(mainSetMinutes(q.s.duration_mins ?? 0)).toBeLessThanOrEqual(GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS + 1)
    }
  })

  it('the plan validates — the cap invariant is clean', () => {
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const v = validatePlan(plan, TENK_HIGH).filter(x => x.code === 'INV-PLAN-VO2MAX-MAIN-SET-CAP')
    expect(v).toEqual([])
  })

  it('INV-PLAN-VO2MAX-MAIN-SET-CAP fires on a hand-built over-ceiling VO2max session', () => {
    // A 60-minute Classic VO2max = ~40-min main set, over the 20-min ceiling.
    const plan = generateRulePlan(TENK_HIGH, 'paid', PLAN_START)
    const wk = plan.weeks.find(w => w.phase === 'peak')!
    const day = Object.keys(wk.sessions)[0] as keyof typeof wk.sessions
    ;(wk.sessions as Record<string, Session>)[day] = {
      type: 'quality', label: 'Classic VO2max', detail: null, stimulus: 'vo2max',
      duration_mins: 60, zone: 'Zone 4–5', pace_target: '3:40–3:50 /km',
    } as Session
    const v = validatePlan(plan, TENK_HIGH).filter(x => x.code === 'INV-PLAN-VO2MAX-MAIN-SET-CAP')
    expect(v.length).toBeGreaterThan(0)
  })

  it('effort-governed hills/hikes are NOT capped (lower impact, SC-09)', () => {
    // A 50k finish plan carries effort-governed vert_hike_repeats; those can be
    // long (time on feet) and must not be flagged by the ceiling or its invariant.
    const ultra: GeneratorInput = {
      race_date: '2027-01-25', race_distance_km: 50, goal: 'finish', days_available: 5,
      age: 42, current_weekly_km: 60, longest_recent_run_km: 28, resting_hr: 48, max_hr: 184,
      preferred_long_run_day: 'sun', fitness_level: 'experienced',
    }
    const plan = generateRulePlan(ultra, 'paid', PLAN_START)
    // no cap violation despite long effort-governed sessions
    const v = validatePlan(plan, ultra).filter(x => x.code === 'INV-PLAN-VO2MAX-MAIN-SET-CAP')
    expect(v).toEqual([])
    // and the effort-governed session (no pace_target) is allowed to be long
    const hike = quality(plan).find(q => !q.s.pace_target && (q.s.catalogue_id === 'vert_hike_repeats'))
    if (hike) expect(mainSetMinutes(hike.s.duration_mins ?? 0)).toBeGreaterThan(GENERATION_CONFIG.VO2MAX_MAIN_SET_MAX_MINS)
  })
})
