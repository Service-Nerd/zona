// INV-PLAN-WEEK-DELIVERS-DECLARED-DAYS — the converse of §64.
//
// §64 floors REST days: no week may be seven-on. Until 2026-09-20 nothing
// anywhere floored RUNNING days, so a week could deliver two runs to a runner
// who declared four and every layer passed — §64 is satisfied (five rest days
// is not "no rest day"), §52 is satisfied once the plan classifies
// maintenance, and §1's session-count denominator simply shrinks with it.
//
// THE FINDING (Coaching Board 2026-09-19, S52-LOPSIDED-BOUND-01, CORRECT WITH
// AMENDMENT). 11.4% of injury x fresh-return runners who declare >= 4 days get
// SEVEN CONSECUTIVE build/peak weeks containing TWO runs. Worst case: a
// knee-history beginner on 30 km/week whose peak week is 26.0 km in one
// session — 87% of the week, against §9's own sizing of 9.6 km. Three other
// cells measured at exactly 0.0%, so it is an interaction, not a gradient.
// The board named this invariant as owed artifact 3; this is it.
//
// ⚠️ THE TEST THAT MATTERS MOST HERE IS A NEGATIVE ONE. The first cut checked
// the DECLARED day count and fired on 45.1% of the sweep (6,435 of 14,253),
// because falling below `days_available` is DESIGNED — §18's `daysVolumeCanFill`
// declines to spread thin volume across days it cannot fill, the runner is told
// by the frequency note, and §18 states outright that the prescription is
// correct. A warn at 45% is noise sitting on top of correct work, and this repo
// has recorded that a guard which fires on correct work gets switched off,
// which is the same as having no guard. So `designedThinning` below is not
// padding: it is the assertion that stops this invariant being re-broadened.

import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

const FLOOR = GENERATION_CONFIG.MIN_TRAINING_DAYS_VOLUME_FLOOR
const DAYS: string[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** A single week carrying `runs` running days, plus optional shape overrides. */
function planWith(
  runs: number,
  over: Partial<{ type: string; phase: string; badge: string }> = {},
): Plan {
  const sessions: Record<string, unknown> = {}
  // Long run last so the week always has one; the rest are easy runs.
  for (let i = 0; i < runs; i++) {
    const day = DAYS[i]
    sessions[day] = {
      id: `w5-${day}`, type: 'easy', label: i === runs - 1 ? 'Long run — Zone 2' : 'Easy run — Zone 2',
      detail: null, distance_km: i === runs - 1 ? 10 : 5, duration_mins: i === runs - 1 ? 70 : 35,
      primary_metric: 'distance', zone: 'Zone 2', hr_target: '< 148 bpm', rpe_target: 4,
      ...(i === runs - 1 ? { role: 'long_run' } : {}),
    }
  }
  return {
    meta: { race_distance_km: 42.2, max_hr: 180, resting_hr: 55, plan_start: '2026-09-14' },
    weeks: [{
      n: 5, phase: 'build', weekly_km: 10 + (runs - 1) * 5, type: 'normal', sessions, ...over,
    }],
  } as unknown as Plan
}

const input = (days: number) =>
  ({ race_distance_km: 42.2, goal: 'finish', days_available: days }) as unknown as GeneratorInput

const fired = (p: Plan, days: number) =>
  validatePlan(p, input(days)).filter(v => v.code === 'INV-PLAN-WEEK-DELIVERS-DECLARED-DAYS')

describe('INV-PLAN-WEEK-DELIVERS-DECLARED-DAYS — the converse of §64', () => {
  it('the fixture is wired to its own argument', () => {
    // A fixture that ignores its parameter makes every assertion below vacuous.
    // Measured cost of skipping this check in this repo: eleven tests passing
    // while testing nothing, caught only because two others happened to fail.
    expect(Object.keys((planWith(2).weeks[0] as { sessions: object }).sessions)).toHaveLength(2)
    expect(Object.keys((planWith(5).weeks[0] as { sessions: object }).sessions)).toHaveLength(5)
  })

  it('fires on the finding: two running days against four declared', () => {
    const v = fired(planWith(2), 4)
    expect(v.length, 'a two-run build week must be reported').toBe(1)
    expect(v[0].actual).toBe(2)
  })

  it('…as a WARN, so the plan still generates', () => {
    // An error would refuse to generate for exactly the cohort the product is
    // least able to turn away — a first-time charity marathoner with a knee
    // history — for a shape the engine has no ratified way to avoid. The
    // board's own candidate fix breached the injury ceiling (wk14 30 -> 34 km).
    expect(fired(planWith(2), 4).every(x => x.severity === 'warn')).toBe(true)
  })

  it('designedThinning: does NOT fire at the producer floor, even well under the declared count', () => {
    // THE 45.1% CASE. Three runs against six declared is §18 working exactly as
    // written, and is stated to the runner. If this ever goes red, the check has
    // been re-broadened to the declared count and is about to become noise.
    expect(fired(planWith(FLOOR), 6)).toHaveLength(0)
  })

  it('does not fire on a runner who genuinely asked for fewer days than the floor', () => {
    expect(fired(planWith(2), 2)).toHaveLength(0)
  })

  it('is scoped off the weeks that legitimately drop a day', () => {
    // Race week is prescribed structure; a deload drops volume under §3 and may
    // drop a day with it; foundation weeks are day-fitted by §52b's own floor.
    expect(fired(planWith(2, { type: 'race' }), 4)).toHaveLength(0)
    expect(fired(planWith(2, { type: 'deload' }), 4)).toHaveLength(0)
    expect(fired(planWith(2, { badge: 'deload' }), 4)).toHaveLength(0)
    expect(fired(planWith(2, { phase: 'foundation' }), 4)).toHaveLength(0)
  })

  it('counts RUNNING days — a strength session does not paper over a two-run week', () => {
    const p = planWith(2)
    ;(p.weeks[0] as unknown as { sessions: Record<string, unknown> }).sessions.fri = {
      id: 'w5-fri', type: 'strength', label: 'Strength', detail: null,
      distance_km: null, duration_mins: 30, primary_metric: 'duration',
      zone: null, hr_target: null, rpe_target: 3,
    }
    expect(fired(p, 4), 'strength occupies a day but is not what days_available asked for').toHaveLength(1)
  })
})
