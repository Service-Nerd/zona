// Source-agnostic run history reader — the abstraction layer R25 reads through.
//
// Why this exists: R25 (and any future feature) must not query strava_activities
// directly with Strava-shaped column names. The mapper inside fetchRunHistory()
// is the only place that knows about source-specific columns. When the v1
// HealthKit migration adds `source` and `apple_health_uuid` columns, this file
// is the only thing that updates — R25 code is untouched.
//
// CoachingPrinciples §58 — past-self comparison via cohort similarity.

import type { SupabaseClient } from '@supabase/supabase-js'
import { COHORT_SIMILARITY, TREND_SERIES } from './constants'

export type ActivitySource = 'apple_health' | 'strava'

export interface RunRecord {
  source: ActivitySource
  startDate: Date
  distanceKm: number
  movingTimeSec: number
  avgHr: number | null
  avgSpeedMs: number | null
  hrInZonePct: number | null
  hrAboveCeilingPct: number | null
  hrBelowFloorPct: number | null
}

export interface CohortSummary {
  cohortSize: number
  avgHr: number | null
  avgPaceSecPerKm: number | null
  avgInZonePct: number | null
  medianDistanceKm: number
}

/**
 * Reads the user's run history. Source-agnostic interface; current
 * implementation reads strava_activities and stamps `source: 'strava'`
 * synthetically until the HealthKit migration adds the column.
 */
export async function fetchRunHistory(
  supabase: SupabaseClient,
  userId: string,
  windowDays: number,
): Promise<RunRecord[]> {
  const since = new Date()
  since.setDate(since.getDate() - windowDays)

  const { data, error } = await supabase
    .from('strava_activities')
    .select('start_date, distance_m, moving_time_s, avg_hr, avg_speed, hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, activity_type, sport_type')
    .eq('user_id', userId)
    .gte('start_date', since.toISOString())
    .order('start_date', { ascending: false })

  if (error || !data) return []

  return (data as RawActivityRow[])
    .filter(a => a.activity_type === 'Run' || a.sport_type === 'Run')
    .map(mapStravaRowToRunRecord)
}

interface RawActivityRow {
  start_date: string
  distance_m: number | null
  moving_time_s: number | null
  avg_hr: number | null
  avg_speed: number | null
  hr_in_zone_pct: number | null
  hr_above_ceiling_pct: number | null
  hr_below_floor_pct: number | null
  activity_type: string | null
  sport_type: string | null
}

function mapStravaRowToRunRecord(row: RawActivityRow): RunRecord {
  return {
    source: 'strava',
    startDate: new Date(row.start_date),
    distanceKm: (row.distance_m ?? 0) / 1000,
    movingTimeSec: row.moving_time_s ?? 0,
    avgHr: row.avg_hr,
    avgSpeedMs: row.avg_speed,
    hrInZonePct: row.hr_in_zone_pct,
    hrAboveCeilingPct: row.hr_above_ceiling_pct,
    hrBelowFloorPct: row.hr_below_floor_pct,
  }
}

export type HrBand = 'low' | 'mid' | 'high'

export function classifyHrBand(avgHr: number | null): HrBand | null {
  if (avgHr === null) return null
  if (avgHr < COHORT_SIMILARITY.HR_BAND_BREAKPOINTS.low) return 'low'
  if (avgHr < COHORT_SIMILARITY.HR_BAND_BREAKPOINTS.mid) return 'mid'
  return 'high'
}

/**
 * Two-axis similarity (cut #1): distance band + HR band.
 * Excludes the run being analysed (matched by start-date timestamp).
 */
export function findSimilarRuns(
  cohort: RunRecord[],
  target: { distanceKm: number; avgHr: number | null },
  excludeStartDate: Date,
): RunRecord[] {
  const tol = COHORT_SIMILARITY.DISTANCE_TOLERANCE_PCT / 100
  const lo  = target.distanceKm * (1 - tol)
  const hi  = target.distanceKm * (1 + tol)
  const targetBand = classifyHrBand(target.avgHr)
  const excludeMs  = excludeStartDate.getTime()

  return cohort.filter(r => {
    if (r.startDate.getTime() === excludeMs) return false
    if (r.distanceKm < lo || r.distanceKm > hi) return false
    if (targetBand && classifyHrBand(r.avgHr) !== targetBand) return false
    return true
  })
}

export function summariseCohort(cohort: RunRecord[]): CohortSummary | null {
  if (!cohort.length) return null

  const hrs     = cohort.map(r => r.avgHr).filter((v): v is number => v !== null)
  const paces   = cohort
    .filter(r => r.movingTimeSec > 0 && r.distanceKm > 0)
    .map(r => r.movingTimeSec / r.distanceKm)
  const inZones = cohort.map(r => r.hrInZonePct).filter((v): v is number => v !== null)
  const dists   = cohort.map(r => r.distanceKm).slice().sort((a, b) => a - b)

  return {
    cohortSize:       cohort.length,
    avgHr:            hrs.length     ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length)         : null,
    avgPaceSecPerKm:  paces.length   ? Math.round(paces.reduce((s, v) => s + v, 0) / paces.length)     : null,
    avgInZonePct:     inZones.length ? Math.round(inZones.reduce((s, v) => s + v, 0) / inZones.length) : null,
    medianDistanceKm: dists[Math.floor(dists.length / 2)],
  }
}

/** Dense-user window selection — see CoachingPrinciples §58. */
export function pickWindowDays(runsInLastSixMonths: number): number {
  return runsInLastSixMonths >= COHORT_SIMILARITY.DENSE_THRESHOLD
    ? COHORT_SIMILARITY.WINDOW_DAYS_DENSE
    : COHORT_SIMILARITY.WINDOW_DAYS_DEFAULT
}

// ──────────────────────────────────────────────────────────────────────────
// Multi-month trend (AI-DEPTH-03)
// ──────────────────────────────────────────────────────────────────────────
//
// Same-effort runs bucketed by month, producing an HR-over-time series at a
// fixed distance band. Surfaces the "engine getting stronger" evidence that
// the reframe (and the Coach screen, when wired) leans on for Tier A claims.
//
// Methodology: filter history to runs matching the anchor distance ±tolerance,
// bucket by year-month, compute per-bucket avg HR + avg pace. Only return a
// series when MIN_BUCKETS, MIN_RUNS_PER_BUCKET, and MIN_TOTAL_RUNS all clear.

export interface TrendBucket {
  /** First day of the bucket month (UTC). */
  monthStart: Date
  /** 'YYYY-MM' bucket key — stable for serialisation. */
  monthKey: string
  /** Short label for prompts — e.g. 'Mar', 'May'. */
  shortLabel: string
  cohortSize: number
  avgHr: number | null
  avgPaceSecPerKm: number | null
}

export interface TrendSeries {
  sessionType: string
  /** Anchor distance the cohort was matched to. */
  distanceKm: number
  windowMonths: number
  buckets: TrendBucket[]  // chronological, oldest first
  /** Convenience: HR delta from first bucket to last (signed; negative = drop). */
  hrDeltaBpm: number | null
  /** Pace delta from first to last bucket (signed; negative = faster). */
  paceDeltaSec: number | null
  /** True when HR delta passes the MIN_HR_DELTA_BPM threshold — the prompt
   *  should only cite the HR direction when this is true. */
  hrIsTrending: boolean
  /** Same for pace. */
  paceIsTrending: boolean
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Build a trend series from a runner's history, anchored to a specific
 * session type + distance. Returns null when there isn't enough data to
 * make a non-noisy claim (threshold-gated).
 *
 * `history` is expected to be pre-filtered to the relevant window. The
 * function does its own month-bucket aggregation.
 */
export function buildHrTrendSeries(
  history: RunRecord[],
  anchor: { sessionType: string; distanceKm: number },
  windowMonths: number = TREND_SERIES.DEFAULT_WINDOW_MONTHS,
): TrendSeries | null {
  if (!history.length || anchor.distanceKm <= 0) return null

  const tol = COHORT_SIMILARITY.DISTANCE_TOLERANCE_PCT / 100
  const lo = anchor.distanceKm * (1 - tol)
  const hi = anchor.distanceKm * (1 + tol)

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - windowMonths)

  const matching = history.filter(r =>
    r.distanceKm >= lo &&
    r.distanceKm <= hi &&
    r.startDate >= cutoff,
  )
  if (matching.length < TREND_SERIES.MIN_TOTAL_RUNS) return null

  // Bucket by year-month
  const bucketMap = new Map<string, RunRecord[]>()
  for (const r of matching) {
    const y = r.startDate.getUTCFullYear()
    const m = r.startDate.getUTCMonth()
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    if (!bucketMap.has(key)) bucketMap.set(key, [])
    bucketMap.get(key)!.push(r)
  }

  const sortedKeys = Array.from(bucketMap.keys()).sort()
  const buckets: TrendBucket[] = []
  for (const key of sortedKeys) {
    const runs = bucketMap.get(key)!
    if (runs.length < TREND_SERIES.MIN_RUNS_PER_BUCKET) continue
    const hrs = runs.map(r => r.avgHr).filter((v): v is number => v !== null)
    const paces = runs
      .filter(r => r.movingTimeSec > 0 && r.distanceKm > 0)
      .map(r => r.movingTimeSec / r.distanceKm)
    const [yStr, mStr] = key.split('-')
    const monthIdx = Number(mStr) - 1
    buckets.push({
      monthStart: new Date(Date.UTC(Number(yStr), monthIdx, 1)),
      monthKey: key,
      shortLabel: SHORT_MONTHS[monthIdx] ?? key,
      cohortSize: runs.length,
      avgHr: hrs.length ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length) : null,
      avgPaceSecPerKm: paces.length ? Math.round(paces.reduce((s, v) => s + v, 0) / paces.length) : null,
    })
  }

  if (buckets.length < TREND_SERIES.MIN_BUCKETS) return null

  const first = buckets[0]
  const last = buckets[buckets.length - 1]
  const hrDeltaBpm = (first.avgHr !== null && last.avgHr !== null) ? last.avgHr - first.avgHr : null
  const paceDeltaSec = (first.avgPaceSecPerKm !== null && last.avgPaceSecPerKm !== null)
    ? last.avgPaceSecPerKm - first.avgPaceSecPerKm
    : null
  const hrIsTrending = hrDeltaBpm !== null && Math.abs(hrDeltaBpm) >= TREND_SERIES.MIN_HR_DELTA_BPM
  const paceIsTrending = paceDeltaSec !== null && Math.abs(paceDeltaSec) >= TREND_SERIES.MIN_PACE_DELTA_SEC

  return {
    sessionType: anchor.sessionType,
    distanceKm: anchor.distanceKm,
    windowMonths,
    buckets,
    hrDeltaBpm,
    paceDeltaSec,
    hrIsTrending,
    paceIsTrending,
  }
}
