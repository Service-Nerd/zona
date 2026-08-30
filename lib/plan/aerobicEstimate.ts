// Aerobic fitness estimate from recent runs — the shared, pure core behind both
// the PAID /api/race-times ladder (States 2/3) and the FREE CI-4 wizard
// benchmark auto-estimate (/api/wizard-benchmark-estimate).
//
// Given a set of recent runs + the runner's resting/max HR, it: qualifies the
// Zone-2 aerobic runs, takes a distance-weighted mean speed, derives VDOT, and
// projects a race time for the target distance. No auth, no DB, no plan — pure
// functions so both routes share one implementation and it's node-testable.
//
// The physiology formula (VO2 from velocity) is a Daniels constant, exempt from
// GENERATION_CONFIG like the other VDOT coefficients (CLAUDE.md § Configuration
// Singularity → Exempt).

import { velocityAtFraction } from './ruleEngine'

// Jack Daniels race VDOT utilisation fractions (mirrors /api/race-times).
const RACE_FRACTIONS: { label: string; distanceKm: number; fraction: number }[] = [
  { label: '5K',       distanceKm: 5,       fraction: 0.961 },
  { label: '10K',      distanceKm: 10,      fraction: 0.922 },
  { label: 'HM',       distanceKm: 21.0975, fraction: 0.842 },
  { label: 'Marathon', distanceKm: 42.195,  fraction: 0.792 },
]

// Plausible VDOT range for a real amateur — outside this, the sample is noise.
const VDOT_MIN = 20
const VDOT_MAX = 85
// A run must be at least this long to be a meaningful aerobic sample.
const MIN_AEROBIC_DISTANCE_M = 3000
// Zone-2 HR-reserve band (Karvonen 60–70%) — matches /api/race-times inline use.
const Z2_FLOOR_FRAC = 0.60
const Z2_CEILING_FRAC = 0.70
// ≥ this many qualifying runs → moderate confidence, else low.
const HIGH_CONFIDENCE_MIN_RUNS = 4

export interface AerobicRun {
  avg_speed: number   // m/s
  avg_hr: number      // bpm
  distance_m: number
}

/** Derive VDOT from an average aerobic (Z2 ≈ 65% VO2max) speed in m/s. */
export function vdotFromAerobicSpeedMs(avgSpeedMs: number): number {
  const v = avgSpeedMs * 60 // m/s → m/min
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
  return vo2 / 0.65
}

/** Karvonen Zone-2 HR band from resting + max HR. */
export function z2Band(restingHr: number, maxHr: number): { floor: number; ceiling: number } {
  const reserve = maxHr - restingHr
  return {
    floor: restingHr + Z2_FLOOR_FRAC * reserve,
    ceiling: restingHr + Z2_CEILING_FRAC * reserve,
  }
}

/** Keep runs that sit in the Z2 band and are long enough to matter. */
export function qualifyAerobicRuns(runs: readonly AerobicRun[], band: { floor: number; ceiling: number }): AerobicRun[] {
  return runs.filter(r =>
    Number.isFinite(r.avg_hr) && Number.isFinite(r.avg_speed) &&
    r.avg_hr >= band.floor && r.avg_hr <= band.ceiling &&
    r.distance_m >= MIN_AEROBIC_DISTANCE_M,
  )
}

/** Distance-weighted mean speed (longer runs weigh more — more robust). */
export function weightedMeanSpeed(runs: readonly AerobicRun[]): number {
  const totalDist = runs.reduce((s, r) => s + r.distance_m, 0)
  if (totalDist <= 0) return 0
  return runs.reduce((s, r) => s + r.avg_speed * r.distance_m, 0) / totalDist
}

/** The Daniels fraction for the standard race closest to `distanceKm`. */
function closestFraction(distanceKm: number): number {
  return RACE_FRACTIONS.reduce((best, r) =>
    Math.abs(r.distanceKm - distanceKm) < Math.abs(best.distanceKm - distanceKm) ? r : best,
  ).fraction
}

/** Project a race time (seconds) for `distanceKm` from a VDOT. */
export function estimateRaceSeconds(vdot: number, distanceKm: number): number {
  const velocityMperMin = velocityAtFraction(vdot, closestFraction(distanceKm))
  const timeMinutes = (distanceKm * 1000) / velocityMperMin
  return Math.round(timeMinutes * 60)
}

/** Format seconds as H:MM:SS (or M:SS under an hour) — benchmark `time` shape. */
export function formatRaceTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.round(totalSeconds % 60)
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`
}

export type BenchmarkEstimate =
  | { available: false; reason: 'no_hr' | 'no_runs' | 'implausible' }
  | {
      available: true
      distanceKm: number
      timeSeconds: number
      formattedTime: string
      vdot: number
      runCount: number
      confidence: 'moderate' | 'low'
      /** Runner-facing provenance line — FREE, rule-derived, NO AIMark. */
      label: string
    }

/**
 * The whole free estimate in one pure call. Returns an unavailable result
 * (never throws) when HR is missing, no runs qualify, or VDOT is implausible —
 * the wizard falls back to the manual benchmark ask (never a dead end).
 */
export function estimateBenchmarkFromRuns(args: {
  runs: readonly AerobicRun[]
  restingHr: number | null
  maxHr: number | null
  raceDistanceKm: number
}): BenchmarkEstimate {
  const { runs, restingHr, maxHr, raceDistanceKm } = args
  if (restingHr == null || maxHr == null || maxHr <= restingHr) {
    return { available: false, reason: 'no_hr' }
  }
  const qualifying = qualifyAerobicRuns(runs, z2Band(restingHr, maxHr))
  if (qualifying.length < 1) return { available: false, reason: 'no_runs' }

  const vdot = vdotFromAerobicSpeedMs(weightedMeanSpeed(qualifying))
  if (!Number.isFinite(vdot) || vdot < VDOT_MIN || vdot > VDOT_MAX) {
    return { available: false, reason: 'implausible' }
  }

  const timeSeconds = estimateRaceSeconds(vdot, raceDistanceKm)
  const runCount = qualifying.length
  const confident = runCount >= HIGH_CONFIDENCE_MIN_RUNS
  return {
    available: true,
    distanceKm: raceDistanceKm,
    timeSeconds,
    formattedTime: formatRaceTime(timeSeconds),
    vdot: parseFloat(vdot.toFixed(1)),
    runCount,
    confidence: confident ? 'moderate' : 'low',
    label: confident
      ? 'Estimated from your recent runs'
      : `From ${runCount} recent run${runCount > 1 ? 's' : ''} — rough, but a start`,
  }
}
