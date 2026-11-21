// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS), revised to v2 in B2 (ADR027-B2-PROFILE).
//
// L1's canonical truth: who the runner is, as of one date. Produced by ONE function,
// `buildRunnerProfile` (`lib/engine/profile/buildRunnerProfile.ts`), from a `RunnerFacts`
// snapshot (`./facts.ts`). Every derived field delegates to the function that owned it before
// L1 existed; the owner is named on the field.
//
// v1 → v2 (ADR-027 v1.2, data dictionary 2026-11-21 § 3):
//   - every runner fact is a `Fact<T>` (`{ value, source }`) or `null` (ARCH-ENG-014);
//   - an `observed` block, carried and NOT read by the planner (prescribing from it is a
//     pending Coaching Board ruling);
//   - validity bounds turn an out-of-range value into `null`, and the profile says which;
//   - one age owner; `as_of` resolved in the runner's timezone, with an unknown timezone flagged;
//   - two weeks-to-race counters, named, because the engine uses both today.
//
// Absence is explicit: `null`, never a default (MAXHR-AGE-ABSENT-01).

import type { TrainingAge } from '@/types/plan'
import type { FatigueTag } from '@/lib/coaching/completionVocab'

export type Level = 'beginner' | 'intermediate' | 'experienced'
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type IsoDate = string

/** ARCH-ENG-014's precedence, highest first: a fact from a device or the run log, a value the
 *  runner saved in Profile, a value posted with the request, a value the engine computed. */
export type FactSource = 'observed' | 'confirmed' | 'stated' | 'derived'
export const FACT_PRECEDENCE: readonly FactSource[] = ['observed', 'confirmed', 'stated', 'derived']

export interface Fact<T> { value: T; source: FactSource }

/** One day's room for running. `max_km` is minutes ÷ the runner's easy min/km (HLD § 3). */
export interface DayCapacity {
  day: DayKey
  /** Not in `days_cannot_train`. */
  available: boolean
  /** `day_budgets[day]`, else `max_weekday_mins` on Mon–Fri; null = no cap stated (weekends
   *  carry the long run and have no cap concept, §81). */
  max_minutes: number | null
  /** null when `max_minutes` is null. */
  max_km: number | null
}

export interface WeekCapacity {
  days: Record<DayKey, DayCapacity>
  /** Count of `available` days. */
  available_days: number
  /** Sum of the available days' minutes; null if any available day is uncapped. */
  total_minutes: number | null
  /** The easy pace the km figures were converted at; null when the level is outside the enum
   *  (L1 runs before input validation). */
  easy_min_per_km: number | null
}

export interface RunnerProfile {
  profile_version: 2
  /** ARCH-ENG-005 / -019: the date the profile is evaluated at, in the runner's timezone when
   *  known. Never read from a clock inside L1. */
  as_of: IsoDate
  /** The IANA zone `as_of` was resolved in; null when unknown. */
  timezone: string | null
  /** False when the timezone was unset, invalid, or `UTC` (a default for 22 of 56 runners,
   *  data dictionary § 2.6). `as_of` is then the server's local date, as before L1. */
  timezone_known: boolean

  /** The request's target. Not wrapped in `Fact`: it is what the runner asked for, never a
   *  measurement with a competing source. */
  race: {
    distance_km: number
    date: IsoDate
    name: string | null
    /** The goal the engine plans and checks against: `coherentGoal`'s, so a time target with no time is a
     *  finish goal. B3 (2026-11-21): this is what the verifier reads, because it may not import the normaliser. */
    goal: 'finish' | 'time_target'
    /** The goal as the request sent it, before normalising. Kept so the difference stays visible. */
    goal_stated: 'finish' | 'time_target'
    target_time: string | null
  }
  weeks_to_race: {
    /** The PLANNING counter: `weeksBetweenLocal(plan_start, race.date)`. What the engine
     *  builds and refuses on. null when the race date does not parse. */
    plan: number | null
    /** The DISPLAY / telemetry counter: `weeksUntilRaceSigned(race.date, as_of instant)`
     *  (`lib/format.ts`). Rounded and signed. Kept separate because the refusal telemetry
     *  records it and the two differ (HLD cause 5). */
    display: number | null
  }
  plan_start: IsoDate

  /** §79's two axes, from `derivedLevelsFor` (→ `vdotFor` + `resolveLevels`). */
  levels: {
    declared: Fact<Level> | null
    assessed_structural: Fact<Level>
    assessed_intensity: Fact<Level>
    structural: Fact<Level>
    intensity: Fact<Level>
    /** `GeneratorInput.fitness_level`: the API override, which no product path sends. */
    api_override: Fact<Level> | null
  }
  /** `vdotFor`, with §10's staleness ramp evaluated at the `as_of` instant. */
  vdot: Fact<{ value: number; raw: number; discount_pct: number; benchmark_date: IsoDate | null }> | null
  volume: {
    declared_weekly_km: Fact<number>
    /** `effectiveStartKm`. */
    effective_start_km: Fact<number>
    longest_recent_run_km: Fact<number>
    weeks_at_current_volume: Fact<number> | null
  }
  physiology: {
    /** One owner: `user_settings.birth_year` (age at `as_of`'s year, may read one high before
     *  the birthday), else `date_of_birth`, else the posted `age`. */
    age: Fact<number> | null
    /** Observed 7-day median, else `user_settings.resting_hr`, else the posted value. */
    resting_hr: Fact<number> | null
    /** `user_settings.max_hr` (its `max_hr_source` decides observed / confirmed), else the
     *  posted value (stated: a device reading made on the client is a stated input, ARCH-ENG-013). */
    max_hr: Fact<number> | null
  }
  experience: {
    training_age: Fact<TrainingAge> | null
    recent_quality_training: Fact<'none' | 'occasional' | 'regular'> | null
  }
  /** Injury chips (`injury_history`); an empty list is a real answer. */
  injuries: Fact<string[]> | null
  schedule: {
    days_available: Fact<number>
    blocked_days: Fact<DayKey[]>
    preferred_long_run_day: Fact<'sat' | 'sun'> | null
    /** NEW in L1. Nothing in the planner reads it yet. */
    capacity: Fact<WeekCapacity>
  }
  preferences: {
    hard_session_relationship: Fact<'avoid' | 'neutral' | 'love' | 'overdo'> | null
    terrain: Fact<'road' | 'trail' | 'mixed'> | null
  }
  acknowledgements: { prep_warning: boolean; days_warning: boolean }

  /** CARRIED, NOT READ. Aggregates of the run log, health samples, completions and analyses
   *  as of `as_of` (`RunnerFacts.observed`). Every value here is `source: 'observed'`. All null
   *  when the facts were built from the request alone (`available: false`). */
  observed: {
    available: boolean
    window_days: number | null
    logged_km_28d: Fact<number> | null
    logged_longest_run_km: Fact<number> | null
    run_count_28d: Fact<number> | null
    /** Days from the first run on record to `as_of`, inclusive. */
    log_coverage_days: Fact<number> | null
    rhr_7d_median: Fact<number> | null
    latest_max_hr: Fact<{ bpm: number; date: IsoDate }> | null
    rpe_trend: Fact<{ recent_mean: number | null; prior_mean: number | null; n: number }> | null
    /** Counts over `FATIGUE_TAGS`; the legacy `Cooked` tag is not counted. */
    fatigue_trend: Fact<{ counts: Record<FatigueTag, number>; latest: FatigueTag | null }> | null
    ef_trend_pct_latest: Fact<number> | null
  }

  /** Every value a validity bound turned into `null`, as `<store>.<field>`, plus the count of
   *  activity-log rows excluded. Data quality, never prescription. */
  data_quality: { nulled: string[]; excluded_log_rows: number }
}
