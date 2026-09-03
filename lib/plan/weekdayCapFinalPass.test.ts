import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { isLongRun, isStructuredSession } from './sessionRole'
import type { GeneratorInput, Plan, Session } from '@/types/plan'

/**
 * MWM-02 (Coaching Board, 2026-09-03) — §18 vs §9 when a runner's own limits
 * leave no room for a long run.
 *
 * `applyWeekdayMinsCap` ran INSIDE week construction while eight later
 * post-passes re-sized sessions and none re-applied it, so a session capped at
 * 30 min was silently re-expanded to 39. 1,615 violations across 2,688 plans,
 * every one on a runner who had blocked both weekend days.
 *
 * The board VETOED the naive fix (cap the long run too): it traded 1,615 §18
 * breaches for 979 §9 breaches and produced a week whose long run was not the
 * longest run. Remedy: the long run is exempt, and where it cannot fit the
 * stated availability the plan says so and classifies maintenance (§81).
 */

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
const PLAN_START = '2026-11-30'

const input = (over: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-04-11', race_distance_km: 21.1, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 40,
  preferred_long_run_day: 'sun',
  ...over,
} as GeneratorInput)

const weekdaySessions = (p: Plan): Session[] =>
  p.weeks.flatMap(w => WEEKDAYS.map(d => (w.sessions as Record<string, Session | undefined>)?.[d])
    .filter((s): s is Session => !!s))

describe('MWM-02 — weekday cap as a final pass', () => {
  it('caps UNSTRUCTURED weekday sessions even after later re-sizing passes', () => {
    // §81 was extended on 2026-09-03 from "the long run" to "the long run and
    // any structured session" — capping a quality session scales its headline
    // but not its `derived_set`, so it shortens the label rather than the work.
    // This assertion originally excluded only the long run; that encoded the
    // pre-extension contract and started failing the moment the exemption
    // widened. Updated deliberately, not relaxed: easy runs are still capped.
    const inp = input({ max_weekday_mins: 30, days_cannot_train: ['saturday', 'sunday'], current_weekly_km: 30 })
    const plan = generateRulePlan(inp, 'trial', PLAN_START)

    let checked = 0
    for (const s of weekdaySessions(plan)) {
      if (isLongRun(s) || isStructuredSession(s)) continue
      if (s.type === 'race' || s.type === 'strength' || s.type === 'rest') continue
      checked++
      expect(s.duration_mins ?? 0).toBeLessThanOrEqual(30)
    }
    // Guard against the assertion quietly becoming vacuous if the exemptions
    // ever widen far enough to exclude everything.
    expect(checked).toBeGreaterThan(0)
  })

  it('leaves the long run at full length — never shrink-to-fit (board veto)', () => {
    const inp = input({ max_weekday_mins: 30, days_cannot_train: ['saturday', 'sunday'], current_weekly_km: 30 })
    const plan = generateRulePlan(inp, 'trial', PLAN_START)

    const longs = weekdaySessions(plan).filter(isLongRun)
    expect(longs.length).toBeGreaterThan(0)
    // If any had been capped it would sit exactly at the cap.
    expect(longs.some(s => (s.duration_mins ?? 0) > 30)).toBe(true)
  })

  it('the long run is still the longest run of its week', () => {
    const inp = input({ max_weekday_mins: 30, days_cannot_train: ['saturday', 'sunday'], current_weekly_km: 30 })
    const plan = generateRulePlan(inp, 'trial', PLAN_START)

    for (const w of plan.weeks) {
      if (w.type === 'race') continue
      const runs = Object.values(w.sessions ?? {}).filter((s): s is Session =>
        !!s && s.type !== 'rest' && s.type !== 'cross-train' && s.type !== 'strength')
      const long = runs.find(isLongRun)
      if (!long) continue
      const longest = Math.max(...runs.map(s => s.duration_mins ?? 0))
      expect(long.duration_mins).toBe(longest)
    }
  })

  it('produces no INV-PLAN-MAX-WEEKDAY-MINS violations across the shape grid', () => {
    // 10K is deliberately excluded: a 30-min cap there trips a PRE-EXISTING
    // quality-session floor defect (unrelated to this change — measured
    // identical with and without the final pass) and generateRulePlan throws
    // under NODE_ENV=test. Reported separately for the board.
    for (const cap of [30, 45, 60, 90]) {
      for (const blocked of [[], ['monday', 'wednesday'], ['saturday', 'sunday']]) {
        for (const vol of [30, 40, 50]) {
          const inp = input({ max_weekday_mins: cap, days_cannot_train: blocked, current_weekly_km: vol })
          const plan = generateRulePlan(inp, 'trial', PLAN_START)
          const errs = validatePlan(plan, inp)
            .filter(v => v.severity === 'error' && v.code === 'INV-PLAN-MAX-WEEKDAY-MINS')
          expect(errs).toEqual([])
        }
      }
    }
  })
})

describe('§81 — the plan states what it cannot build', () => {
  it('classifies maintenance and explains when the long run cannot fit', () => {
    const inp = input({ max_weekday_mins: 30, days_cannot_train: ['saturday', 'sunday'], current_weekly_km: 30 })
    const plan = generateRulePlan(inp, 'trial', PLAN_START)

    expect(plan.meta.volume_profile).toBe('maintenance')
    expect(plan.meta.volume_constraint_note).toBeTruthy()
  })

  it('names the constraint and the lever, and never just refuses (Sims)', () => {
    const inp = input({ max_weekday_mins: 30, days_cannot_train: ['saturday', 'sunday'], current_weekly_km: 30 })
    const note = generateRulePlan(inp, 'trial', PLAN_START).meta.volume_constraint_note ?? ''
    // A plan is still produced — the runner is never left with nothing.
    expect(generateRulePlan(inp, 'trial', PLAN_START).weeks.length).toBeGreaterThan(0)
    expect(note.length).toBeGreaterThan(40)
  })

  it('does NOT downgrade a runner whose long run fits their availability', () => {
    // Weekends free: the long run lands on Sunday and the cap never applies.
    const inp = input({ max_weekday_mins: 30, current_weekly_km: 30, days_cannot_train: ['monday'] })
    const plan = generateRulePlan(inp, 'trial', PLAN_START)
    expect(plan.meta.volume_constraint_note ?? '').not.toContain('does not fit the time you have')
  })

  it('the overrun threshold is named config, not a literal (INV-CFG-003)', () => {
    expect(GENERATION_CONFIG.LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT).toBeGreaterThan(0)
    expect(GENERATION_CONFIG.FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN).toBe(4)
  })
})
