// FREE — infrastructure. ADR027-B2-PROFILE. L1's observed aggregates: what the run log, the health
// series, the completions and the analyses say, as of one date. PURE: the fetcher at the route
// boundary hands in rows and this decides what they mean, so every validity bound is applied in L1.
//
// 🔑 THE LOG IS A FLOOR, NOT THE TRUTH (data dictionary § 2.2): it holds only runs that reached the
// activity log. These figures are CARRIED on the profile. Whether the planner reads them is a pending
// Coaching Board ruling (§2/§106's starting-volume question); nothing here prescribes.
//
// Reuses the owners: `isRun` and `dedupeRuns` (the same physical run ingested twice is 4.2% of the
// log, LOAD-DEDUPE), `runDistance` (measured wins, a typed distance fills only an unmeasured run).

import { isRun, dedupeRuns, type ActivityLogRow } from '@/lib/coaching/weeklyActualLoad'
import { runDistance } from '@/lib/health/runDistance'
import { calendarDaysBetween } from '@/lib/dates'
import { VALIDITY, within } from './validity'
import { localDateOf } from './asOf'
import { FATIGUE_TAGS, type FatigueTag } from '@/lib/coaching/completionVocab'
import type { ObservedAggregates, ResolvedAsOf } from '@/lib/engine/contracts/facts'

/** The observed window. Four weeks: the span the data dictionary compared declared volume over. */
export const OBSERVED_WINDOW_DAYS = 28
const RHR_WINDOW_DAYS = 7
const RPE_HALF_WINDOW_DAYS = 14

export interface RunRow extends ActivityLogRow {
  moving_time_s?: number | null
  max_hr?: number | null
}
export interface HealthRow { sample_date: string; rhr_bpm: number | null }
export interface CompletionRow { created_at: string; rpe: number | null; fatigue_tag: string | null }
export interface AnalysisRow { created_at: string; ef_trend_pct: number | null }

export interface ObservedRows {
  runs: readonly RunRow[]
  /** `start_date` of the first run on record, any date; null when none. */
  first_run_at: string | null
  health: readonly HealthRow[]
  completions: readonly CompletionRow[]
  analyses: readonly AnalysisRow[]
}

const FATIGUE: readonly FatigueTag[] = FATIGUE_TAGS

/** Days back from `as_of`: 0 = that day. null when the date does not parse. */
function ageDays(date: string | null, asOf: string): number | null {
  if (!date) return null
  const n = calendarDaysBetween(date, asOf)
  return Number.isFinite(n) ? n : null
}
const inWindow = (age: number | null, days: number) => age !== null && age >= 0 && age < days

function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** A run L1 believes: a distance, a duration and a pace all inside their bounds. A run with no
 *  recorded duration is kept on distance alone: a manual log entered by distance stores
 *  `moving_time_s: 0` (`adaptManualRun`), so 0 is "no duration", not a 0-second run. */
function validRunKm(r: RunRow): number | null {
  const d = runDistance(r)
  const km = d ? within(d.km, VALIDITY.run_km) : null
  if (km === null) return null
  if (r.moving_time_s === null || r.moving_time_s === undefined || r.moving_time_s <= 0) return km
  const s = within(r.moving_time_s, VALIDITY.run_moving_s)
  if (s === null) return null
  return within(s / 60 / km, VALIDITY.run_pace_min_per_km) === null ? null : km
}

export function aggregateObserved(rows: ObservedRows, frame: ResolvedAsOf, windowDays: number = OBSERVED_WINDOW_DAYS): ObservedAggregates {
  const asOf = frame.as_of
  const dated = <T,>(xs: readonly T[], at: (x: T) => string): { x: T; age: number | null; date: string | null }[] =>
    xs.map(x => { const date = localDateOf(at(x), frame); return { x, date, age: ageDays(date, asOf) } })

  // ── Run log ──
  const windowRuns = dated(rows.runs.filter(isRun), r => r.start_date).filter(r => inWindow(r.age, windowDays))
  // Validity BEFORE dedupe (code review 2026-11-21): dedupe keeps the longer copy, and if that
  // copy is junk the valid shorter one would already be gone.
  let excluded = 0
  const valid = windowRuns.filter(r => (validRunKm(r.x) === null ? (excluded++, false) : true))
  const deduped = new Set(dedupeRuns(valid.map(r => r.x)))
  let km = 0, longest: number | null = null, count = 0
  let latestHr: { bpm: number; date: string; at: string } | null = null
  for (const r of valid) {
    if (!deduped.has(r.x)) continue
    const k = validRunKm(r.x)!
    count++; km += k; longest = longest === null ? k : Math.max(longest, k)
    const hr = within(r.x.max_hr, VALIDITY.max_hr)
    if (hr !== null && r.date && (!latestHr || r.x.start_date > latestHr.at)) latestHr = { bpm: hr, date: r.date, at: r.x.start_date }
  }

  // ── Health ──
  const rhr = rows.health
    .filter(h => inWindow(ageDays(h.sample_date?.slice(0, 10) ?? null, asOf), RHR_WINDOW_DAYS))
    .map(h => within(h.rhr_bpm, VALIDITY.resting_hr))
    .filter((v): v is number => v !== null)

  // ── Completions ──
  const comps = dated(rows.completions, c => c.created_at).filter(c => inWindow(c.age, windowDays))
  const recent: number[] = [], prior: number[] = []
  const counts = Object.fromEntries(FATIGUE.map(t => [t, 0])) as Record<FatigueTag, number>
  let latestTag: { tag: FatigueTag; at: string } | null = null
  for (const c of comps) {
    const rpe = within(c.x.rpe, VALIDITY.rpe)
    if (rpe !== null) (c.age! < RPE_HALF_WINDOW_DAYS ? recent : prior).push(rpe)
    const tag = FATIGUE.find(t => t === c.x.fatigue_tag)
    if (tag) {
      counts[tag]++
      if (!latestTag || c.x.created_at > latestTag.at) latestTag = { tag, at: c.x.created_at }
    }
  }

  // ── Analyses ──
  const an = dated(rows.analyses, a => a.created_at).filter(a => inWindow(a.age, windowDays))
  const ef = an.filter(a => typeof a.x.ef_trend_pct === 'number' && Number.isFinite(a.x.ef_trend_pct))
    .sort((a, b) => b.x.created_at.localeCompare(a.x.created_at))

  const firstDate = rows.first_run_at ? localDateOf(rows.first_run_at, frame) : null
  return {
    as_of: asOf,
    window_days: windowDays,
    run_log: {
      run_count: count,
      km_total: Math.round(km * 100) / 100,
      longest_km: longest === null ? null : Math.round(longest * 100) / 100,
      latest_max_hr: latestHr ? { bpm: latestHr.bpm, date: latestHr.date } : null,
      first_run_date: firstDate,
      excluded_rows: excluded,
    },
    health: { rhr_7d_median: median(rhr), rhr_samples: rhr.length },
    completions: {
      rpe_recent_mean: mean(recent), rpe_prior_mean: mean(prior), rpe_n: recent.length + prior.length,
      fatigue_counts: counts, fatigue_latest: latestTag?.tag ?? null,
    },
    analyses: { ef_trend_pct_latest: ef.length ? ef[0].x.ef_trend_pct : null, n: an.length },
  }
}
