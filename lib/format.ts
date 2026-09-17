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

/** Apportion whole-unit display distances across a session's parts so the parts
 *  a runner reads sum EXACTLY to the displayed session total.
 *
 *  `sumRoundedDistance` gives session→week reconciliation ("what you add up is
 *  what you see") by rounding each session then summing. The within-session
 *  breakdown needs the opposite direction: the total is fixed (it is the number
 *  on the card) and the PARTS must be chosen to hit it. Rounding each part
 *  independently loses a unit (a 21.5 km MP long run showed 2 + 9 + 2 against a
 *  22 km header — the race-pace segment carried the missing ~9 and rendered as a
 *  bare "40%"). Largest-remainder apportionment fixes it: floor every part, then
 *  hand the leftover units to the largest fractional remainders (or reclaim from
 *  the smallest when the target sits below the sum of floors).
 *
 *  Inputs are km; the conversion to `units` happens here so callers pass raw km.
 *  Returns one whole-unit integer per input part, in order, guaranteed to sum to
 *  `Math.round(total-in-units)`. A null/non-finite part contributes 0. */
export function apportionRoundedDistance(
  partsKm: Array<number | null | undefined>,
  totalKm: number,
  units: DistanceUnits = 'km',
): number[] {
  const toUnit = (km: number) => (units === 'mi' ? km / KM_PER_MI : km)
  const values = partsKm.map(km =>
    km != null && Number.isFinite(km) ? toUnit(km) : 0)
  const target = Math.round(toUnit(totalKm))

  const out = values.map(v => Math.floor(v))
  let remainder = target - out.reduce((a, b) => a + b, 0)

  // Order parts by fractional remainder, largest first.
  const byFrac = values
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)

  for (let k = 0; k < byFrac.length && remainder > 0; k++) {
    out[byFrac[k].i] += 1
    remainder -= 1
  }
  // Target below the sum of floors (rare — heavy rounding down): reclaim from the
  // smallest fractional remainders, never taking a part below zero.
  for (let k = byFrac.length - 1; k >= 0 && remainder < 0; k--) {
    if (out[byFrac[k].i] > 0) {
      out[byFrac[k].i] -= 1
      remainder += 1
    }
  }
  return out
}

// ─── Pace formatting — single source of truth (ADR-015, INV-FMT-001) ─────────
//
// Pace is stored as seconds per KILOMETRE everywhere (analysis, cohort, splits),
// regardless of what the runner prefers to read. This is the only place that
// becomes a display string, and the only place the mi conversion happens.
//
// Deliberately separate from formatDistance: pace is a rate, and "8:51/mi" is a
// different number from "5:30/km", not a relabelling. Before FMT-01 this rule was
// implemented four times (paceAnalysis.ts + private copies in sessionFeedback.ts
// and sessionReframe.ts + strava.ts), all of them km-only, so a miles runner was
// told their pace in km by every AI surface.
export function formatPace(
  secPerKm: number | null | undefined,
  units: DistanceUnits = 'km',
  opts: { noSuffix?: boolean } = {},
): string | null {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return null
  const secPerUnit = units === 'mi' ? secPerKm * KM_PER_MI : secPerKm
  const m = Math.floor(secPerUnit / 60)
  const s = Math.round(secPerUnit % 60)
  // Carry a 60s rounding artefact into the minute rather than printing "5:60".
  const mm = s === 60 ? m + 1 : m
  const ss = s === 60 ? 0 : s
  const body = `${mm}:${String(ss).padStart(2, '0')}`
  return opts.noSuffix ? body : `${body}/${units}`
}

/** A pace DELTA (e.g. "fade of 15s/km") converted to the reader's unit.
 *  Same rate conversion, expressed in whole seconds. */
export function formatPaceDelta(
  secPerKm: number | null | undefined,
  units: DistanceUnits = 'km',
): string | null {
  if (secPerKm == null || !Number.isFinite(secPerKm)) return null
  const v = units === 'mi' ? secPerKm * KM_PER_MI : secPerKm
  return `${Math.round(v)}s/${units}`
}

// ─── Distance for AI prompts (FMT-01) ────────────────────────────────────────
//
// formatDistance() rounds to whole units on purpose — the UI reads calmer, and
// four surfaces agreeing matters more than a tenth of a km (ADR-015).
//
// Prompts need the opposite. If the model is told a session was "6km" when it was
// 5.7km and the runner logged 5.8km, it narrates a shortfall the engine does not
// recognise (§66 fires from planAdjustment.ts arithmetic, not from prose) — the
// model would contradict the plan. So prompts convert units but keep precision.
//
// `dp` mirrors whatever precision the call site already used, so km output stays
// byte-identical to pre-FMT-01 and only mi users see a change. Do not use this
// for anything the user reads directly — that is formatDistance's job.
// `dp` mirrors whatever precision the call site already used. Pass `null` (the
// default) for "natural precision" — the sites that previously interpolated the
// raw number. On the km path natural precision is EXACT IDENTITY: the value is
// stringified untouched, so those prompts are byte-for-byte what they were before
// FMT-01. That property is verified, not assumed — a first cut forced 1dp here and
// silently turned "8.02km" into "8.0km" and "(100km)" into "(100.0km)".
//
// Do not use this for anything the user reads directly — that is formatDistance's job.
export function formatDistanceForPrompt(
  km: number | null | undefined,
  units: DistanceUnits = 'km',
  dp: number | null = null,
): string | null {
  if (km == null || !Number.isFinite(km)) return null
  if (units === 'km') {
    // Identity on the km path — never reformat a number we aren't converting.
    return `${dp == null ? km : km.toFixed(dp)}km`
  }
  const value = km / KM_PER_MI
  // Converted values need rounding; strip trailing zeros so a whole number reads
  // as "62mi", not "62.00mi".
  const body = dp == null ? String(Number(value.toFixed(2))) : value.toFixed(dp)
  return `${body}mi`
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

// ─── Clock times and elapsed deltas (ADR-015) ────────────────────────────────
//
// A race time is a display string, so it belongs here and not in whichever
// component happened to need it first. Before UX-COACH-01 this exact function
// existed TWICE, byte-identical, in `app/api/race-times/route.ts` and
// `components/shared/RaceTimesCard.tsx` — the route formatted the projections
// and the card re-formatted the arc, and nothing would have caught them
// drifting apart. Same pattern as the `formatPace` duplicate retired earlier.

/**
 * Seconds → clock string. Drops the hour segment below an hour, so a 5K reads
 * `23:42` and a marathon reads `3:53:36`. Never a bare `14162s`.
 */
export function formatClockTime(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return null
  const whole = Math.round(totalSeconds)
  const h = Math.floor(whole / 3600)
  const m = Math.floor((whole % 3600) / 60)
  const s = whole % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * A gap between two clock times, as a human phrase: `5m 24s`, `5m`, `24s`.
 *
 * UNSIGNED by design — the caller owns the direction and says it in words or
 * an arrow. Returning "-5m 24s" invites a call site to render a minus sign
 * next to an arrow that already means the same thing, and `Math.abs()` inside
 * a caller is how direction gets lost entirely.
 */
/**
 * A clock time at MINUTE precision, for an estimate that cannot support seconds.
 *
 * RACE-PROJ-PRECISION-01 (SLT 2026-09-17). The race-projections card rendered
 * `3:54:16` — sixteen seconds of precision — for a runner with no benchmark and
 * no run history, whose estimate came from a 3x4 lookup table indexed on two
 * wizard answers. Measured on the live database: **11 of 19 plans (58%) have no
 * benchmark**, so that was the majority path, and `confidence` drove only the
 * colour of a chip, never the precision of the number beside it.
 *
 * Sutherland's point, and the reason this function exists rather than a label
 * change: **precision is a louder signal than any caveat.** A runner reads
 * sixteen seconds as a measurement whatever the grey pill next to it says.
 *
 * Rounds to the nearest minute and drops the seconds field entirely, so the
 * shape itself says "estimate": `3:54` / `49` rather than `3:54:16` / `49:09`.
 * Under an hour it returns bare minutes, because `49:00` re-implies the
 * precision this removes.
 */
export function formatClockTimeCoarse(totalSeconds: number | null | undefined): string | null {
  if (totalSeconds == null || !Number.isFinite(totalSeconds) || totalSeconds < 0) return null
  const mins = Math.round(totalSeconds / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`
  return `${m} min`
}

export function formatElapsedDelta(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null
  const abs = Math.round(Math.abs(seconds))
  const m = Math.floor(abs / 60)
  const s = abs % 60
  if (m > 0 && s > 0) return `${m}m ${s}s`
  if (m > 0)          return `${m}m`
  return `${s}s`
}
