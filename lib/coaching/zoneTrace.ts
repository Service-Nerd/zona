// SESSION-SCREENS-WOW-01 — the Zone Trace: the runner's own heart rate against the ceiling they were set, and the one
// sentence that reads it (§12 Amendment 3, Coaching Board 2026-10-21; copy approved by the founder the same day).
//
// Pure: no I/O, no Supabase. The single owner of the sentence, so every surface that shows a trace says the same thing.
//
// Two rules that came out of the prototype and are easy to undo by accident:
//   • An easy, long or recovery run (a session whose prescribed zone tops out at Z2) is a CEILING (§12). Everything
//     under it is held; only a quality session has a floor. Drawing Z2 as a band made a 96%-held run look like a fail.
//   • When the run has an analysis, ITS above-ceiling share decides the sentence, so the verdict pill's colour and the
//     sentence can never disagree. The trace then supplies only the timing.
//
// No sentence names a cause (P-04: we cannot tell "ran too hard" from "ran up a hill in August").

import { hrBandForZoneString, zonesFromZoneString } from './zoneRules'
import { getSessionColor } from '@/lib/session-types'
import { formatDuration } from '@/lib/format'
import {
  ZONE_DRIFT_ABOVE_CEILING_PCT, ZONE_HELD_MAX_ABOVE_CEILING_PCT,
  TRACE_SMOOTHING_S, TRACE_SUSTAINED_ABOVE_S, TRACE_LATE_ONSET_FRACTION,
} from './constants'

/** Seconds from the first sample, beats per minute. */
export type TracePoint = [number, number]

/**
 * Below this many samples a line is noise drawn with confidence, and the card keeps the zone bar instead (Design Board
 * 2026-10-21). Measured: 39% of Apple Health runs clear it, 41% have 1–99 samples, 20% none.
 */
export const TRACE_MIN_SAMPLES = 100

/** HealthKit's `raw_payload.hrSamples` → sorted points, or null when there are too few to draw. */
export function traceFromSamples(samples: unknown): TracePoint[] | null {
  if (!Array.isArray(samples)) return null
  const pts: [number, number][] = []
  for (const s of samples) {
    const v = Number((s as { valueBpm?: unknown })?.valueBpm)
    const t = Date.parse(String((s as { timestamp?: unknown })?.timestamp))
    if (Number.isFinite(v) && v > 0 && Number.isFinite(t)) pts.push([t, v])
  }
  if (pts.length < TRACE_MIN_SAMPLES) return null
  pts.sort((a, b) => a[0] - b[0])
  const t0 = pts[0][0]
  return pts.map(([t, v]) => [(t - t0) / 1000, v])
}

/** A trailing rolling mean over `windowS` seconds. */
export function smoothTrace(points: TracePoint[], windowS: number = TRACE_SMOOTHING_S): TracePoint[] {
  const out: TracePoint[] = []
  let j = 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    sum += points[i][1]
    while (points[i][0] - points[j][0] > windowS) { sum -= points[j][1]; j++ }
    out.push([points[i][0], sum / (i - j + 1)])
  }
  return out
}

export interface TraceBand { lo: number; hi: number }

export interface TraceRead {
  totalS: number
  aboveS: number
  /** Share of the run above the ceiling, 0–100. */
  abovePct: number
  /** Share in the prescribed zone, 0–100: under the ceiling for a ceiling-only run, inside the band otherwise. */
  inZonePct: number
  /** Seconds from the start at which the first sustained excursion began, or null. */
  onsetS: number | null
  /** Share of the run before the onset that was above the ceiling, 0–100, or null with no onset. */
  aboveBeforeOnsetPct: number | null
}

/** Read a smoothed trace against the session's band. */
export function readTrace(points: TracePoint[], band: TraceBand, ceilingOnly: boolean): TraceRead {
  const totalS = points.length > 1 ? points[points.length - 1][0] - points[0][0] : 0
  let aboveS = 0, inS = 0, run = 0, onsetS: number | null = null, aboveAtOnset = 0
  for (let i = 1; i < points.length; i++) {
    const dt = points[i][0] - points[i - 1][0]
    const v = points[i][1]
    if (v > band.hi) {
      aboveS += dt
      run += dt
      if (run >= TRACE_SUSTAINED_ABOVE_S && onsetS == null) { onsetS = points[i][0] - run; aboveAtOnset = aboveS - run }
    } else {
      run = 0
      if (ceilingOnly || v >= band.lo) inS += dt
    }
  }
  const pct = (x: number) => (totalS > 0 ? (100 * x) / totalS : 0)
  return {
    totalS, aboveS, abovePct: pct(aboveS), inZonePct: pct(inS), onsetS,
    aboveBeforeOnsetPct: onsetS != null && onsetS > 0 ? (100 * aboveAtOnset) / onsetS : onsetS === 0 ? 0 : null,
  }
}

/**
 * The one sentence. `analysisAbovePct` is `run_analysis.hr_above_ceiling_pct` when the run has one; it decides.
 * Without it the trace's own share is used (the trace is FREE, and free runs have no analysis).
 */
export function traceSentence(read: TraceRead, ceilingOnly: boolean, analysisAbovePct?: number | null): string {
  const abovePct = analysisAbovePct != null && Number.isFinite(analysisAbovePct) ? analysisAbovePct : read.abovePct
  const totalMin = Math.max(1, Math.round(read.totalS / 60))
  // Minutes follow the share that decided the sentence, so the numbers never contradict the verdict.
  const aboveMin = Math.min(totalMin, Math.max(1, Math.round((abovePct / 100) * totalMin)))
  if (abovePct <= ZONE_HELD_MAX_ABOVE_CEILING_PCT) return 'You held the zone.'
  // ADR-015: every duration goes through `formatDuration` ("55 min", "1h 34"), so the sentence agrees with every other
  // number on the screen. The founder approved the words; the number format is the app's, not the sentence's.
  const d = (m: number) => formatDuration(m) as string // always a finite, positive count here, so never null
  if (abovePct <= ZONE_DRIFT_ABOVE_CEILING_PCT) return `Over your ceiling for ${d(aboveMin)} of ${d(totalMin)}.`
  const late = read.onsetS != null && read.totalS > 0
    && read.onsetS / read.totalS >= TRACE_LATE_ONSET_FRACTION
    && (read.aboveBeforeOnsetPct ?? 100) <= ZONE_HELD_MAX_ABOVE_CEILING_PCT
  if (late) return `You held it for ${d(Math.round(read.onsetS! / 60))}, then it got away from you.`
  return `Above your ceiling for ${d(aboveMin)} of ${d(totalMin)}.${ceilingOnly ? ' Easy days need to feel easy.' : ''}`
}

/**
 * The same sentence when there is an analysis but no drawable trace (a sparse trace, or a Strava-linked run): the card
 * still says one thing about the run, from the one owner (Design Board 2026-10-22: the card is the only zone signal).
 * No timing exists without a trace, so the late-drift line is never chosen here. Null without a usable duration.
 */
export function analysisSentence(abovePct: number | null | undefined, totalMinutes: number | null | undefined, ceilingOnly: boolean): string | null {
  if (abovePct == null || !Number.isFinite(abovePct)) return null
  // Praise needs no minutes; every other line quotes them, so without a duration the card keeps the % and the bar.
  if (abovePct <= ZONE_HELD_MAX_ABOVE_CEILING_PCT) return 'You held the zone.'
  if (!totalMinutes || totalMinutes <= 0) return null
  const totalS = totalMinutes * 60
  return traceSentence({ totalS, aboveS: (abovePct / 100) * totalS, abovePct, inZonePct: 100 - abovePct, onsetS: null, aboveBeforeOnsetPct: null }, ceilingOnly, abovePct)
}

/** A session whose prescribed zone tops out at Z2 is a ceiling, not a band (§12). Null without a zone. */
export function isCeilingOnly(session: { zone?: string }): boolean | null {
  const zones = zonesFromZoneString(session.zone)
  return zones.length ? Math.max(...zones) <= 2 : null
}

/** At most `max` points for drawing; the read always uses every point. */
export function thinTrace(points: TracePoint[], max = 300): TracePoint[] {
  if (points.length <= max) return points
  const step = points.length / max
  const out: TracePoint[] = []
  for (let i = 0; i < max; i++) out.push(points[Math.floor(i * step)])
  out.push(points[points.length - 1])
  return out
}

export interface RunTrace { points: TracePoint[]; band: TraceBand; ceilingOnly: boolean; colour: string; sentence: string; inZonePct: number }

/**
 * Everything a surface needs to draw one run's trace, or null when it cannot be drawn honestly: too few samples, no
 * prescribed zone on the session (the engine stamps one on every session, §84), or no max HR to place the band.
 * The band is the one the session screen's zone card shows, from the same helper.
 */
export function buildRunTrace(
  samples: unknown,
  session: { zone?: string; type?: string; role?: string; label?: string },
  restingHR: number | null | undefined,
  maxHR: number | null | undefined,
  analysisAbovePct: number | null | undefined,
): RunTrace | null {
  const raw = traceFromSamples(samples)
  const zones = zonesFromZoneString(session.zone)
  if (!raw || zones.length === 0) return null
  const band = hrBandForZoneString(session.zone, restingHR, maxHR)
  if (!band) return null
  const ceilingOnly = isCeilingOnly(session) === true
  const points = smoothTrace(raw)
  const read = readTrace(points, band, ceilingOnly)
  return {
    points, band, ceilingOnly,
    colour: getSessionColor(session as never),
    sentence: traceSentence(read, ceilingOnly, analysisAbovePct),
    inZonePct: read.inZonePct,
  }
}
