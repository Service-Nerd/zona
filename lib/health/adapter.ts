import { bucketHRSamples, type HRZones, type HRStreamSummary } from '@/lib/strava'

/**
 * HealthKit workout payload from the iOS sync.
 *
 * Mirrors a subset of HKWorkout + associated HKQuantitySample(.heartRate). Field
 * names are device-side conventions — the iOS sync is responsible for marshalling
 * HK objects into this shape before posting to /api/health/ingest.
 */
export interface HealthKitWorkoutPayload {
  /** HKWorkout.uuid — stable per workout, used as the dedupe key. */
  uuid:                 string
  /** ISO timestamp — HKWorkout.startDate. */
  startDate:            string
  /** ISO timestamp — HKWorkout.endDate. */
  endDate:              string
  /** Total distance in metres — HKWorkout.totalDistance. */
  totalDistanceMeters:  number
  /** Workout duration in seconds — HKWorkout.duration. */
  durationSeconds:      number
  /** Optional total energy burned in kcal — HKWorkout.totalEnergyBurned. */
  totalEnergyKcal?:     number
  /** Optional elevation gain — HKWorkoutMetadata `HKMetadataKeyElevationAscended` (metres). */
  elevationGainMeters?: number
  /** Optional avg HR — if absent, computed from hrSamples. */
  avgHeartRate?:        number
  /** Optional max HR — if absent, computed from hrSamples. */
  maxHeartRate?:        number
  /** HKQuantitySample[] for HKQuantityTypeIdentifierHeartRate, mapped to {bpm, ts}. */
  hrSamples?:           Array<{ valueBpm: number; timestamp: string }>
  /** 'running' typically; the iOS sync filters HKWorkout by activityType. */
  workoutType:          string
  /** Optional sourceName (e.g., 'Apple Watch'). */
  sourceName?:          string
}

/**
 * The strava_activities row shape produced by the adapter — matches the schema
 * `/api/analyse-run` already consumes. Internal contract: the table is source-
 * agnostic; this row is what the auto-analysis pipeline reads.
 */
export interface HealthKitActivityRow {
  user_id:              string
  source:               'apple_health'
  apple_health_uuid:    string
  strava_activity_id:   null
  activity_type:        'Run'
  sport_type:           'Run'
  name:                 string
  start_date:           string
  distance_m:           number
  moving_time_s:        number
  elapsed_time_s:       number
  elevation_gain:       number | null
  avg_hr:               number | null
  max_hr:               number | null
  avg_speed:            number | null
  suffer_score:         null
  hr_in_zone_pct:       number | null
  hr_above_ceiling_pct: number | null
  hr_below_floor_pct:   number | null
  raw_payload:          HealthKitWorkoutPayload
  processed_at:         string
}

/**
 * Pure mapper: HealthKit workout payload + plan zones → strava_activities row.
 *
 * The HR-zone bucketing reuses the same kernel (`bucketHRSamples`) the Strava
 * webhook uses, so the analysis pipeline sees identical numerics regardless of source.
 */
export function adaptHealthKitWorkout(
  userId: string,
  payload: HealthKitWorkoutPayload,
  zones: HRZones,
): HealthKitActivityRow {
  const hrValues = payload.hrSamples?.map(s => s.valueBpm).filter(v => v > 0) ?? []
  const summary: HRStreamSummary | null = hrValues.length ? bucketHRSamples(hrValues, zones) : null

  const avgHr = payload.avgHeartRate
    ?? (hrValues.length ? Math.round(hrValues.reduce((s, v) => s + v, 0) / hrValues.length) : null)
  const maxHr = payload.maxHeartRate
    ?? (hrValues.length ? Math.max(...hrValues) : null)

  const avgSpeed = payload.durationSeconds > 0
    ? Math.round((payload.totalDistanceMeters / payload.durationSeconds) * 10000) / 10000
    : null

  return {
    user_id:              userId,
    source:               'apple_health',
    apple_health_uuid:    payload.uuid,
    strava_activity_id:   null,
    activity_type:        'Run',
    sport_type:           'Run',
    name:                 payload.sourceName ? `Run (${payload.sourceName})` : 'Run',
    start_date:           payload.startDate,
    distance_m:           Math.round(payload.totalDistanceMeters * 100) / 100,
    moving_time_s:        Math.round(payload.durationSeconds),
    elapsed_time_s:       Math.round(payload.durationSeconds),
    elevation_gain:       payload.elevationGainMeters != null ? Math.round(payload.elevationGainMeters * 100) / 100 : null,
    avg_hr:               avgHr != null ? Math.round(avgHr) : null,
    max_hr:               maxHr != null ? Math.round(maxHr) : null,
    avg_speed:            avgSpeed,
    suffer_score:         null,
    hr_in_zone_pct:       summary?.inZonePct ?? null,
    hr_above_ceiling_pct: summary?.abovePct  ?? null,
    hr_below_floor_pct:   summary?.belowPct  ?? null,
    raw_payload:          payload,
    processed_at:         new Date().toISOString(),
  }
}
