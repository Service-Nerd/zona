// COHORT-SHAPE-01 — the fixed population the shape regression measures.
//
// DELIBERATELY EXHAUSTIVE, NOT SAMPLED. `property-validate-plans.ts` samples
// 20,000 inputs from a seeded RNG, which is right for finding rare violations
// and wrong here: a sampled grid's RATES wobble between runs, and a regression
// harness whose baseline moves on its own teaches everyone to ignore it.
// Every combination below runs, every time, in the same order.
//
// Pinned `planStart`. A grid that reads the wall clock silently changes what it
// measures — SWEEP-VACUOUS-01, where a time-dependent grid stopped generating
// and reported a clean bill of health for months.
//
// ENUM VALUES ARE THE REAL ONES. Three separate measurement grids on
// 2026-09-11 passed `fitness_level: 'advanced'`, `recent_quality_training:
// 'occasionally'` and `hard_session_relationship: 'regularly'` — none of which
// exist. The engine matched none of them, fell to defaults, and produced
// hundreds of valid plans from inputs that were partly fiction. §55 rejects
// those now (`InputEnumError`), so this grid cannot silently drift that way
// again: a typo here throws rather than quietly measuring the wrong cohort.

import type { GeneratorInput } from '@/types/plan'

export const COHORT_PLAN_START = '2026-04-27'

/** Race dates derived from the pinned start, never from `new Date()`. */
const raceDateIn = (weeks: number) =>
  new Date(new Date(`${COHORT_PLAN_START}T00:00:00Z`).getTime() + weeks * 7 * 86_400_000)
    .toISOString().slice(0, 10)

const DISTANCES = [
  { km: 5,    target: '0:25:00', weeks: 12 },
  { km: 10,   target: '0:52:00', weeks: 12 },
  { km: 21.1, target: '1:55:00', weeks: 16 },
  { km: 42.2, target: '4:15:00', weeks: 18 },
] as const

const VOLUMES = [20, 35, 50] as const
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const
const DAY_SETS = [
  { days_available: 3, days_cannot_train: ['tue', 'thu'] },
  { days_available: 4, days_cannot_train: [] as string[] },
  { days_available: 5, days_cannot_train: ['tue'] },
] as const
/** `undefined` matters as much as a value — most runners never set a cap. */
const CAPS = [30, 60, undefined] as const
const GOALS = ['finish', 'time_target'] as const

/** 4 x 3 x 3 x 3 x 3 x 2 = 648 inputs. Exhaustive and ordered. */
export function cohortGrid(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  for (const d of DISTANCES)
    for (const cwk of VOLUMES)
      for (const level of LEVELS)
        for (const days of DAY_SETS)
          for (const cap of CAPS)
            for (const goal of GOALS) {
              out.push({
                athlete_name: 'Athlete',
                age: 35,
                race_name: 'Test',
                primary_metric: 'distance',
                plan_start: COHORT_PLAN_START,
                race_distance_km: d.km,
                race_date: raceDateIn(d.weeks),
                goal,
                ...(goal === 'time_target' ? { target_time: d.target } : {}),
                resting_hr: 55,
                max_hr: 184,                    // Tanaka at 35, pinned
                current_weekly_km: cwk,
                longest_recent_run_km: Math.max(3, Math.round(cwk * 0.4)),
                fitness_level: level,
                recent_quality_training: 'occasional',
                hard_session_relationship: 'neutral',
                injury_history: [],
                ...(cap !== undefined ? { max_weekday_mins: cap } : {}),
                ...days,
              } as unknown as GeneratorInput)
            }
  return out
}

/** A refusal is the engine working (§44 prep-time, days-per-week minimums).
 *  Anything else that throws is a real failure and must not be counted as one. */
export const COHORT_REFUSAL =
  /is not enough preparation|days\/week is (not enough|below)|is below the recommended \d+-week minimum/
