// charityCohort.ts — the named charity-runner scenario set (2026-09-13).
//
// A charity partner refers first-timers running 10K / HM / MARATHON for a cause:
// low base, injuries common, finish goals, sometimes a compressed timeline, often
// older. The property sweep and cohort grid prove VALIDITY across a combinatorial
// grid, but marathon was thin on NAMED, asserted cases (0 in the real-input
// corpus) and there were no injury personas in the golden set — precisely the
// charity profile. This is the single source of those personas, consumed by:
//   - scripts/charity-scenarios.ts  (human/board-legible generate+validate report)
//   - lib/plan/charityCohort.test.ts (durable regression: 0 error violations,
//     or a by-design refusal)
//
// Add a persona here when a new real charity shape appears; both consumers pick
// it up. Keep it weighted to the high-risk end (marathon, injury, masters,
// compressed, low base) — that is where the doctrine is actually stressed.

import type { GeneratorInput } from '../../types/plan'

/** Fixed plan start (a Monday), like the golden set — never the wall clock. */
export const CHARITY_PLAN_START = '2026-04-27'
const DAY_MS = 86_400_000

export interface CharityPersona {
  id: string
  /** Which coaching doctrine this scenario stresses. */
  note: string
  /** Weeks from plan start to race day. */
  weeks: number
  /** True when a by-design refusal (prep-time / days-minimum) is the correct
   *  outcome — the plan is honest that it cannot promise the ask. */
  expectRefusal?: boolean
  input: Omit<GeneratorInput, 'race_date'>
}

export function charityRaceDate(weeks: number, planStart = CHARITY_PLAN_START): string {
  const d = new Date(planStart + 'T00:00:00Z')
  return new Date(d.getTime() + weeks * 7 * DAY_MS).toISOString().slice(0, 10)
}

export function charityInput(p: CharityPersona, planStart = CHARITY_PLAN_START): GeneratorInput {
  return { ...p.input, race_date: charityRaceDate(p.weeks, planStart) } as GeneratorInput
}

export const CHARITY_PERSONAS: CharityPersona[] = [
  // ---- MARATHON (the thin, high-risk distance) ----
  {
    id: 'M1 first-timer marathon, low base, long runway',
    note: '§2/§3 ramp off a tiny base; §45/§47 long-run floor vs §52 cap; volume-shortfall honesty',
    weeks: 24,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 15, longest_recent_run_km: 8,
      days_available: 4, age: 38, training_age: '<6mo', recent_quality_training: 'none' },
  },
  {
    id: 'M2 charity marathon, low base, COMPRESSED 12wk',
    note: '§44 prep-time honesty; time_compressed + volume_constrained classification',
    weeks: 12,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 10,
      days_available: 3, age: 41, training_age: '6-18mo', recent_quality_training: 'none',
      acknowledged_prep_warning: true },
  },
  {
    id: 'M3 returning marathon + knee history',
    note: '§90/ADR-022 injury delivered-volume levers; returning-runner allowance',
    weeks: 18,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 25, longest_recent_run_km: 14,
      days_available: 4, age: 44, training_age: '2-5yr', weeks_at_current_volume: 3,
      injury_history: ['knee'], recent_quality_training: 'none' },
  },
  {
    id: 'M4 sub-4:00 marathon, busy 3-day, weekday cap 45',
    note: 'time_target under a weekday cap on 3 days — by-design refusal (§44 days-minimum)',
    weeks: 16,
    expectRefusal: true,
    input: { race_distance_km: 42.2, goal: 'time_target', target_time: '4:00:00', current_weekly_km: 40,
      longest_recent_run_km: 20, days_available: 3, age: 36, max_weekday_mins: 45,
      training_age: '2-5yr', recent_quality_training: 'regular' },
  },
  {
    id: 'M5 masters charity marathon (age 58)',
    note: 'masters cadence; age→maxHR; injury vector (Willy/Sims)',
    weeks: 20,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 16,
      days_available: 4, age: 58, training_age: '2-5yr', recent_quality_training: 'occasional' },
  },
  // ---- HALF MARATHON ----
  {
    id: 'H1 first-timer HM, very low base',
    note: 'beginner duration-anchored; §52 lopsided-week → maintenance honesty',
    weeks: 16,
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 10, longest_recent_run_km: 5,
      days_available: 3, age: 34, training_age: '<6mo', recent_quality_training: 'none' },
  },
  {
    id: 'H2 charity HM + shin splints',
    note: 'injury caps; tissue tolerance vs fitness ramp',
    weeks: 14,
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 25, longest_recent_run_km: 12,
      days_available: 4, age: 40, training_age: '6-18mo', injury_history: ['shin_splints'],
      recent_quality_training: 'none' },
  },
  {
    id: 'H3 sub-2:00 HM, intermediate',
    note: 'quality onset (§89); pace bands; time_target build',
    weeks: 12,
    input: { race_distance_km: 21.1, goal: 'time_target', target_time: '1:59:00', current_weekly_km: 35,
      longest_recent_run_km: 16, days_available: 4, age: 33, training_age: '2-5yr',
      recent_quality_training: 'regular' },
  },
  // ---- 10K ----
  {
    id: 'T1 couch-to-10K charity beginner',
    note: 'low-vol short race; beginner structure; no phantom quality',
    weeks: 10,
    input: { race_distance_km: 10, goal: 'finish', current_weekly_km: 8, longest_recent_run_km: 4,
      days_available: 3, age: 37, training_age: '<6mo', recent_quality_training: 'none' },
  },
  {
    id: 'T2 sub-50 10K improver',
    note: 'time_target; intensity distribution at moderate volume',
    weeks: 10,
    input: { race_distance_km: 10, goal: 'time_target', target_time: '49:00', current_weekly_km: 30,
      longest_recent_run_km: 12, days_available: 4, age: 31, training_age: '2-5yr',
      recent_quality_training: 'regular' },
  },
  {
    id: 'T3 masters 10K + knee (age 55)',
    note: 'masters + injury combined; conservative ramp (delivered injury-cap + peak-not-below-start residuals cluster here)',
    weeks: 12,
    input: { race_distance_km: 10, goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 9,
      days_available: 4, age: 55, training_age: '2-5yr', injury_history: ['knee'],
      recent_quality_training: 'occasional' },
  },
]
