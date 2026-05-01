/**
 * Client-side HealthKit sync — runs on iOS native (Capacitor 8 + @capgo/capacitor-health).
 *
 * Plugin: `@capgo/capacitor-health` (cross-platform — HealthKit on iOS,
 * Health Connect on Android). v8.x.x matches Capacitor 8.
 *
 * Callers (HRZones prefill, MeScreen Apple Health connect row, CapacitorBoot
 * sync hook) wrap every entry-point in try/catch. PWA users never reach this
 * code (Capacitor.isNativePlatform() guard at the call site).
 *
 * VO2 max isn't in the plugin's HealthDataType union — the race-times
 * cross-check field stays null until VO2 max sync is wired through a Swift
 * bridge or plugin fork. All other readiness signals (RHR, HRV, sleep, runs)
 * flow through this file.
 *
 * Manual steps still required after this file works locally:
 *   1. `npx cap sync ios`
 *   2. Xcode → App target → Signing & Capabilities → + Capability → HealthKit
 *   3. (For real device / TestFlight) enable HealthKit entitlement on
 *      app.vetra.ios in the Apple Developer portal.
 */

import { authedFetch } from '@/lib/supabase/authedFetch'
import type { HealthKitWorkoutPayload } from './adapter'

const LAST_SYNC_KEY         = 'vetra_healthkit_last_sync_ts'
const SAMPLES_LOOKBACK_DAYS = 14
/** Sleep states that count as "actually sleeping" (excludes 'inBed' and 'awake'). */
const ACTIVE_SLEEP_STATES   = new Set(['asleep', 'rem', 'deep', 'light'])
/** Per-workout HR sample cap. HKWorkout HR streams can be 1Hz — a 90 min run is ~5400 points.
 *  Plugin paginates internally; we cap at 10000 to be safe and clipped down to a 1Hz-equivalent
 *  set. The zone-bucketing kernel weights samples equally so 10k is plenty resolution. */
const HR_SAMPLES_PER_WORKOUT_LIMIT = 10000

// ─── Plugin-agnostic transport helpers ─────────────────────────────────────

/** Posts a single workout payload to /api/health/ingest. */
export async function postWorkout(payload: HealthKitWorkoutPayload): Promise<boolean> {
  try {
    const res = await authedFetch('/api/health/ingest', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Posts a batch of daily samples to /api/health/samples. */
export async function postSamples(samples: Array<{
  sampleDate:  string
  rhrBpm?:     number | null
  hrvMs?:      number | null
  sleepHours?: number | null
  vo2Max?:     number | null
}>): Promise<boolean> {
  if (samples.length === 0) return true
  try {
    const res = await authedFetch('/api/health/samples', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ samples }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Last-sync timestamp tracked in localStorage so we don't re-post every workout. */
export function getLastSyncIso(): string | null {
  try { return localStorage.getItem(LAST_SYNC_KEY) } catch { return null }
}

export function setLastSyncIso(iso: string): void {
  try { localStorage.setItem(LAST_SYNC_KEY, iso) } catch {}
}

export const SAMPLES_LOOKBACK = SAMPLES_LOOKBACK_DAYS

// ─── Plugin-backed entry points ────────────────────────────────────────────

export interface AppleHealthHRSnapshot {
  /** Resting HR (bpm) — from `restingHeartRate` quantity type, latest sample. */
  restingHR: number
  /** Max HR (bpm) — highest HR sample observed across recent workouts (last 90 days). */
  maxHR:     number
}

/**
 * Request HealthKit read authorization for the data types we use.
 * Returns true when the workout + heartRate types are authorized — those are
 * the minimum the ingest pipeline needs. RHR/HRV/sleep are nice-to-have for
 * the readiness signal but not required for basic functionality.
 */
export async function requestHealthKitAuth(): Promise<boolean> {
  const { Health } = await import('@capgo/capacitor-health')
  const availability = await Health.isAvailable()
  if (!availability.available) return false

  const status = await Health.requestAuthorization({
    read: [
      'workouts',
      'heartRate',
      'restingHeartRate',
      'heartRateVariability',
      'sleep',
      'distance',
    ],
  })
  // HealthKit can't tell us if read access was actually granted (Apple's
  // privacy model — silent denial reads as empty arrays). The plugin returns
  // its best guess; treat the call succeeding as "user saw the prompt and
  // didn't bail out" and let the actual sync verify by trying to read.
  return Array.isArray(status.readAuthorized)
}

/**
 * Pre-fill source for HRZones — latest RHR + observed max HR.
 * Used by the "Use your Apple Health values" button in the HR Zones section.
 */
export async function fetchAppleHealthHRSnapshot(): Promise<AppleHealthHRSnapshot | null> {
  const { Health } = await import('@capgo/capacitor-health')
  const ninetyDaysAgo = isoDaysAgo(90)
  const now           = new Date().toISOString()

  const [rhrRes, hrRes] = await Promise.all([
    Health.readSamples({ dataType: 'restingHeartRate', startDate: ninetyDaysAgo, endDate: now, limit: 30, ascending: false }),
    Health.readSamples({ dataType: 'heartRate',        startDate: ninetyDaysAgo, endDate: now, limit: 5000, ascending: false }),
  ])

  const rhrLatest = rhrRes.samples[0]?.value
  if (!rhrLatest || rhrLatest <= 0) return null
  const maxHR = hrRes.samples.reduce((m, s) => Math.max(m, s.value || 0), 0)
  if (!maxHR || maxHR <= 0) return null

  return { restingHR: Math.round(rhrLatest), maxHR: Math.round(maxHR) }
}

/**
 * Foreground sync — called by CapacitorBoot on app open and by the connect-button
 * first-sync flow. Pulls (a) running workouts since last sync, (b) the last 14
 * days of recovery samples, and posts both to the backend.
 *
 * Silent failure end-to-end. Errors logged via console.warn so they're visible
 * in remote-debug Safari but never bubble up to UI.
 */
export async function syncOnAppOpen(): Promise<void> {
  const { Health } = await import('@capgo/capacitor-health')
  const availability = await Health.isAvailable()
  if (!availability.available) return

  await Promise.allSettled([
    syncRecentWorkouts(Health),
    syncRecoverySamples(Health),
  ])
}

// ─── Internal: workout sync ────────────────────────────────────────────────

type HealthModule = typeof import('@capgo/capacitor-health')['Health']

async function syncRecentWorkouts(Health: HealthModule): Promise<void> {
  const startDate = getLastSyncIso() ?? isoDaysAgo(30)  // first sync — last 30 days
  const endDate   = new Date().toISOString()

  let anchor: string | undefined
  let totalSynced = 0

  // Pagination loop — Cap-go's queryWorkouts returns an anchor when more data
  // is available. Bound the loop to avoid runaway requests.
  for (let page = 0; page < 10; page++) {
    const res = await Health.queryWorkouts({
      workoutType: 'running',
      startDate,
      endDate,
      limit:       50,
      ascending:   true,  // post oldest first so partial failures still advance lastSync
      anchor,
    })
    if (!res.workouts.length) break

    for (const workout of res.workouts) {
      try {
        const hrSamplesRes = await Health.readSamples({
          dataType:  'heartRate',
          startDate: workout.startDate,
          endDate:   workout.endDate,
          limit:     HR_SAMPLES_PER_WORKOUT_LIMIT,
          ascending: true,
        })
        const hrSamples = hrSamplesRes.samples.map(s => ({
          valueBpm:  s.value,
          timestamp: s.startDate,
        }))

        const payload: HealthKitWorkoutPayload = {
          uuid:                workout.platformId ?? `${workout.startDate}-${workout.duration}`,
          startDate:           workout.startDate,
          endDate:             workout.endDate,
          totalDistanceMeters: workout.totalDistance ?? 0,
          durationSeconds:     workout.duration,
          totalEnergyKcal:     workout.totalEnergyBurned,
          elevationGainMeters: parseElevation(workout.metadata),
          hrSamples,
          workoutType:         'running',
          sourceName:          workout.sourceName,
        }
        const ok = await postWorkout(payload)
        if (ok) totalSynced++
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[health-sync] workout failed', workout.platformId, err)
      }
    }

    if (!res.anchor) break
    anchor = res.anchor
  }

  // Advance lastSync only when at least one workout posted successfully.
  if (totalSynced > 0) setLastSyncIso(endDate)
}

function parseElevation(metadata: Record<string, string> | undefined): number | undefined {
  if (!metadata) return undefined
  const raw = metadata.HKMetadataKeyElevationAscended ?? metadata.elevationAscended
  if (!raw) return undefined
  const num = parseFloat(raw)
  return Number.isFinite(num) ? num : undefined
}

// ─── Internal: recovery samples sync ───────────────────────────────────────

async function syncRecoverySamples(Health: HealthModule): Promise<void> {
  const startDate = isoDaysAgo(SAMPLES_LOOKBACK_DAYS)
  const endDate   = new Date().toISOString()

  const [rhrRes, hrvRes, sleepRes] = await Promise.all([
    Health.readSamples({ dataType: 'restingHeartRate',     startDate, endDate, limit: 100, ascending: true }),
    Health.readSamples({ dataType: 'heartRateVariability', startDate, endDate, limit: 100, ascending: true }),
    Health.readSamples({ dataType: 'sleep',                startDate, endDate, limit: 500, ascending: true }),
  ])

  // Group by local date — `health_daily_samples` is keyed on (user_id, sample_date).
  const byDate: Record<string, {
    rhrBpm:    number[]
    hrvMs:     number[]
    sleepMins: number  // accumulated active-sleep duration in minutes
  }> = {}
  const ensure = (date: string) => (byDate[date] ??= { rhrBpm: [], hrvMs: [], sleepMins: 0 })

  for (const s of rhrRes.samples) {
    if (!s.value || s.value <= 0) continue
    ensure(localDateKey(s.startDate)).rhrBpm.push(s.value)
  }
  for (const s of hrvRes.samples) {
    if (!s.value || s.value <= 0) continue
    ensure(localDateKey(s.startDate)).hrvMs.push(s.value)
  }
  for (const s of sleepRes.samples) {
    if (!s.sleepState || !ACTIVE_SLEEP_STATES.has(s.sleepState)) continue
    const minutes = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000
    if (minutes <= 0) continue
    // Sleep that crosses midnight is bucketed by start date — the Apple Watch
    // habit of reporting one main session per night makes this consistent.
    ensure(localDateKey(s.startDate)).sleepMins += minutes
  }

  const samples = Object.entries(byDate).map(([sampleDate, agg]) => ({
    sampleDate,
    rhrBpm:     agg.rhrBpm.length ? Math.round(avg(agg.rhrBpm)) : null,
    hrvMs:      agg.hrvMs.length  ? round1(avg(agg.hrvMs))      : null,
    sleepHours: agg.sleepMins > 0 ? round1(agg.sleepMins / 60)  : null,
    vo2Max:     null,  // not exposed by @capgo/capacitor-health — TODO follow-up
  }))

  if (samples.length > 0) await postSamples(samples)
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function localDateKey(iso: string): string {
  // YYYY-MM-DD in the device's local timezone. Apple Watch attributes a sleep
  // session to its start-night; we mirror that.
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}
