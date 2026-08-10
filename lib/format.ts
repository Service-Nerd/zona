// Distance formatting — single source of truth.
//
// Plan distances are stored in km. This helper converts to the user's preferred
// unit and rounds to a whole number ("6 km", "4 mi"). Race distances pass
// `exact: true` to preserve their iconic decimals (21.1 km, 13.1 mi, etc.).
//
// Rounding the displayed value means "sum of displayed sessions" and
// "displayed week total" must both be computed from rounded values, so they
// agree. See sumRoundedDistance below.

import type { Session } from '@/types/plan'

const KM_PER_MI = 1.609344

export type DistanceUnits = 'km' | 'mi'

export interface FormatDistanceOpts {
  /** Race-style: keep 1 dp instead of rounding to whole. */
  exact?: boolean
  /** Omit the unit suffix, return just the number string. */
  noSuffix?: boolean
}

export function formatDistance(
  km: number | null | undefined,
  units: DistanceUnits = 'km',
  opts: FormatDistanceOpts = {},
): string | null {
  if (km == null || !Number.isFinite(km)) return null
  const value = units === 'mi' ? km / KM_PER_MI : km
  const rounded = opts.exact
    ? Math.round(value * 10) / 10
    : Math.round(value)
  if (opts.noSuffix) return String(rounded)
  return `${rounded}${units}`
}

/** Sum a list of session km distances, rounding each one before adding so the
 *  resulting total matches what the user sees in the per-session displays. */
export function sumRoundedDistance(
  distancesKm: Array<number | null | undefined>,
  units: DistanceUnits = 'km',
): number {
  return distancesKm.reduce<number>((sum, km) => {
    if (km == null || !Number.isFinite(km)) return sum
    const value = units === 'mi' ? km / KM_PER_MI : km
    return sum + Math.round(value)
  }, 0)
}

export type SessionMetric = 'distance' | 'duration'

/** Map of per-session metric overrides, keyed as `${weekN}_${sessionKey}`
 *  to match the localStorage key shape `rts_metric_${weekN}_${session.key}`. */
export type SessionMetricOverrides = Record<string, SessionMetric>

/** Resolve which metric a session should display, in priority order:
 *    1. Per-session override (user toggled it in the session detail screen)
 *    2. Plan-baked `primary_metric` (engine chose, e.g. duration for long runs)
 *    3. Global preference from MeScreen
 *    4. 'distance' fallback
 */
export function resolveSessionMetric(
  weekN: number,
  sessionKey: string,
  sessionPrimaryMetric: SessionMetric | undefined,
  overrides: SessionMetricOverrides,
  global: SessionMetric | undefined,
): SessionMetric {
  return overrides[`${weekN}_${sessionKey}`]
    ?? sessionPrimaryMetric
    ?? global
    ?? 'distance'
}

// ─── Duration formatting — single source of truth (ADR-015, INV-FMT-002) ──────
//
// Durations are stored in minutes everywhere (plan `duration_mins`, completions,
// analysis). This is the ONLY place a minute count becomes a display string.
//
// The rule (locked): under 60 min reads in minutes ("45 min"); at or above 60 it
// reads in hours. Whole hours drop the minutes ("2h"); otherwise the remainder is
// zero-padded and carries no unit — the `h` anchors it as a duration ("1h 18").
//
// Deliberately NO bare "m"/"min" glyph after the hour, and never a lone "78m":
// that ambiguity (minutes vs miles vs metres) is the defect this function retires.
// Every duration the user sees — card, plan, session detail, push, diff — routes
// here. Do not re-implement this rule anywhere (INV-FMT-001).
export function formatDuration(mins: number | null | undefined): string | null {
  if (mins == null || !Number.isFinite(mins) || mins < 0) return null
  const total = Math.round(mins)
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, '0')}`
}

// ─── One metric summary for a session (ADR-015) ───────────────────────────────
//
// The single entry point for "what's the one-line distance-or-duration for this
// session?" — used by collapsed cards, the plan, session detail, and the daily
// push, so those surfaces are mechanically incapable of disagreeing.
//
// `metric` is the ALREADY-RESOLVED choice (via resolveSessionMetric): caller has
// applied per-session override → plan primary_metric → global preference. This
// function only formats it, falling back to the other metric when the preferred
// one has no value (never render nothing when data exists). Returns null only
// when the session carries neither distance nor duration.
export function formatSessionMetric(
  session: Pick<Session, 'distance_km' | 'duration_mins'>,
  metric: SessionMetric,
  units: DistanceUnits = 'km',
): string | null {
  const dist = () => formatDistance(session.distance_km, units)
  const dur = () => formatDuration(session.duration_mins)
  const primary = metric === 'duration' ? dur() : dist()
  if (primary != null) return primary
  return metric === 'duration' ? dist() : dur()
}
