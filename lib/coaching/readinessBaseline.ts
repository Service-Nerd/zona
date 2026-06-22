import { READINESS } from './constants'

/**
 * Pre-session readiness signal — composite of RHR / HRV / sleep deviations from
 * a 14-day rolling personal baseline. Dormant until the baseline is established.
 *
 * Pure computation: takes the user's last N days of samples plus today's sample,
 * returns the three boolean signals + a `hasBaseline` flag. Caller does the IO.
 *
 * See CoachingPrinciples.md §59 for the principle behind the thresholds.
 */

export interface DailyHealthSample {
  /** YYYY-MM-DD — used to compare today vs. baseline window. */
  sampleDate:  string
  rhrBpm:      number | null
  hrvMs:       number | null
  sleepHours:  number | null
}

/** DS-05 — per-stage sleep minutes from HealthKit, for the night being assessed. */
export interface SleepStageMinutes {
  deep:   number
  rem:    number
  light:  number
  awake:  number
}

export interface ReadinessSignal {
  isElevatedRHR:  boolean
  isLowHRV:       boolean
  isShortSleep:   boolean
  /** DS-05 — adequate total sleep but a low deep-sleep share (quality, not duration). */
  isPoorSleepQuality: boolean
  /** False when the 14-day baseline isn't yet established — caller treats as silent. */
  hasBaseline:    boolean
  /** Diagnostic detail surfaced in adjustment trigger metadata. */
  detail: {
    rhrBaseline?:    number
    rhrToday?:       number
    hrvBaseline?:    number
    hrvSd?:          number
    hrvToday?:       number
    sleepHours?:     number
    deepSleepPct?:   number
    samplesUsed:     number
  }
}

/**
 * Compute the readiness signal from a samples window plus today's sample.
 *
 * Baseline = rolling mean over the last `BASELINE_WINDOW_DAYS` of non-null
 * samples (per metric). Activation requires ≥ BASELINE_WINDOW_DAYS samples
 * for both RHR and HRV — sleep doesn't need a baseline (absolute hours threshold).
 *
 * Today's sample is excluded from the baseline (we're comparing today *against*
 * the trailing window).
 */
export function computeReadiness(
  samplesWindow: DailyHealthSample[],
  today: {
    rhrBpm: number | null
    hrvMs: number | null
    sleepHours: number | null
    /** DS-05 — null when the source gave no stage breakdown for the night. */
    sleepStages?: SleepStageMinutes | null
  },
): ReadinessSignal {
  const rhrSamples = samplesWindow.map(s => s.rhrBpm).filter((n): n is number => n != null)
  const hrvSamples = samplesWindow.map(s => s.hrvMs).filter((n): n is number => n != null)
  const samplesUsed = Math.min(rhrSamples.length, hrvSamples.length)

  // Baseline established when both metrics have full windows of data.
  const hasBaseline = rhrSamples.length >= READINESS.BASELINE_WINDOW_DAYS
    && hrvSamples.length >= READINESS.BASELINE_WINDOW_DAYS

  if (!hasBaseline) {
    // Sleep can still fire without baseline (absolute threshold) but caller
    // gates on hasBaseline regardless — this matches the spec ("dormant until
    // baseline is established") and avoids day-1 false positives.
    return {
      isElevatedRHR:      false,
      isLowHRV:           false,
      isShortSleep:       false,
      isPoorSleepQuality: false,
      hasBaseline:        false,
      detail:             { samplesUsed },
    }
  }

  const rhrBaseline = mean(rhrSamples)
  const hrvBaseline = mean(hrvSamples)
  const hrvSd       = stddev(hrvSamples, hrvBaseline)

  const isElevatedRHR = today.rhrBpm != null
    && today.rhrBpm >= rhrBaseline + READINESS.RHR_ELEVATION_BPM

  const isLowHRV = today.hrvMs != null
    && today.hrvMs <= hrvBaseline - (READINESS.HRV_DECLINE_SD * hrvSd)

  const isShortSleep = today.sleepHours != null
    && today.sleepHours < READINESS.SLEEP_THRESHOLD_HOURS

  // DS-05 — sleep quality. Only the distinguishing signal when duration looked
  // fine (short duration already fires isShortSleep). Requires a real stage
  // breakdown; undifferentiated "asleep"-only nights have no staged total and
  // are not assessed (deepSleepPct stays undefined → never fires).
  const deepSleepPct = deepSleepProportion(today.sleepStages)
  const isPoorSleepQuality = deepSleepPct != null
    && today.sleepHours != null
    && today.sleepHours >= READINESS.SLEEP_THRESHOLD_HOURS
    && deepSleepPct < READINESS.DEEP_SLEEP_PCT_FLOOR

  return {
    isElevatedRHR,
    isLowHRV,
    isShortSleep,
    isPoorSleepQuality,
    hasBaseline:   true,
    detail: {
      rhrBaseline:  round(rhrBaseline, 1),
      rhrToday:     today.rhrBpm ?? undefined,
      hrvBaseline:  round(hrvBaseline, 1),
      hrvSd:        round(hrvSd, 2),
      hrvToday:     today.hrvMs ?? undefined,
      sleepHours:   today.sleepHours ?? undefined,
      deepSleepPct: deepSleepPct != null ? round(deepSleepPct, 3) : undefined,
      samplesUsed,
    },
  }
}

/**
 * Deep sleep as a fraction of staged sleep (deep + rem + light). Returns null
 * when no staged data exists — undifferentiated "asleep" minutes are not a
 * stage breakdown and must not read as 0% deep (that would be a false positive).
 */
function deepSleepProportion(stages: SleepStageMinutes | null | undefined): number | null {
  if (!stages) return null
  const staged = stages.deep + stages.rem + stages.light
  if (staged <= 0) return null
  return stages.deep / staged
}

function mean(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function round(value: number, places: number): number {
  const m = 10 ** places
  return Math.round(value * m) / m
}
