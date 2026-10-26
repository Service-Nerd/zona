// GRID-SLOW-GOALGAP-01 (2026-10-26) — the runners the grids never reached.
//
// The 26 Oct coach-engine RCA (`docs/investigations/2026-10-26-coach-engine-digest-rca.md`) found three live defects
// that every check passed: goal-anchored work priced faster than the runner can run, two quality shapes with no §9
// floor, and floor-protected easy runs over their day with no note. All three live where the grids did not: the
// slowest swept benchmark was HM 2:30 (VDOT ~29) and the cohort grid's 5K 27:30 (~34), while 4 of 18 benchmarked live
// plans sit below 29 and one at 16.2. And the goal never moved relative to fitness: one fixed target per distance.
//
// Two axes, so a check asks about the runner it will meet:
//   SLOW_BENCHMARKS — five benchmarks below the sweep's old floor;
//   GOAL_GAPS       — how much faster than current fitness predicts the stated goal is.
//
// Pure: no I/O, no engine import. The sweep clones random inputs onto it (`property-validate-plans.ts`), and
// `scripts/measure-goal-gap.ts` walks it whole.

import { benchmarkVdot } from './benchmarkCheck'
import { estimateRaceSeconds, formatRaceTime } from './aerobicEstimate'

export const SLOW_BENCHMARKS = [
  { type: 'race', distance_km: 5, time: '0:35:00' },
  { type: 'race', distance_km: 5, time: '0:40:00' },
  { type: 'race', distance_km: 21.1, time: '3:00:00' },
  { type: 'race', distance_km: 42.2, time: '6:00:00' },
  { type: 'race', distance_km: 42.2, time: '7:30:00' },
] as const

/** Goal faster than current fitness predicts by this share: 0 = the goal IS current fitness. */
export const GOAL_GAPS = [0, 0.05, 0.15, 0.3] as const

/** The time target for `distanceKm` that is `gap` faster than `benchmark` predicts. */
export function targetForGap(benchmark: { distance_km: number; time: string }, distanceKm: number, gap: number): string {
  const vdot = benchmarkVdot(benchmark)
  if (vdot == null) throw new Error(`unreadable benchmark ${JSON.stringify(benchmark)}`)
  // Rounded first: `formatRaceTime` rounds the seconds remainder on its own, so 59.5 s would print ':60'.
  return formatRaceTime(Math.round(estimateRaceSeconds(vdot, distanceKm) * (1 - gap)))
}

/** Plan start = next Monday; benchmark = 14 days ago. LOCAL dates, as the engine validates (`localIsoDate`): a UTC
 *  date is "yesterday" east of Greenwich in the morning. */
export function slowGoalDates(now = new Date()): { planStart: string; benchmarkDate: string } {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7))
  const bench = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14)
  return { planStart: iso(start), benchmarkDate: iso(bench) }
}

export const SLOW_DISTANCES = [
  { km: 5, weeks: 10 }, { km: 10, weeks: 12 }, { km: 21.1, weeks: 16 }, { km: 42.2, weeks: 18 },
] as const

export type SlowGoalCase = {
  race_distance_km: number; race_date: string; goal: 'time_target'; target_time: string; benchmark: { type: string; distance_km: number; time: string; benchmark_date: string }
  fitness_level: 'beginner' | 'intermediate'; days_available: number; current_weekly_km: number; longest_recent_run_km: number
  max_weekday_mins?: number; age: number; training_age: '1-2yr'; recent_quality_training: 'occasional'; injury_history: []
  acknowledged_prep_warning: true; gap: number
}

/** Every case, deterministic: 5 benchmarks × 4 distances × 4 gaps × 2 levels × 3 day counts × 2 weekday budgets. */
/** `benchmarkDate` must be in the past and inside the engine's benchmark-age window, so callers derive it from today
 *  (`slowGoalDates`) rather than pinning one: a pinned date expires, which is PINNED-CLOCK-01's class. */
export function slowGoalGrid(planStart: string, benchmarkDate: string): SlowGoalCase[] {
  const raceIn = (w: number) => new Date(Date.parse(`${planStart}T00:00:00Z`) + (w * 7 - 1) * 864e5).toISOString().slice(0, 10)
  const out: SlowGoalCase[] = []
  for (const b of SLOW_BENCHMARKS) for (const d of SLOW_DISTANCES) for (const gap of GOAL_GAPS)
    for (const fitness_level of ['beginner', 'intermediate'] as const) for (const days_available of [3, 4, 5]) for (const mwm of [undefined, 30]) {
      const current_weekly_km = fitness_level === 'beginner' ? 10 : 20
      out.push({
        race_distance_km: d.km, race_date: raceIn(d.weeks), goal: 'time_target', target_time: targetForGap(b, d.km, gap),
        benchmark: { ...b, benchmark_date: benchmarkDate }, fitness_level, days_available, current_weekly_km,
        longest_recent_run_km: Math.max(3, Math.round(current_weekly_km / 2.5)), ...(mwm ? { max_weekday_mins: mwm } : {}),
        age: 38, training_age: '1-2yr', recent_quality_training: 'occasional', injury_history: [], acknowledged_prep_warning: true, gap,
      })
    }
  return out
}
