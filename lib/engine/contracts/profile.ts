// FREE — infrastructure. ADR-027 B1 (ADR027-B1-CONTRACTS). TYPES ONLY.
//
// L1's canonical truth: who the runner is. Nothing produces a RunnerProfile yet —
// B2 builds the one normaliser that does, and the current engine adopts it first.
// Today the same facts are derived in several places (`resolveLevels`, `vdotFor`,
// `effectiveStartKm`, `effectiveBaseline`, `recommendFitnessLevel`,
// `validatePrepTime`); each field below names the function that owns it today.
//
// Absence is explicit. A missing fact is `null`, or for age a `{ known: false }`
// variant, never a default (MAXHR-AGE-ABSENT-01: the wizard's `: 30` fabricated an
// age for 16 of 56 runners).

import type { TrainingAge } from '@/types/plan'

export type Level = 'beginner' | 'intermediate' | 'experienced'
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
export type IsoDate = string

/** One day's room for running. `max_km` is minutes × the runner's easy pace, the
 *  conversion the volume curve never had (HLD § 3, WeekCapacity). */
export interface DayCapacity {
  day: DayKey
  available: boolean
  /** From `max_weekday_mins` / `day_budgets`; null = no cap stated. */
  max_minutes: number | null
  /** null when `max_minutes` is null or no easy pace is known. */
  max_km: number | null
}

export interface WeekCapacity {
  days: Record<DayKey, DayCapacity>
  /** Count of `available` days. */
  available_days: number
  /** Sum of the capped days' minutes; null if any available day is uncapped. */
  total_minutes: number | null
}

export type AgeFact = { known: true; years: number } | { known: false }

export interface RunnerProfile {
  profile_version: 1
  /** ARCH-ENG-005: the profile is evaluated at this date, never the wall clock. */
  as_of: IsoDate
  race: {
    distance_km: number
    date: IsoDate
    name: string | null
    goal: 'finish' | 'time_target'
    target_time: string | null
  }
  /** ONE weeks-to-race counter (HLD cause 5: today `weeksBetweenLocal` and
   *  `weeksUntilRaceSigned` are both in use). Defined in B2. */
  weeks_to_race: number
  /** §79's two axes, as `derivedLevelsFor` resolves them today. */
  levels: {
    declared: Level | null
    assessed_structural: Level
    assessed_intensity: Level
    structural: Level
    intensity: Level
    /** `GeneratorInput.fitness_level`: the API override, which no product path sends. */
    api_override: Level | null
  }
  /** `vdotFor`. `discount_pct` is §10's staleness ramp, evaluated at `as_of`. */
  vdot: { value: number; raw: number; discount_pct: number; benchmark_date: IsoDate | null } | null
  volume: {
    declared_weekly_km: number
    /** `effectiveStartKm`. */
    effective_start_km: number
    longest_recent_run_km: number
    /** True when the figure came from the activity log at a checkpoint. */
    observed: boolean
    weeks_at_current_volume: number | null
  }
  physiology: {
    age: AgeFact
    resting_hr: number | null
    max_hr: { bpm: number; source: 'observed' | 'user_confirmed' | 'stated' } | null
  }
  experience: {
    training_age: TrainingAge | null
    recent_quality_training: 'none' | 'occasional' | 'regular' | null
  }
  /** Injury chips as constraint tags (`injury_history`). */
  injuries: string[]
  schedule: {
    days_available: number
    blocked_days: DayKey[]
    preferred_long_run_day: 'sat' | 'sun'
    capacity: WeekCapacity
  }
  preferences: {
    hard_session_relationship: 'avoid' | 'neutral' | 'love' | 'overdo' | null
    terrain: 'road' | 'trail' | 'mixed' | null
  }
  acknowledgements: { prep_warning: boolean; days_warning: boolean }
}
