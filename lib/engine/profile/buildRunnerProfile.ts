// FREE — infrastructure. ADR-027 B2 (ADR027-B2-PROFILE). L1: the ONE producer of `RunnerProfile`.
//
// PURE. No clock (the instant is an argument, ARCH-ENG-005), no I/O (the facts are an argument,
// ARCH-ENG-013), no throw on a malformed input (absence is `null` and is named in `data_quality`).
//
// 🔑 IT DERIVES NOTHING ITSELF. Every derived field calls the function that owned it before L1:
// `derivedLevelsFor` (→ `vdotFor` + `resolveLevels`), `vdotFor`, `effectiveStartKm`,
// `weeksBetweenLocal`, `weeksUntilRaceSigned`, `normaliseDays`, `buildPaceFromVDOT` /
// `buildFallbackPace`. A second copy of any of them is the drift class this repo keeps paying for.
//
// ⚠️ THE ENGINE STILL PRESCRIBES FROM THE REQUEST. Derived fields are computed from `facts.input`
// exactly as the engine sees it, so they equal what generation uses. The higher-precedence facts
// (settings, observed) are CARRIED on the profile and read by no planner: prescribing from them is
// a pending Coaching Board ruling (ARCH-ENG-014). The validity bounds therefore null CARRIED facts;
// they never alter an input a derivation reads.

import type { GeneratorInput } from '@/types/plan'
import type { RunnerFacts, SettingsFacts } from '@/lib/engine/contracts/facts'
import type { DayCapacity, DayKey, Fact, FactSource, IsoDate, RunnerProfile, WeekCapacity } from '@/lib/engine/contracts/profile'
import { derivedLevelsFor, vdotFor, buildFallbackPace } from '@/lib/plan/ruleEngine'
import { buildPaceFromVDOT } from '@/lib/plan/paceBands'
import { effectiveStartKm } from '@/lib/plan/startVolume'
import { INPUT_ENUMS } from '@/lib/plan/inputs'
import { formatDate, nextMonday, parseDateLocal, weeksBetweenLocal } from '@/lib/plan/length'
import { normaliseDays, DAY_ORDER } from '@/lib/plan/days'
import { weeksUntilRaceSigned } from '@/lib/format'
import { calendarDaysBetween } from '@/lib/dates'
import { VALIDITY, within, benchmarkUsable } from './validity'
import { resolveAsOf } from './asOf'

export interface BuildProfileOptions {
  /** The instant the profile is evaluated at. A `Date` is the exact moment (§10's staleness ramp
   *  is measured to it, as `vdotFor` measures to the wall clock); an `IsoDate` is that date's
   *  local midnight. */
  asOf: Date | IsoDate
  /** IANA zone. null/`UTC`/invalid → `timezone_known: false`. */
  timezone: string | null
  /** The engine's plan start. Defaults to the Monday after `asOf`, as `runEngine` defaults it. */
  planStart?: IsoDate
}

const stated = <T,>(v: T | undefined | null): Fact<T> | null => (v === undefined || v === null ? null : { value: v, source: 'stated' })
const derived = <T,>(v: T): Fact<T> => ({ value: v, source: 'derived' })
const observed = <T,>(v: T | undefined | null): Fact<T> | null => (v === undefined || v === null ? null : { value: v, source: 'observed' })

/** The highest-precedence non-null candidate (ARCH-ENG-014). Candidates are listed in precedence
 *  order by the caller, so the first present one wins. */
const firstFact = <T,>(...cs: (Fact<T> | null)[]): Fact<T> | null => cs.find(c => c !== null) ?? null

function ageFact(s: SettingsFacts | null, input: GeneratorInput, asOf: IsoDate, nulled: string[]): Fact<number> | null {
  const asOfYear = Number(asOf.slice(0, 4))
  if (s?.birth_year !== null && s?.birth_year !== undefined) {
    const a = within(asOfYear - Number(s.birth_year), VALIDITY.age)
    if (a !== null) return { value: a, source: 'confirmed' }
    nulled.push('settings.birth_year')
  }
  if (s?.date_of_birth) {
    const dob = parseDateLocal(String(s.date_of_birth).slice(0, 10))
    const at = parseDateLocal(asOf)
    if (Number.isFinite(dob.getTime())) {
      const had = at.getMonth() > dob.getMonth() || (at.getMonth() === dob.getMonth() && at.getDate() >= dob.getDate())
      const a = within(at.getFullYear() - dob.getFullYear() - (had ? 0 : 1), VALIDITY.age)
      if (a !== null) return { value: a, source: 'confirmed' }
    }
    nulled.push('settings.date_of_birth')
  }
  return boundedStated(input.age, VALIDITY.age, 'input.age', nulled)
}

function boundedStated(v: unknown, b: { min: number; max: number }, name: string, nulled: string[]): Fact<number> | null {
  if (v === undefined || v === null) return null
  const n = within(v, b)
  if (n === null) { nulled.push(name); return null }
  return { value: n, source: 'stated' }
}

function boundedSetting(v: unknown, b: { min: number; max: number }, name: string, source: FactSource, nulled: string[]): Fact<number> | null {
  if (v === undefined || v === null) return null
  const n = within(v, b)
  if (n === null) { nulled.push(name); return null }
  return { value: n, source }
}

function capacityFor(input: GeneratorInput, blocked: Set<DayKey>, easyMinPerKm: number | null): WeekCapacity {
  const weekday = new Set<DayKey>(['mon', 'tue', 'wed', 'thu', 'fri'])
  const days = {} as Record<DayKey, DayCapacity>
  let total = 0, uncapped = false, available = 0
  for (const day of DAY_ORDER) {
    const budget = weekday.has(day)
      ? (input.day_budgets?.[day as 'mon'] ?? input.max_weekday_mins ?? null)
      : null
    const mins = typeof budget === 'number' && Number.isFinite(budget) ? budget : null
    const isAvailable = !blocked.has(day)
    days[day] = {
      day, available: isAvailable, max_minutes: mins,
      max_km: mins === null || easyMinPerKm === null ? null : Math.round((mins / easyMinPerKm) * 10) / 10,
    }
    if (isAvailable) { available++; if (mins === null) uncapped = true; else total += mins }
  }
  return { days, available_days: available, total_minutes: uncapped ? null : total, easy_min_per_km: easyMinPerKm }
}

export function buildRunnerProfile(facts: RunnerFacts, opts: BuildProfileOptions): RunnerProfile {
  const input = facts.input
  const nulled: string[] = []

  // ── as_of ── an instant from the caller, resolved in the runner's zone (ARCH-ENG-019).
  const instant = typeof opts.asOf === 'string' ? parseDateLocal(opts.asOf) : opts.asOf
  const frame = typeof opts.asOf === 'string'
    ? { ...resolveAsOf(instant, opts.timezone), as_of: opts.asOf }
    : resolveAsOf(instant, opts.timezone)
  const planStart = opts.planStart ?? formatDate(nextMonday(instant))

  // ── VDOT + levels ── through the owners. A benchmark `vdotFor` would crash on is treated as
  // absent and named, so building a profile can never be the thing that throws.
  const usable = input.benchmark === undefined || benchmarkUsable(input.benchmark)
  if (!usable) nulled.push('input.benchmark')
  const priced: GeneratorInput = usable ? input : { ...input, benchmark: undefined }
  const v = vdotFor(priced, instant)
  const l = derivedLevelsFor(priced, instant)

  const vdotFact: RunnerProfile['vdot'] = v.vdot !== undefined && v.vdotRaw !== undefined
    ? derived({ value: v.vdot, raw: v.vdotRaw, discount_pct: v.discountPct, benchmark_date: priced.benchmark?.benchmark_date ?? null })
    : null

  // ── Physiology ── precedence: observed > confirmed (settings) > stated (request).
  const s = facts.settings
  const obs = facts.observed
  const settingsMaxSource: FactSource = s?.max_hr_source === 'observed' ? 'observed'
    : s?.max_hr_source === 'user_confirmed' ? 'confirmed' : 'stated'

  const blocked = normaliseDays(input.days_cannot_train)
  // Code review 2026-11-21: L1 runs BEFORE `validateInputFields`, so an out-of-enum level must not
  // throw here. It would replace the named InputEnumError with an anonymous TypeError. An unknown
  // level gives no pace (absence), and generation then refuses the input exactly as before.
  const levelKnown = INPUT_ENUMS.fitness_level.includes(l.structural)
  const easyMinPerKm: number | null = v.vdot !== undefined && v.vdotRaw !== undefined
    ? buildPaceFromVDOT(v.vdot, v.vdotRaw).minPerKmEasy
    : levelKnown ? buildFallbackPace(l.structural).minPerKmEasy : null
  if (easyMinPerKm === null) nulled.push('schedule.capacity.easy_min_per_km')

  const weeksPlan = weeksBetweenLocal(planStart, input.race_date)

  const fatigue = obs ? obs.completions : null
  return {
    profile_version: 2,
    as_of: frame.as_of,
    timezone: frame.timezone,
    timezone_known: frame.timezone_known,
    race: {
      distance_km: input.race_distance_km,
      date: input.race_date,
      name: input.race_name ?? null,
      goal: input.goal,
      target_time: input.target_time ?? null,
    },
    weeks_to_race: {
      plan: Number.isFinite(weeksPlan) ? weeksPlan : null,
      display: weeksUntilRaceSigned(input.race_date, instant),
    },
    plan_start: planStart,
    levels: {
      declared: stated(l.declared),
      assessed_structural: derived(l.assessedStructural),
      assessed_intensity: derived(l.assessedIntensity),
      structural: derived(l.structural),
      intensity: derived(l.intensity),
      api_override: stated(input.fitness_level),
    },
    vdot: vdotFact,
    volume: {
      declared_weekly_km: { value: input.current_weekly_km, source: 'stated' },
      effective_start_km: derived(effectiveStartKm(input)),
      longest_recent_run_km: { value: input.longest_recent_run_km, source: 'stated' },
      weeks_at_current_volume: stated(input.weeks_at_current_volume),
    },
    physiology: {
      age: ageFact(s, input, frame.as_of, nulled),
      resting_hr: firstFact(
        observed(obs?.health.rhr_7d_median),
        boundedSetting(s?.resting_hr, VALIDITY.resting_hr, 'settings.resting_hr', 'confirmed', nulled),
        boundedStated(input.resting_hr, VALIDITY.resting_hr, 'input.resting_hr', nulled),
      ),
      max_hr: firstFact(
        boundedSetting(s?.max_hr, VALIDITY.max_hr, 'settings.max_hr', settingsMaxSource, nulled),
        boundedStated(input.max_hr, VALIDITY.max_hr, 'input.max_hr', nulled),
      ),
    },
    experience: {
      training_age: stated(input.training_age),
      recent_quality_training: stated(input.recent_quality_training),
    },
    injuries: stated(input.injury_history),
    schedule: {
      days_available: { value: input.days_available, source: 'stated' },
      blocked_days: { value: DAY_ORDER.filter(d => blocked.has(d)), source: 'stated' },
      preferred_long_run_day: stated(input.preferred_long_run_day),
      capacity: derived(capacityFor(input, blocked, easyMinPerKm)),
    },
    preferences: {
      hard_session_relationship: stated(input.hard_session_relationship),
      terrain: stated(input.terrain),
    },
    acknowledgements: {
      prep_warning: input.acknowledged_prep_warning === true,
      days_warning: (input as GeneratorInput & { acknowledged_days_warning?: boolean }).acknowledged_days_warning === true,
    },
    observed: {
      available: obs !== null,
      window_days: obs?.window_days ?? null,
      logged_km_28d: observed(obs?.run_log.km_total),
      logged_longest_run_km: observed(obs?.run_log.longest_km),
      run_count_28d: observed(obs?.run_log.run_count),
      log_coverage_days: observed(obs?.run_log.first_run_date
        ? Math.max(0, daysInclusive(obs.run_log.first_run_date, frame.as_of))
        : null),
      rhr_7d_median: observed(obs?.health.rhr_7d_median),
      latest_max_hr: observed(obs?.run_log.latest_max_hr),
      rpe_trend: fatigue ? observed({ recent_mean: fatigue.rpe_recent_mean, prior_mean: fatigue.rpe_prior_mean, n: fatigue.rpe_n }) : null,
      fatigue_trend: fatigue ? observed({ counts: fatigue.fatigue_counts, latest: fatigue.fatigue_latest }) : null,
      ef_trend_pct_latest: observed(obs?.analyses.ef_trend_pct_latest),
    },
    data_quality: { nulled, excluded_log_rows: obs?.run_log.excluded_rows ?? 0 },
  }
}

function daysInclusive(from: IsoDate, to: IsoDate): number {
  return calendarDaysBetween(from, to) + 1
}

/** The facts the request alone carries: no settings, no observed block. The `runEngine` path until
 *  the route adopts the fetcher (B2b). */
export function factsFromInput(input: GeneratorInput): RunnerFacts {
  return { facts_version: 1, input, settings: null, observed: null }
}
