// MONDAY-RACE-EVE-LONG-RUN-01 (2026-11-22). §39 Am. 1 protects race eve on any weekday. For a Monday race, race eve is
// the PREVIOUS week's Sunday, which the race-week builder never touched: the engine put the long run there (63–85 min in
// 4 of 37 golden plans) and INV-PLAN-NO-RACE-EVE-SESSION never looked. Both are fixed; this holds them.
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

const PLAN_START = '2026-11-23'
const base = { goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 12, days_available: 4, training_age: '2-5yr', age: 38, injury_history: [] }
const RUNNERS: GeneratorInput[] = [
  { ...base, race_distance_km: 5, race_date: '2027-02-15' },
  { ...base, race_distance_km: 10, race_date: '2027-03-01' },
  { ...base, race_distance_km: 21.1, race_date: '2027-03-15', current_weekly_km: 35 },
  { ...base, race_distance_km: 42.2, race_date: '2027-04-19', current_weekly_km: 45, longest_recent_run_km: 20, days_available: 5 },
] as never

const plans: { input: GeneratorInput; plan: Plan }[] = []
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-16T12:00:00'))
  for (const input of RUNNERS) plans.push({ input, plan: generateRulePlan(input, 'paid', PLAN_START) })
})
afterAll(() => { vi.useRealTimers() })

const raceEve = (p: Plan) => {
  const k = p.weeks.findIndex(w => w.sessions.mon?.type === 'race')
  return k > 0 ? { week: p.weeks[k - 1], s: p.weeks[k - 1].sessions.sun } : null
}

describe('MONDAY-RACE-EVE-LONG-RUN-01 — race eve before a Monday race', () => {
  it('every runner here has a Monday race (else this proves nothing)', () => {
    for (const { plan } of plans) expect(raceEve(plan), plan.meta.race_date).not.toBeNull()
  })

  it('🔴 the day before a Monday race holds nothing over the shakeout cap, and never the long run', () => {
    for (const { plan } of plans) {
      const e = raceEve(plan)!
      if (!e.s || e.s.type === 'rest') continue
      expect(e.s.role, `${plan.meta.race_distance_km} km`).not.toBe('long_run')
      expect(e.s.duration_mins ?? 0, `${plan.meta.race_distance_km} km`).toBeLessThanOrEqual(G.RACE_WEEK_SHAKEOUT_MAX_MINS)
    }
  })

  it('the week before carries the race-eve priming: strides on one run only (§28, §30)', () => {
    for (const { plan } of plans) {
      const e = raceEve(plan)!
      const withStrides = Object.values(e.week.sessions).filter(s => (s?.coach_notes ?? []).some(n => /strides/i.test(n ?? '')))
      expect(withStrides.length, `${plan.meta.race_distance_km} km`).toBeLessThanOrEqual(1)
    }
  })

  it('the plans validate with no race-eve finding', () => {
    for (const { plan, input } of plans) expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-NO-RACE-EVE-SESSION')).toEqual([])
  })

  it('🔴 the check now looks across the week boundary: a long run planted on race eve is caught', () => {
    const { plan, input } = plans[3]
    const p = structuredClone(plan), e = raceEve(p)!
    e.week.sessions.sun = { type: 'easy', role: 'long_run', label: 'Long run', duration_mins: 70, distance_km: 10 } as never
    const found = validatePlan(p, input).filter(v => v.code === 'INV-PLAN-NO-RACE-EVE-SESSION')
    expect(found.map(v => v.week)).toEqual([e.week.n])
  })
})
