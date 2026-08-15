/**
 * Pace-fade analysis from per-km splits.
 *
 * Strava's `splits_metric` (persisted on strava_activities.splits_metric)
 * gives us first-half vs back-half average pace — the signal that's hidden
 * in the aggregate avg_pace number. A 5:20/km average that opens at 5:00
 * and closes at 5:40 is a fade story; the same average that opens at 5:20
 * and closes at 5:20 is not.
 *
 * Doctrine matches streamAnalysis.ts:
 *  - Pure, no I/O, no Supabase.
 *  - Return null whenever the signal is too sparse to make a claim.
 *  - Don't invent thresholds inline — surface the numbers and let the
 *    prompt + limiter decide how to frame them.
 */

import { formatPace, type DistanceUnits } from '@/lib/format'

/** Minimum splits before the comparison is defensible (3+3 either side). */
const MIN_SPLITS_FOR_FADE = 6

/** Final split shorter than this (meters) is treated as the run's tail end
 *  and excluded from the fade calc — its pace is an artefact of the runner
 *  stopping mid-km, not a coaching signal. */
const SHORT_TAIL_THRESHOLD_M = 600

/**
 * Strava split shape (subset we actually use). Strava returns more fields;
 * this captures the surface area paceAnalysis depends on.
 */
export interface StravaSplitMetric {
  distance:           number  // meters
  moving_time:        number  // seconds
  average_speed:      number  // m/s
  average_heartrate?: number | null
  split?:             number  // 1-indexed
}

export interface PaceFadeSummary {
  /** Avg pace across first-half splits, seconds per km. */
  firstHalfAvgPaceSecPerKm: number
  /** Avg pace across back-half splits, seconds per km. */
  backHalfAvgPaceSecPerKm:  number
  /** Back-half pace minus first-half pace. Positive = fade (got slower). */
  paceFadeSecPerKm:         number
  /** Fade as fraction of first-half pace. 0.05 = 5% slowdown. */
  paceFadePct:              number
  /** Count of splits actually used (after short-tail filtering). */
  splitsUsed:               number
  /** True when only the minimum splits were available — caller should hedge. */
  sparse:                   boolean
}

/**
 * Compute first-half vs back-half average pace.
 *
 * Returns null when:
 *  - no splits at all
 *  - fewer than MIN_SPLITS_FOR_FADE usable splits after short-tail filtering
 *  - any split has degenerate data (zero distance, zero moving_time)
 */
export function computePaceFadeSummary(
  splits: StravaSplitMetric[] | null | undefined,
): PaceFadeSummary | null {
  if (!splits || splits.length === 0) return null

  // Drop final short-tail splits — they distort pace because the runner is
  // mid-km when the watch stops. Strava marks these by distance < 1000m
  // (typically <600m). We keep all full-km splits regardless of position.
  const usable = splits.filter(s =>
    Number.isFinite(s.distance) && s.distance >= SHORT_TAIL_THRESHOLD_M
    && Number.isFinite(s.moving_time) && s.moving_time > 0
    && Number.isFinite(s.average_speed) && s.average_speed > 0
  )

  if (usable.length < MIN_SPLITS_FOR_FADE) return null

  // Split into halves by count, not by distance — a runner who walks the back
  // half covers less distance per split, but the time spent in that effort is
  // what we want to characterise.
  const mid           = Math.floor(usable.length / 2)
  const firstHalf     = usable.slice(0, mid)
  const backHalf      = usable.slice(usable.length - mid)  // matches firstHalf count

  // Pace = moving_time / (distance/1000) seconds per km. Time-weighted by
  // distance, not a flat average of per-split paces — handles uneven splits
  // (e.g. a stop-and-go split's contribution is proportional to its length).
  const avgPace = (xs: StravaSplitMetric[]): number => {
    const totalTime = xs.reduce((s, x) => s + x.moving_time, 0)
    const totalKm   = xs.reduce((s, x) => s + x.distance, 0) / 1000
    return totalTime / totalKm
  }

  const firstHalfAvgPaceSecPerKm = Math.round(avgPace(firstHalf))
  const backHalfAvgPaceSecPerKm  = Math.round(avgPace(backHalf))
  const paceFadeSecPerKm         = backHalfAvgPaceSecPerKm - firstHalfAvgPaceSecPerKm
  const paceFadePct              = firstHalfAvgPaceSecPerKm > 0
    ? paceFadeSecPerKm / firstHalfAvgPaceSecPerKm
    : 0

  return {
    firstHalfAvgPaceSecPerKm,
    backHalfAvgPaceSecPerKm,
    paceFadeSecPerKm,
    paceFadePct,
    splitsUsed: usable.length,
    sparse:     usable.length < MIN_SPLITS_FOR_FADE + 2,
  }
}

/** Format seconds-per-km for display. Delegates to the single owner in
 *  lib/format.ts (INV-FMT-001) — this used to be one of four copies of the rule,
 *  all km-only. Kept as a named re-export so existing call sites keep working;
 *  pass `units` to render miles. */
export function formatPaceSec(secPerKm: number, units: DistanceUnits = 'km'): string {
  return formatPace(secPerKm, units) ?? '—'
}
