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

export interface ReadinessSignal {
  isElevatedRHR:  boolean
  isLowHRV:       boolean
  isShortSleep:   boolean
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
  today: { rhrBpm: number | null; hrvMs: number | null; sleepHours: number | null },
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
      isElevatedRHR: false,
      isLowHRV:      false,
      isShortSleep:  false,
      hasBaseline:   false,
      detail:        { samplesUsed },
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

  return {
    isElevatedRHR,
    isLowHRV,
    isShortSleep,
    hasBaseline:   true,
    detail: {
      rhrBaseline:  round(rhrBaseline, 1),
      rhrToday:     today.rhrBpm ?? undefined,
      hrvBaseline:  round(hrvBaseline, 1),
      hrvSd:        round(hrvSd, 2),
      hrvToday:     today.hrvMs ?? undefined,
      sleepHours:   today.sleepHours ?? undefined,
      samplesUsed,
    },
  }
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
