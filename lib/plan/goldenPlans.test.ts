import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput } from '@/types/plan'
import type { Tier } from './ruleEngine'

/**
 * GEN-FIX-08 — golden plan snapshots.
 *
 * The 2026-08-06 incident was found by reading one user's JSON by hand, five
 * days after it shipped. Nothing in the suite generated a plan and looked at it,
 * so an engine that had been producing plans ending before race day since R23
 * passed every test it had.
 *
 * These personas are the ones from that analysis (P0 is a byte-exact
 * reproduction of the affected plan's inputs). They already discriminate: before
 * the Wave 1b fixes, 7/7 ended before race day, 4/7 peaked outside the peak
 * phase, and 2/7 had no quality sessions while their copy promised some.
 *
 * A failing snapshot is not a failing test — it is a change to what runners are
 * prescribed. Read the diff. If it is intended, update it deliberately.
 */

const PLAN_START = '2026-08-03'
// Frozen so VDOT's stale-benchmark discount (which decays against "today")
// doesn't drift the snapshots by the day they happen to be run.
const FROZEN_NOW = new Date('2026-08-06T09:00:00Z')

interface Persona { id: string; tier: Tier; input: GeneratorInput }

const PERSONAS: Persona[] = [
  {
    id: 'P0-user-a-beginner-3d-hm-finish',
    tier: 'trial',
    input: {
      race_date: '2026-11-18', race_distance_km: 21.1, goal: 'finish', days_available: 3, age: 43,
      current_weekly_km: 30, longest_recent_run_km: 12, resting_hr: 72, max_hr: 178,
      training_age: '<6mo', hard_session_relationship: 'love', terrain: 'mixed',
      preferred_long_run_day: 'sat', days_cannot_train: ['tue', 'sun'],
      benchmark: { type: 'race', distance_km: 5, time: '0:29:00', benchmark_date: '2026-06-30' },
    },
  },
  {
    id: 'P1-beginner-3d-5k-finish-free-no-benchmark',
    tier: 'free',
    input: {
      race_date: '2026-11-18', race_distance_km: 5, goal: 'finish', days_available: 3, age: 30,
      current_weekly_km: 12, longest_recent_run_km: 5, training_age: '<6mo',
    },
  },
  {
    id: 'P2-intermediate-4d-10k-time-target',
    tier: 'paid',
    input: {
      race_date: '2026-11-18', race_distance_km: 10, goal: 'time_target', target_time: '0:45:00',
      days_available: 4, age: 35, current_weekly_km: 35, longest_recent_run_km: 14,
      resting_hr: 55, max_hr: 185, training_age: '2-5yr',
      benchmark: { type: 'race', distance_km: 5, time: '0:21:30', benchmark_date: '2026-07-15' },
    },
  },
  {
    id: 'P3-intermediate-4d-hm-time-target',
    tier: 'paid',
    input: {
      race_date: '2026-11-18', race_distance_km: 21.1, goal: 'time_target', target_time: '1:45:00',
      days_available: 4, age: 40, current_weekly_km: 40, longest_recent_run_km: 18,
      resting_hr: 52, max_hr: 180, training_age: '2-5yr',
      benchmark: { type: 'race', distance_km: 10, time: '0:47:00', benchmark_date: '2026-07-01' },
    },
  },
  {
    id: 'P4-experienced-5d-marathon-time-target',
    tier: 'paid',
    input: {
      race_date: '2026-11-18', race_distance_km: 42.2, goal: 'time_target', target_time: '3:15:00',
      days_available: 5, age: 38, acknowledged_prep_warning: true,
      current_weekly_km: 65, longest_recent_run_km: 30, resting_hr: 45, max_hr: 190,
      training_age: '5yr+',
      benchmark: { type: 'race', distance_km: 21.1, time: '1:32:00', benchmark_date: '2026-07-20' },
    },
  },
  {
    id: 'P5-beginner-3d-hm-finish-no-benchmark-masters',
    tier: 'trial',
    input: {
      race_date: '2026-11-18', race_distance_km: 21.1, goal: 'finish', days_available: 3, age: 50,
      current_weekly_km: 20, longest_recent_run_km: 8, training_age: '6-18mo',
    },
  },
  {
    id: 'P6-experienced-5d-marathon-finish',
    tier: 'paid',
    input: {
      race_date: '2026-11-18', race_distance_km: 42.2, goal: 'finish', days_available: 5, age: 29,
      current_weekly_km: 55, longest_recent_run_km: 26, resting_hr: 48, max_hr: 191,
      training_age: '5yr+',
      benchmark: { type: 'race', distance_km: 10, time: '0:42:00', benchmark_date: '2026-06-10' },
    },
  },
]

/** Strip the two fields that legitimately change on every run. */
function normalise(plan: unknown): unknown {
  const p = JSON.parse(JSON.stringify(plan))
  delete p.meta.generated_at
  delete p.meta.last_updated
  return p
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('golden plans', () => {
  for (const { id, tier, input } of PERSONAS) {
    it(`${id} — full plan snapshot`, () => {
      expect(normalise(generateRulePlan(input, tier, PLAN_START))).toMatchSnapshot()
    })
  }

  it('every persona passes every constitutional invariant', () => {
    const failures: string[] = []
    for (const { id, tier, input } of PERSONAS) {
      const plan = generateRulePlan(input, tier, PLAN_START)
      for (const v of validatePlan(plan, input)) {
        if (v.severity === 'error') failures.push(`${id}: ${v.code} (week ${v.week}) — ${v.message}`)
      }
    }
    expect(failures).toEqual([])
  })

  // The three defects that shipped. Asserted directly rather than left to the
  // snapshot, so a regression names itself instead of showing up as a diff.
  it('every plan reaches race day, with the race on the correct weekday', () => {
    const DOW = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    for (const { id, tier, input } of PERSONAS) {
      const plan = generateRulePlan(input, tier, PLAN_START)
      const last = plan.weeks[plan.weeks.length - 1]
      const [y, m, d] = last.date.split('-').map(Number)
      const start = new Date(y, m - 1, d)
      const end = new Date(start); end.setDate(end.getDate() + 6)
      const [ry, rm, rd] = input.race_date.split('-').map(Number)
      const race = new Date(ry, rm - 1, rd)

      expect(race >= start && race <= end, `${id}: final week must contain race day`).toBe(true)

      const placed = Object.entries(last.sessions).find(([, s]) => s?.type === 'race')?.[0]
      expect(placed, `${id}: race session placed on the wrong weekday`).toBe(DOW[(race.getDay() + 6) % 7])
    }
  })

  it('no week promises a session type it does not contain', () => {
    for (const { id, tier, input } of PERSONAS) {
      const plan = generateRulePlan(input, tier, PLAN_START)
      for (const w of plan.weeks) {
        const copy = `${w.label} ${w.theme}`.toLowerCase()
        const hasIntensity = Object.values(w.sessions).some(
          s => s?.type === 'quality' || s?.type === 'intervals' || s?.type === 'tempo')
        const hasHard = Object.values(w.sessions).some(s => s?.type === 'hard')
        if (/quality|threshold|tempo|interval|vo2/.test(copy)) {
          expect(hasIntensity || hasHard, `${id} w${w.n}: "${w.label}" / "${w.theme}"`).toBe(true)
        }
      }
    }
  })

  it('no user-facing copy contains a placeholder race name or athlete name', () => {
    for (const { id, tier, input } of PERSONAS) {
      const plan = generateRulePlan(input, tier, PLAN_START)
      const blob = JSON.stringify(plan)
      expect(blob.includes('Target Race'), `${id}: placeholder race name leaked`).toBe(false)
      expect(blob.includes('"athlete":"Athlete"'), `${id}: placeholder athlete name leaked`).toBe(false)
    }
  })
})
