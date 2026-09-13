import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { isLongRun, isStructuredSession } from './sessionRole'
import type { GeneratorInput } from '@/types/plan'

// UX-WIZARD-01 Stage B — ACHIEVABILITY. The founder's rule: "you cannot tell
// someone to run 10k on a day they gave 30 minutes." A per-day budget bounds the
// TIME; the distance must be whatever fits that time at the runner's pace, never
// a distance that would blow past it. This asserts it directly: every easy
// weekday session's duration sits within THAT day's budget.
//
// The long run and structured sessions are §81-exempt (they carry the SPEAK
// obligation instead) — so this checks the easy runs, which are the ones the
// per-day cap + redistribution size, and the ones a runner most expects to fit.

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

// Priya: sub-50 10K, runs Mon/Wed/Thu + Sun long. Tight Mon/Wed (30), open
// Thu (90). The exact shape UX-WIZARD-01 exists for.
const PRIYA: GeneratorInput = {
  race_date: '2026-07-19',
  race_distance_km: 10,
  goal: 'time_target',
  target_time: '0:50:00',
  age: 36,
  current_weekly_km: 35,
  longest_recent_run_km: 14,
  days_available: 4,
  days_cannot_train: ['tuesday', 'friday', 'saturday'],
  preferred_long_run_day: 'sun',
  max_weekday_mins: 30,
  day_budgets: { mon: 30, wed: 30, thu: 90 },
  max_hr: 186,
  resting_hr: 54,
  training_age: '2-5yr',
  recent_quality_training: 'regular',
} as GeneratorInput

describe('per-day budgets are achievable — no session over its own day’s time', () => {
  const plan = generateRulePlan(PRIYA, 'paid', '2026-04-27')
  const budgets = PRIYA.day_budgets!

  it('every EASY weekday run fits that day’s budget (distance bound by budget × pace)', () => {
    const overruns: string[] = []
    for (const w of plan.weeks) {
      if ((w as any).n < 1) continue
      for (const d of WEEKDAYS) {
        const s: any = (w.sessions as any)[d]
        if (!s || isLongRun(s) || isStructuredSession(s)) continue   // §81-exempt carry SPEAK, not this
        const cap = (budgets as any)[d] ?? PRIYA.max_weekday_mins!
        if (typeof s.duration_mins === 'number' && s.duration_mins > cap) {
          overruns.push(`wk${(w as any).n} ${d}: ${s.duration_mins}min > ${cap}min budget`)
        }
      }
    }
    expect(overruns, 'an easy run longer than its day allows is an unachievable target').toEqual([])
  })

  it('never prescribes a 10k-in-30-min: the tight-day run is a fraction of the roomy-day run', () => {
    // Somewhere in the plan the roomy Thursday should carry more than a tight
    // Mon/Wed — proof the budget genuinely shapes distance, not just passes.
    const thuMax = Math.max(0, ...plan.weeks.map(w => ((w.sessions as any).thu?.duration_mins ?? 0)))
    const tightMax = Math.max(0,
      ...plan.weeks.flatMap(w => [(w.sessions as any).mon?.duration_mins ?? 0, (w.sessions as any).wed?.duration_mins ?? 0]))
    expect(thuMax).toBeGreaterThan(tightMax)
  })
})
