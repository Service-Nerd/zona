// TT-BEFORE-LONG-01 (Coaching Board 2026-10-24, §78 Am.2). The §78 time trial is never on the day either side of the
// long run. No grid builds the shape that broke it (a day budget under a weekday cap, with a Saturday long run), so
// this test does: the input below is the live plan's generator input with the identifying fields removed.
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { isLongRun, isTimeTrial } from './sessionRole'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

const START = '2026-12-07'
const LIVE_SHAPE = {
  age: 21, goal: 'time_target', max_hr: 155, resting_hr: 71, max_hr_source: 'observed', terrain: 'road',
  benchmark: { time: '2:29:56', type: 'race', distance_km: 21.1, benchmark_date: '2026-05-25' },
  race_date: '2027-04-25', race_distance_km: 42.2, target_time: '3:30:00', plan_start: START,
  training_age: '6-18mo', user_declared_level: 'beginner', recent_quality_training: 'none',
  hard_session_relationship: 'love', current_weekly_km: 30, longest_recent_run_km: 11,
  days_available: 4, days_cannot_train: ['tue', 'thu'], preferred_long_run_day: 'sat',
  max_weekday_mins: 45, day_budgets: { fri: 90 },
} as unknown as GeneratorInput

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const gap = (a: string, b: string) => { const x = Math.abs(DAYS.indexOf(a as never) - DAYS.indexOf(b as never)); return Math.min(x, 7 - x) }
const gen = (input: GeneratorInput) => generateRulePlan(input, 'trial', START, undefined, START) as Plan
const trials = (plan: Plan) => plan.weeks.flatMap(w => {
  const e = Object.entries(w.sessions ?? {}) as [string, Session | undefined][]
  const lr = e.find(([, s]) => !!s && isLongRun(s))
  return e.filter(([, s]) => !!s && isTimeTrial(s)).map(([d]) => ({ week: w.n, day: d, gapToLong: lr ? gap(d, lr[0]) : 7 }))
})

describe('§78 Am.2 — the live shape', () => {
  const plan = gen(LIVE_SHAPE)
  it('puts no time trial beside the long run', () => {
    expect(trials(plan).filter(t => t.gapToLong < 2)).toEqual([])
  })
  it('with no safe slot, lists no recalibration week rather than one with no session (§78 fallback)', () => {
    // Monday and Wednesday are 5 km at placement (under min_slot_km); Friday is beside Saturday. Nothing qualifies.
    expect(plan.meta.recalibration_weeks ?? []).toEqual([])
    expect(trials(plan)).toEqual([])
  })
  it('leaves the runner\'s limits and long-run day alone', () => {
    const lrDays = new Set(plan.weeks.flatMap(w => Object.entries(w.sessions ?? {}).filter(([, s]) => !!s && isLongRun(s as Session)).map(([d]) => d)))
    expect(Array.from(lrDays)).toEqual(['sat'])
  })
})

describe('§78 unchanged where a safe day exists', () => {
  it('without the Friday budget the trial still lands on Wednesday, in both recalibration weeks', () => {
    const plan = gen({ ...LIVE_SHAPE, day_budgets: undefined } as GeneratorInput)
    expect(plan.meta.recalibration_weeks).toEqual([7, 11])
    expect(trials(plan).map(t => `${t.week}:${t.day}`)).toEqual(['7:wed', '11:wed'])
  })
})

describe('INV-PLAN-TT-LONG-RUN-SPACING', () => {
  const ok = gen({ ...LIVE_SHAPE, day_budgets: undefined } as GeneratorInput)
  it('is silent on a correctly spaced plan', () => {
    expect(validatePlan(ok, { ...LIVE_SHAPE, day_budgets: undefined } as GeneratorInput).filter(v => v.code === 'INV-PLAN-TT-LONG-RUN-SPACING')).toEqual([])
  })
  it('fires on a forged plan with the trial the day before the long run', () => {
    const forged = JSON.parse(JSON.stringify(ok)) as Plan
    const w = forged.weeks.find(x => x.n === 7)!
    const ss = w.sessions as Record<string, Session | undefined>
    const tmp = ss.fri; ss.fri = ss.wed; ss.wed = tmp
    const v = validatePlan(forged, LIVE_SHAPE).filter(x => x.code === 'INV-PLAN-TT-LONG-RUN-SPACING')
    expect(v.map(x => [x.week, x.actual])).toEqual([[7, '1 day(s)']])
  })
})
