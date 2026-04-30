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
import { COHORT_SIMILARITY } from './constants'

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
