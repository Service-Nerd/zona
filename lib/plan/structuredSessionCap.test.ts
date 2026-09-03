import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { validatePlan } from './invariants'
import { isLongRun, isStructuredSession } from './sessionRole'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * §81 extended (Coaching Board, 2026-09-03) — structured sessions are exempt
 * from `max_weekday_mins`, and §22's ratio arm skips 5K.
 *
 * Capping a structured session does not shorten it. The cap scales
 * distance_km/duration_mins and does NOT scale `derived_set`, so a "Short
 * VO2max" went 9km/43min -> 6.5km/30min while still prescribing 7 x 400 m —
 * identical work, a duration that no longer described it. The runner blocks out
 * 30 minutes for a session needing 43.
 */

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const

const input = (over: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-04-11', race_distance_km: 5, goal: 'finish',
  current_weekly_km: 25, longest_recent_run_km: 8, days_available: 4, age: 40,
  preferred_long_run_day: 'sun', ...over,
} as GeneratorInput)

const weekdaySessions = (p: Plan): Session[] =>
  p.weeks.flatMap(w => WEEKDAYS
    .map(d => (w.sessions as Record<string, Session | undefined>)?.[d])
    .filter((s): s is Session => !!s))

describe('§81 — structured sessions exempt from the weekday cap', () => {
  it('a structured session keeps its full duration under a tight cap', () => {
    const uncapped = generateRulePlan(input({}), 'trial', '2026-11-30')
    const capped   = generateRulePlan(input({ max_weekday_mins: 30 }), 'trial', '2026-11-30')

    const structuredOf = (p: Plan) => weekdaySessions(p).filter(isStructuredSession)
    expect(structuredOf(uncapped).length).toBeGreaterThan(0)
    // At least one structured session exceeds the cap and was left alone.
    expect(structuredOf(capped).some(s => (s.duration_mins ?? 0) > 30)).toBe(true)
  })

  it('no structured session is left sitting exactly at the cap (the tell of scaling)', () => {
    const capped = generateRulePlan(input({ max_weekday_mins: 30 }), 'trial', '2026-11-30')
    for (const s of weekdaySessions(capped).filter(isStructuredSession)) {
      // A scaled session lands exactly on the cap. An untouched one essentially
      // never does, so this is the cheap signal that scaling has returned.
      if ((s.duration_mins ?? 0) === 30) {
        expect.fail(`structured session was scaled to the cap: ${s.label}`)
      }
    }
  })

  it('EASY sessions are still capped — they are not structured', () => {
    const capped = generateRulePlan(input({ max_weekday_mins: 30, current_weekly_km: 40 }), 'trial', '2026-11-30')
    for (const s of weekdaySessions(capped)) {
      if (isLongRun(s) || isStructuredSession(s) || s.type === 'race' || s.type === 'strength' || s.type === 'rest') continue
      expect(s.duration_mins ?? 0).toBeLessThanOrEqual(30)
    }
  })

  // Reproducible cases lifted verbatim from the sweep's SWEEP_EXPLAIN dump.
  // Reconstructing them by hand FAILED twice — the dump used to print only a
  // subset of the input, so the copied case did not reproduce. It now prints the
  // whole thing, and these are the result.
  it('holds the cap after every re-sizing pass — real swept case', () => {
    const inp = {
      age: 35, target_time: '0:45:00', primary_metric: 'distance',
      injury_history: ['back'], race_distance_km: 10, race_date: '2026-07-27',
      current_weekly_km: 25, longest_recent_run_km: 5, days_available: 4,
      days_cannot_train: [], fitness_level: 'beginner',
      user_declared_level: 'experienced', hard_session_relationship: 'neutral',
      max_weekday_mins: 30, goal: 'time_target', preferred_long_run_day: 'sun',
    } as unknown as GeneratorInput

    // Without the final cap pass this yields "week 5 mon: got 32, expected <= 30":
    // a session the mid-pipeline cap had trimmed, re-expanded by a later pass.
    const plan = generateRulePlan(inp, 'free', '2026-04-27')
    const errs = validatePlan(plan, inp)
      .filter(v => v.severity === 'error' && v.code === 'INV-PLAN-MAX-WEEKDAY-MINS')
    expect(errs.map(v => `w${v.week} ${v.day}: ${v.actual} > ${v.expected}`)).toEqual([])
  })
})

describe('§22 — the goal-pace ratio binds at 5K; halfWeek ignores foundation weeks', () => {
  it('raises no ratio violation on the real swept 5K case, WITH its foundation block', () => {
    // Verbatim from SWEEP_EXPLAIN. The violation only appears once a foundation
    // week is attached: it inflated `totalWeeks`, shifting `halfWeek` and moving
    // which weeks count as second-half. No 5K carve-out is involved — the ratio
    // is satisfied 168/168 at 5K.
    const inp = {
      age: 35, target_time: '0:45:00', primary_metric: 'distance',
      injury_history: ['back'], race_distance_km: 5, race_date: '2026-06-29',
      current_weekly_km: 40, longest_recent_run_km: 30, days_available: 2,
      days_cannot_train: ['mon', 'tue', 'wed', 'thu', 'sat'],
      fitness_level: 'beginner', training_age: '5yr+',
      user_declared_level: 'experienced', hard_session_relationship: 'love',
      max_hr: 184, goal: 'time_target', preferred_long_run_day: 'sun',
    } as unknown as GeneratorInput

    // ADR-020 Option A — composePlanWithFoundation is the single owner of
    // plan.weeks mutation post-generation; "today" is an offset from the
    // ENGINE'S OWN plan.meta.plan_start (not the '2026-04-27' passed to
    // generateRulePlan, which is only a minimum bound — §44 prep-time can
    // push the actual plan_start later).
    const plan = generateRulePlan(inp, 'free', '2026-04-27')
    const today = new Date(new Date(plan.meta.plan_start).getTime() - 10 * 86_400_000)
      .toISOString().slice(0, 10)
    const { plan: assembled, violations } = composePlanWithFoundation(plan, inp, today, 'add')
    expect(assembled.weeks.some(w => w.n <= 0)).toBe(true)

    const errs = violations
      .filter(v => v.code === 'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO')
    expect(errs.map(v => v.message)).toEqual([])
  })

  it('a foundation block never shifts the plan midpoint (§57)', () => {
    // The general form of the bug: prepending pre-plan weeks must not move any
    // second-half boundary, because they are not in the periodisation arc.
    const inp = {
      age: 35, target_time: '0:45:00', race_distance_km: 10, race_date: '2026-07-27',
      current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4,
      goal: 'time_target', preferred_long_run_day: 'sun',
    } as unknown as GeneratorInput

    // ADR-020 Option A — same composer, same today-as-offset reasoning as above.
    const plan = generateRulePlan(inp, 'trial', '2026-04-27')
    const today = new Date(new Date(plan.meta.plan_start).getTime() - 20 * 86_400_000)
      .toISOString().slice(0, 10)
    const { plan: assembled, violations } = composePlanWithFoundation(plan, inp, today, 'add')
    expect(assembled.weeks.some(w => w.n <= 0)).toBe(true)

    const bare = validatePlan(plan, inp).filter(v => v.severity === 'error').map(v => v.code).sort()
    const withFb = violations.filter(v => v.severity === 'error')
      .filter(v => (v.week ?? 1) > 0).map(v => v.code).sort()
    // Main-week verdicts must be identical with and without the block attached.
    expect(withFb).toEqual(bare)
  })

  it('still binds at 10K — race pace there sits between threshold and VO2max', () => {
    // Guards against the carve-out being widened past what the board ruled.
    const inp = input({
      race_distance_km: 10, goal: 'time_target', target_time: '0:50:00',
      current_weekly_km: 40, days_available: 5,
    })
    const plan = generateRulePlan(inp, 'trial', '2026-11-30')
    // The check must RUN (it may pass) — assert it is not skipped by distance.
    expect(plan.meta.goal_pace_per_km).toBeTruthy()
  })
})
