// FREE — infrastructure. ADR-027 v1.2 (ARCH-ENG-013), built in B2 (ADR027-B2-PROFILE). TYPES ONLY.
//
// What L1 is handed: a PURE snapshot of everything the product knows about one runner, as of one
// date. The engine never fetches; the route boundary assembles this (`lib/supabase/fetchRunnerFacts.ts`)
// and L1 (`buildRunnerProfile`) interprets it.
//
// `settings` and `observed` are `null` when they were NOT FETCHED, which is a different state from
// "fetched and empty" (an observed block with `run_count: 0`). Until the route adopts the fetcher
// (B2b), `runEngine` builds facts from the request alone, so both are null there.
//
// The observed figures are AGGREGATES, computed by L1's pure `aggregateObserved`
// (`lib/engine/profile/observed.ts`) so the validity bounds are applied in L1 only. Raw rows do not
// cross this boundary.

import type { GeneratorInput } from '@/types/plan'
import type { IsoDate } from './profile'
import type { FatigueTag } from '@/lib/coaching/completionVocab'

/** The `user_settings` columns L1 reads. Raw as stored: validity is L1's job. */
export interface SettingsFacts {
  birth_year: number | null
  date_of_birth: IsoDate | null
  resting_hr: number | null
  max_hr: number | null
  max_hr_source: 'observed' | 'user_confirmed' | null
  timezone: string | null
}

export interface ObservedAggregates {
  /** The date the windows end on (inclusive), in the runner's timezone when known. */
  as_of: IsoDate
  window_days: number
  run_log: {
    /** Deduplicated runs (`dedupeRuns`) inside the window whose distance, duration and pace
     *  pass the validity bounds. */
    run_count: number
    km_total: number
    longest_km: number | null
    /** Most recent run in the window carrying a valid max HR. */
    latest_max_hr: { bpm: number; date: IsoDate } | null
    /** First run on record, any date. null = no run ever logged. */
    first_run_date: IsoDate | null
    /** Rows in the window dropped by a validity bound (not duplicates). */
    excluded_rows: number
  }
  health: {
    /** Median of valid `rhr_bpm` over the 7 days ending `as_of`. */
    rhr_7d_median: number | null
    rhr_samples: number
  }
  completions: {
    /** Mean valid RPE over the last 14 days of the window, and over the 14 before. */
    rpe_recent_mean: number | null
    rpe_prior_mean: number | null
    rpe_n: number
    fatigue_counts: Record<FatigueTag, number>
    fatigue_latest: FatigueTag | null
  }
  analyses: {
    ef_trend_pct_latest: number | null
    n: number
  }
}

export interface RunnerFacts {
  facts_version: 1
  /** The request as posted. Client-computed values in it (age, recommended level, device HR)
   *  are STATED facts that L1 re-derives, never trusted as derived (ARCH-ENG-013). */
  input: GeneratorInput
  settings: SettingsFacts | null
  observed: ObservedAggregates | null
}

/** `as_of` resolved for one runner: the date, the zone it was resolved in, and whether that
 *  zone can be trusted (ARCH-ENG-019). */
export interface ResolvedAsOf {
  as_of: IsoDate
  timezone: string | null
  timezone_known: boolean
}

/** ARCH-ENG-013's one owner, as a type. Implemented at the route boundary, outside the purity
 *  gate. `now` is the request's instant; the implementation resolves `as_of` in the runner's
 *  timezone from it. */
export type AssembleRunnerFacts = (userId: string, input: GeneratorInput, now: Date) => Promise<RunnerFacts>
