/**
 * Stream-level analysis of an activity's HR samples.
 *
 * Today this only consumes HealthKit-sourced workouts (raw_payload.hrSamples).
 * Strava activities don't currently persist per-sample HR — only bucketed
 * zone percentages — so streamSummary is null for Strava-sourced runs until
 * AI-DEPTH-02's Strava-side splits pipeline lands.
 *
 * Doctrine: pure, no I/O, no Supabase. Returns null whenever the signal is
 * too sparse to make a defensible coaching claim.
 */

/**
 * Stream-derived metrics for the back third of a run vs the first third.
 * Surfaced to the AI prompt so feedback can reference late-run cardiac fade
 * specifically ("HR drifted +14 bpm in the back third") rather than just the
 * aggregate `hr_in_zone_pct` figure that hides drift.
 */
export interface HrStreamSummary {
  /** Avg HR across samples in the first third of the workout. */
  firstThirdAvgHr: number
  /** Avg HR across samples in the last third of the workout. */
  lastThirdAvgHr: number
  /** lastThirdAvgHr - firstThirdAvgHr — positive = late-run fade. */
  hrDriftBpm: number
  /** Drift as a fraction of first-third HR. 0.10 = 10% climb. */
  hrDriftPct: number
  /** Total sample count after filtering invalid readings. */
  samplesCount: number
  /** Samples per minute of workout duration. Below ~0.3 = sparse-watch reading. */
  coveragePerMin: number
  /**
   * True when coveragePerMin < SPARSE_COVERAGE_THRESHOLD.
   * Surface to the model so it can hedge ("worth checking, sample is sparse").
   */
  sparse: boolean
}

/** Minimum samples per third — below this, thirds-analysis is too noisy. */
const MIN_SAMPLES_PER_THIRD = 3

/** Workouts shorter than this are dominated by warm-up and yield no drift signal. */
const MIN_DURATION_MIN = 10

/** Samples-per-minute below this is considered sparse. */
const SPARSE_COVERAGE_THRESHOLD = 0.3

export interface HrSample {
  valueBpm:  number
  timestamp: string
}

/**
 * Compute first-third vs last-third HR for an activity.
 *
 * Returns null when the data can't support a defensible claim:
 *  - no samples at all
 *  - duration shorter than MIN_DURATION_MIN
 *  - either third has fewer than MIN_SAMPLES_PER_THIRD samples
 *
 * Sparse but otherwise valid runs return a summary with `sparse: true` so
 * the prompt can hedge. Caller decides whether to surface — the doctrine
 * is "show the signal, let the prompt do the framing".
 */
export function computeHrStreamSummary(
  samples: HrSample[] | null | undefined,
  workoutDurationSeconds: number,
): HrStreamSummary | null {
  if (!samples || samples.length === 0) return null
  if (workoutDurationSeconds < MIN_DURATION_MIN * 60) return null

  // Filter invalid readings (0 / NaN) and parse timestamps once.
  const cleaned = samples
    .filter(s => Number.isFinite(s.valueBpm) && s.valueBpm > 0)
    .map(s => ({ valueBpm: s.valueBpm, t: new Date(s.timestamp).getTime() }))
    .filter(s => Number.isFinite(s.t))

  if (cleaned.length === 0) return null

  // Sort ascending by timestamp so partitioning is robust to source ordering.
  cleaned.sort((a, b) => a.t - b.t)

  const startMs = cleaned[0].t
  const endMs   = cleaned[cleaned.length - 1].t
  const spanMs  = endMs - startMs

  // If the sample window is degenerate (all samples at same instant), bail.
  if (spanMs < MIN_DURATION_MIN * 60 * 1000) return null

  const thirdMs       = spanMs / 3
  const firstThirdEnd = startMs + thirdMs
  const lastThirdStart = endMs - thirdMs

  const firstThird = cleaned.filter(s => s.t <= firstThirdEnd)
  const lastThird  = cleaned.filter(s => s.t >= lastThirdStart)

  if (firstThird.length < MIN_SAMPLES_PER_THIRD || lastThird.length < MIN_SAMPLES_PER_THIRD) {
    return null
  }

  const avg = (xs: { valueBpm: number }[]) =>
    xs.reduce((s, x) => s + x.valueBpm, 0) / xs.length

  const firstThirdAvgHr = Math.round(avg(firstThird))
  const lastThirdAvgHr  = Math.round(avg(lastThird))
  const hrDriftBpm      = lastThirdAvgHr - firstThirdAvgHr
  const hrDriftPct      = firstThirdAvgHr > 0
    ? hrDriftBpm / firstThirdAvgHr
    : 0

  const durationMin     = workoutDurationSeconds / 60
  const coveragePerMin  = cleaned.length / durationMin

  return {
    firstThirdAvgHr,
    lastThirdAvgHr,
    hrDriftBpm,
    hrDriftPct,
    samplesCount:   cleaned.length,
    coveragePerMin: Math.round(coveragePerMin * 10) / 10,
    sparse:         coveragePerMin < SPARSE_COVERAGE_THRESHOLD,
  }
}
