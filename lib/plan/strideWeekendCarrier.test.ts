/**
 * §28 Amendment 3 — S28-WEEKEND-CARRIER-01 (Coaching Board 2026-09-24).
 *
 * THE RULING. §28's carrier is sought MIDWEEK FIRST, unchanged. Only when no
 * midweek easy run is eligible does it fall back to the remaining days. §28's own
 * WHY justifies EASY ("legs fresh enough to execute proper form") and gives no
 * mechanism for MIDWEEK.
 *
 * 🔴 THE FALLBACK DAY IS ALMOST ALWAYS THE DAY AFTER THE LONG RUN, AND THAT IS THE
 * WHOLE RULING. Measured across the affected population: of 17,434 carrier-less
 * weeks, allowing any easy day recovers 10,410 (59.7%); allowing any easy day
 * EXCEPT the day after the long run recovers 0 (0.0%). There was no middle option.
 *
 * ⚠️ WILLY'S BOUND: flat 4×20s are accepted there, HILL strides are refused —
 * §28 Am.1's case for hills is that they are ECCENTRIC-HEAVY, which is the wrong
 * loading on already-fatigued tissue, and they were authorised on a FRESH midweek
 * day. The alternation collapses to its safe arm, exactly as §28 Am.2 makes it
 * collapse for injury history.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { strideCarrierDay, isHillStrideWeek, neuromuscularNote } from './neuromuscular'
import { isLongRun } from './sessionRole'
import { normaliseDays } from './days'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-04-27'

/** The live plan `e49ea589`: 3 days (Wed/Sat/Sun), long run SAT, 9-week 5K. */
const mk = (fitness_level: string) => ({
  athlete_name: 'Athlete', age: 35, race_name: 'Test', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 5, race_date: '2026-06-27',
  goal: 'time_target', target_time: '0:25:00',
  resting_hr: 55, max_hr: 184, current_weekly_km: 30, longest_recent_run_km: 12,
  fitness_level, recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: [],
  preferred_long_run_day: 'sat',
  days_available: 3, days_cannot_train: ['mon', 'tue', 'thu', 'fri'],
} as unknown as GeneratorInput)

const notesOf = (s: { coach_notes?: unknown }) =>
  (Array.isArray(s.coach_notes) ? s.coach_notes : []).join(' ')

describe('§28 Am.3 — the carrier falls back beyond midweek', () => {
  it('the live shape now carries strides in every qualifying week (was 0 of 5)', () => {
    const input = mk('beginner')
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const raceWeekN = Math.max(0, ...plan.weeks.map(w => w.n))
    const qualifying = plan.weeks.filter(w =>
      w.n >= GENERATION_CONFIG.STRIDES_FIRST_WEEK && w.type !== 'deload' && w.n !== raceWeekN)
    expect(qualifying.length).toBe(5)   // weeks 4-8
    for (const w of qualifying) {
      const carried = Object.values(w.sessions).some(s => s && /strides/i.test(notesOf(s)))
      expect(carried, `week ${w.n} carries no stride note`).toBe(true)
    }
    expect(validatePlan(plan, input).filter(v => v.code.startsWith('INV-PLAN-STRIDES'))).toEqual([])
  })

  it("WILLY'S BOUND — a beginner gets FLAT strides on the post-long-run day, never hills", () => {
    const input = mk('beginner')
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    // Without the bound, §28 Am.1 alternates hills in every other stride week,
    // so this fixture WOULD contain hill strides if the bound were absent.
    const hillWeeks = plan.weeks.filter(w =>
      Object.values(w.sessions).some(s => s && /hill strides/i.test(notesOf(s))))
    expect(hillWeeks.map(w => w.n)).toEqual([])
  })

  it('midweek still wins when a midweek carrier exists — this is a fallback, not a move', () => {
    const rich = { ...mk('beginner'), days_available: 5, days_cannot_train: ['tue', 'thu'] } as unknown as GeneratorInput
    const plan = generateRulePlan(rich, 'paid', PLAN_START)
    const blocked = normaliseDays(['tue', 'thu'])
    const raceWeekN = Math.max(0, ...plan.weeks.map(w => w.n))
    for (const w of plan.weeks) {
      if (w.n < GENERATION_CONFIG.STRIDES_FIRST_WEEK) continue
      if (w.type === 'deload' || w.n === raceWeekN) continue
      const longDay = (Object.entries(w.sessions).find(([, s]) => s && isLongRun(s)) ?? [])[0]
      if (!longDay) continue
      const carrier = strideCarrierDay(w.sessions as never, longDay as never, blocked)
      if (carrier) expect(['mon', 'tue', 'wed', 'thu', 'fri']).toContain(carrier)
    }
  })

  it('FALSIFICATION — the bound is what suppresses hills, not the fixture', () => {
    // Same beginner, same stride week, differing ONLY in the post-long-run flag.
    const freshDay = isHillStrideWeek(GENERATION_CONFIG.STRIDES_FIRST_WEEK, 'beginner', [], false)
    const postLR = isHillStrideWeek(GENERATION_CONFIG.STRIDES_FIRST_WEEK, 'beginner', [], true)
    expect(freshDay).toBe(true)    // a hill week on a fresh midweek day
    expect(postLR).toBe(false)     // the same week, refused after the long run
    expect(neuromuscularNote(GENERATION_CONFIG.STRIDES_FIRST_WEEK, 'beginner', [], false))
      .toMatch(/hill strides/i)
    expect(neuromuscularNote(GENERATION_CONFIG.STRIDES_FIRST_WEEK, 'beginner', [], true))
      .toMatch(/4×20s strides/)
  })

  it('FALSIFICATION — the invariant fires when hills land on the post-long-run day', () => {
    const input = mk('beginner')
    const plan = generateRulePlan(input, 'paid', PLAN_START)
    const target = plan.weeks.find(w =>
      Object.values(w.sessions).some(s => s && /strides/i.test(notesOf(s)) && !isLongRun(s)))!
    expect(target, 'fixture must carry a stride note').toBeTruthy()
    expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-STRIDES-PRESENT')).toEqual([])

    // Swap the flat note for the hill note on the Sunday carrier.
    const sun = target.sessions.sun!
    sun.coach_notes = (sun.coach_notes ?? []).map(n =>
      /strides/i.test(String(n)) ? '6×10s hill strides up a moderate gradient, walk back down.' : n) as never
    const after = validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-STRIDES-PRESENT')
    expect(after.length).toBe(1)
    expect(after[0].severity).toBe('error')
    expect(after[0].principle_ref).toContain('Amendment 3')
  })
})
