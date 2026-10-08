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
 *      NATIVE_BUNDLE_ID (see lib/native.ts) in the Apple Developer portal.
 */

import { authedFetch } from '@/lib/supabase/authedFetch'
import { createClient } from '@/lib/supabase/client'
import type { HealthKitWorkoutPayload } from './adapter'

const LAST_SYNC_KEY         = 'vetra_healthkit_last_sync_ts'
const SAMPLES_LOOKBACK_DAYS = 14
/** HR-SYNC-01: how far back to scan for HR-pending rows on each foreground sync. */
const HR_RETRY_LOOKBACK_HOURS = 48
/** Sleep states that count as "actually sleeping" (excludes 'inBed' and 'awake'). */
const ACTIVE_SLEEP_STATES   = new Set(['asleep', 'rem', 'deep', 'light'])
/** Per-workout HR sample cap. HKWorkout HR streams can be 1Hz — a 90 min run is ~5400 points.
 *  Plugin paginates internally; we cap at 10000 to be safe and clipped down to a 1Hz-equivalent
 *  set. The zone-bucketing kernel weights samples equally so 10k is plenty resolution. */
const HR_SAMPLES_PER_WORKOUT_LIMIT = 10000
/** HR-MAX-01: cap the workout-peak scan in fetchAppleHealthHRSnapshot. 2 pages ×
 *  50 = 100 running workouts covers an amateur's 90-day window many times over;
 *  the bound stops a heavy user's history from stalling the connect/wizard read. */
const WORKOUT_PEAK_MAX_PAGES = 2

// ─── Plugin-agnostic transport helpers ─────────────────────────────────────

/**
 * The outcome of one transport attempt, with the REASON intact.
 *
 * 🔴 HK-INGEST-REASON-01 (2026-10-08) — THIS USED TO RETURN `boolean`, AND THAT IS WHY
 * A LIVE FAILURE WAS UNDIAGNOSABLE.
 *
 * Measured in production: 14 sweeps on 2026-10-08 across 2 users read
 * `workouts_found: 1, posted: 0, failed: 1, error: null` — HealthKit found the run, the
 * upload failed, and **nothing anywhere recorded why**. One user (`0a972fdf`) has 22
 * sweeps that found workouts and **zero that ever posted**.
 *
 * The cause was not the telemetry. `health_sync_swept` records exactly what it was
 * built to record. The reason was **destroyed two layers earlier**: `return res.ok`
 * collapsed 401, 422, 429, 500 and every network error into one `false`, and the route
 * DOES return a reason in its body (`{ error: 'uuid, startDate, totalDistanceMeters,
 * durationSeconds required' }`) which was thrown away at this boundary.
 *
 * ⚠️ AND THE ONLY LINE THAT LOGGED ANYTHING WAS UNREACHABLE. The caller's
 * `catch (err) { totalFailed++; console.warn(...) }` can never fire for an upload
 * failure, because this function never throws — every real failure took the silent
 * `else totalFailed++` branch. Catalogue class "unchecked response", in its worst form:
 * `res.ok` IS read, correctly, and then the WHY is discarded.
 */
export interface PostOutcome {
  ok: boolean
  /** HTTP status, or null when the request never completed. */
  status: number | null
  /** The server's own reason, or the thrown message. Null only on success. */
  reason: string | null
}

/**
 * Collect failure reasons for the sweep event, DEDUPLICATED WITH A COUNT.
 *
 * ⚠️ Deduplicated on purpose. One user logged 13 failing sweeps in a day and a stuck
 * workout re-enters the window every sweep, so a raw list would be the same sentence
 * thirteen times and the 500-char column would truncate the SECOND distinct reason —
 * which is the one worth having. `422 x13` is strictly more informative and shorter.
 */
function noteFailure(into: Map<string, number>, o: PostOutcome): void {
  const key = `${o.status ?? 'no-response'}: ${o.reason ?? 'unknown'}`.slice(0, 120)
  into.set(key, (into.get(key) ?? 0) + 1)
}

/** `422 x13 · 401 x1` — stable order so two sweeps with the same causes read the same. */
function formatFailures(reasons: Map<string, number>): string | undefined {
  if (reasons.size === 0) return undefined
  return Array.from(reasons.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, n]) => (n > 1 ? `${k} x${n}` : k))
    .join(' \u00b7 ')
}

/** Posts a single workout payload to /api/health/ingest. */
export async function postWorkout(payload: HealthKitWorkoutPayload): Promise<PostOutcome> {
  return postJson('/api/health/ingest', payload)
}

/**
 * One transport, so the reason cannot be discarded in one place and kept in another.
 *
 * ⚠️ THE SWEEP FOR THE TWIN FOUND IT IMMEDIATELY: `postSamples` had the identical
 * `return res.ok / catch → false` shape, so the same blindness applied to daily
 * recovery samples. Both go through here now. (Exit criterion 3: grep for the SHAPE of
 * the fix — found 2, fixed 2.)
 */
async function postJson(url: string, body: unknown): Promise<PostOutcome> {
  try {
    const res = await authedFetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (res.ok) return { ok: true, status: res.status, reason: null }
    // The route's own message, where it has one. ⚠️ Read defensively and never let
    // reading it turn a diagnosable failure into an undiagnosable one: a non-JSON
    // body (an HTML error page from the edge, say) must still yield the STATUS.
    let reason: string | null = null
    try {
      const text = await res.text()
      if (text) {
        try { reason = (JSON.parse(text) as { error?: string }).error ?? text.slice(0, 200) }
        catch { reason = text.slice(0, 200) }
      }
    } catch { /* body unreadable; the status is still the finding */ }
    return { ok: false, status: res.status, reason: reason ?? `HTTP ${res.status}` }
  } catch (err) {
    // Never completed: no status exists, and saying so is the point.
    return { ok: false, status: null, reason: err instanceof Error ? err.message : String(err) }
  }
}

/** Posts a batch of daily samples to /api/health/samples. */
export async function postSamples(samples: Array<{
  sampleDate:   string
  rhrBpm?:      number | null
  hrvMs?:       number | null
  sleepHours?:  number | null
  sleepStages?: { deep: number; rem: number; light: number; awake: number } | null
  vo2Max?:      number | null
}>): Promise<PostOutcome> {
  // 🔴 THE TWIN, found by sweeping for the SHAPE of the postWorkout fix rather than its
  // symptom (exit criterion 3). It had the identical `return res.ok / catch → false`,
  // so a failed recovery-sample upload was exactly as undiagnosable as a failed run.
  if (samples.length === 0) return { ok: true, status: null, reason: null }
  return postJson('/api/health/samples', { samples })
}

/**
 * HEALTH-SYNC-OBS-01: reports one workout sweep to `/api/ops/health-sync-report`.
 *
 * A sweep that found NOTHING is the reason this exists. The founder ran for 17
 * days with the Apple Health *Workouts* permission off: `queryWorkouts` resolved
 * EMPTY (a denied read is not an error in `@capgo/capacitor-health`), the loop
 * broke on its first iteration, and no request reached the server. Telemetry on
 * the ingest route cannot see a request that was never made.
 *
 * Never throws and never blocks: a sweep must not fail because its own
 * bookkeeping did.
 */
async function reportSweep(report: {
  workoutsFound: number
  posted:        number
  failed:        number
  lookbackFrom:  string
  error?:        string
  failures?:     string
}): Promise<void> {
  try {
    await authedFetch('/api/ops/health-sync-report', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(report),
    })
  } catch { /* telemetry is never load-bearing */ }
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
  /** Resting HR (bpm) — from `restingHeartRate` quantity type, latest sample. Null if no samples. */
  restingHR: number | null
  /** Max HR (bpm) — highest HR sample observed across recent workouts (last 90 days). Null if no samples. */
  maxHR:     number | null
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
      // 'distance' removed — distance comes from HKWorkout.totalDistance, not standalone
      // samples. Requesting it here was wasted consent friction (DS-01).
      'calories',  // active energy burn per workout — DS-02
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

  // HR-MAX-01 part 3 — the observed max is a *max over the window*, but
  // `readSamples(heartRate, limit: N, ascending: false)` returns the N most
  // recent samples, which on a watch logging HR continuously can span a day or
  // two, not 90 — systematically understating the peak. The genuine peaks live
  // in workouts, which `queryWorkouts` paginates across the full window. So the
  // observed max is the greater of (a) a cheap recent raw-sample max and (b) the
  // peak HR across running workouts in the window. §50 still treats whatever
  // this returns as a floor, not a maximum.
  const [rhrRes, hrRes] = await Promise.all([
    Health.readSamples({ dataType: 'restingHeartRate', startDate: ninetyDaysAgo, endDate: now, limit: 30, ascending: false }),
    Health.readSamples({ dataType: 'heartRate',        startDate: ninetyDaysAgo, endDate: now, limit: 5000, ascending: false }),
  ])

  const rhrLatest = rhrRes.samples[0]?.value
  const restingHR = rhrLatest && rhrLatest > 0 ? Math.round(rhrLatest) : null

  let maxHRRaw = hrRes.samples.reduce((m, s) => Math.max(m, s.value || 0), 0)

  // Scan workout HR peaks across the window so an older hard effort isn't missed.
  // Bounded pagination keeps this cheap — an amateur's 90 days is well under one
  // page — and failures degrade to the recent-sample max above.
  try {
    let anchor: string | undefined
    for (let page = 0; page < WORKOUT_PEAK_MAX_PAGES; page++) {
      const res = await Health.queryWorkouts({
        workoutType: 'running',
        startDate:   ninetyDaysAgo,
        endDate:     now,
        limit:       50,
        ascending:   false,
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
            ascending: false,
          })
          for (const s of hrSamplesRes.samples) {
            if ((s.value || 0) > maxHRRaw) maxHRRaw = s.value
          }
        } catch { /* one workout's HR read failed — skip it */ }
      }
      anchor = (res as { anchor?: string }).anchor
      if (!anchor) break
    }
  } catch { /* workout scan unavailable — keep the recent-sample max */ }

  const maxHR = maxHRRaw > 0 ? Math.round(maxHRRaw) : null

  // Return null only when we have nothing at all. Partial data is useful — a
  // user with passive RHR from their watch but no recent workouts shouldn't
  // get blocked from pre-filling the value we did read.
  if (restingHR == null && maxHR == null) return null
  return { restingHR, maxHR }
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
    retryPendingHrRows(Health),
  ])
}

// HR-SYNC-02: throttled wrapper for UI-triggered HR retries (the fallback-row
// tap on a 24h+ HR-pending session card). Shares the 30s window with the
// CapacitorBoot resume listener so a fresh background sweep that just ran
// doesn't get duplicated by an immediate user tap. The returned promise
// resolves whether the retry actually ran or was throttled — UI uses this to
// switch the "Checking…" copy back off.
let _lastUiRetryAt = 0
const UI_RETRY_THROTTLE_MS = 30_000

export async function retryHrFromUi(): Promise<{ ran: boolean }> {
  const now = Date.now()
  if (now - _lastUiRetryAt < UI_RETRY_THROTTLE_MS) {
    // Still hold the "Checking…" state briefly so the user gets feedback,
    // even though we skipped the actual sync.
    await new Promise<void>(resolve => setTimeout(resolve, 400))
    return { ran: false }
  }
  _lastUiRetryAt = now
  try { await syncOnAppOpen() } catch {}
  return { ran: true }
}

// ─── Internal: workout sync ────────────────────────────────────────────────

type HealthModule = typeof import('@capgo/capacitor-health')['Health']

async function syncRecentWorkouts(Health: HealthModule): Promise<void> {
  const lastSyncIso = getLastSyncIso()
  // Always look back at least 24 h even when a recent watermark exists.
  // The ingest dedup makes re-posting safe (existing rows are patched/skipped).
  // This ensures a run from earlier today is never stranded if the watermark
  // advanced past it (e.g., after a background sync completed mid-session).
  const oneDayAgoMs = Date.now() - 24 * 60 * 60 * 1000
  const startDate   = lastSyncIso
    ? new Date(Math.min(new Date(lastSyncIso).getTime(), oneDayAgoMs)).toISOString()
    : isoDaysAgo(30)
  const endDate     = new Date().toISOString()

  let anchor: string | undefined
  let totalSynced = 0
  // HEALTH-SYNC-OBS-01 — `totalSynced` counts only SUCCESSES, so on its own it
  // cannot separate "HealthKit gave us nothing" from "it gave us runs the server
  // refused". Both report zero synced and they need different fixes.
  let totalFound  = 0
  let totalFailed = 0

  let sweepError: unknown
  /** HK-INGEST-REASON-01 — reason -> count, so the sweep event says WHY. */
  const failureReasons = new Map<string, number>()
  try {
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
      totalFound += res.workouts.length

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
          const outcome = await postWorkout(payload)
          if (outcome.ok) totalSynced++
          else {
            totalFailed++
            // HK-INGEST-REASON-01 — the reason now REACHES the sweep event. This branch
            // used to increment a counter and record nothing at all; the `catch` below
            // was unreachable because `postWorkout` never threw.
            noteFailure(failureReasons, outcome)
            // eslint-disable-next-line no-console
            console.warn('[health-sync] workout rejected', workout.platformId, outcome.status, outcome.reason)
          }
        } catch (err) {
          // Still reachable for a THROW in the HR read or payload build above, which is
          // a different failure from a rejected upload and is labelled as such.
          totalFailed++
          noteFailure(failureReasons, { ok: false, status: null, reason: err instanceof Error ? err.message : String(err) })
          // eslint-disable-next-line no-console
          console.warn('[health-sync] workout failed', workout.platformId, err)
        }
      }

      if (!res.anchor) break
      anchor = res.anchor
    }
  } catch (err) {
    // The plugin query itself threw. Recorded, then rethrown so the caller's
    // `Promise.allSettled` behaves exactly as it did before.
    sweepError = err
  }

  // Advance lastSync only when at least one workout posted successfully.
  if (totalSynced > 0) setLastSyncIso(endDate)

  // HEALTH-SYNC-OBS-01 — awaited, not fired and forgotten. This event is a
  // HEARTBEAT: "no events at all" has to mean "the sync did not run", and a
  // dropped POST from a backgrounding webview would look exactly like that.
  await reportSweep({
    workoutsFound: totalFound,
    posted:        totalSynced,
    failed:        totalFailed,
    lookbackFrom:  startDate,
    ...(sweepError ? { error: sweepError instanceof Error ? sweepError.message : String(sweepError) } : {}),
    // HK-INGEST-REASON-01 — distinct from `error`, which is the sweep THROWING.
    // `failures` is per-workout rejection, which is the case that was invisible.
    ...(formatFailures(failureReasons) ? { failures: formatFailures(failureReasons) } : {}),
  })

  if (sweepError) throw sweepError
}

// ─── HR-SYNC-01: foreground retry for HR-pending rows ───────────────────────
//
// Apple Watch HR samples land in HealthKit on Apple's schedule, often hours
// after the workout shell. A row inserted with hrSamples=[] needs to be
// retried whenever the user returns to the app. We scan our backend for
// HR-null `source='apple_health'` rows from the last 48h, re-query HealthKit
// for HR samples in their windows, and re-post if anything appeared. The
// existing ingest path (`/api/health/ingest` → `consolidateIncomingHealthKitRow`)
// handles the patch, late-arrival gate, and analyse-run trigger.

async function retryPendingHrRows(Health: HealthModule): Promise<void> {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const lookbackIso = isoDaysAgo(HR_RETRY_LOOKBACK_HOURS / 24)

    const { data: pendingRows } = await supabase
      .from('strava_activities')
      .select('apple_health_uuid, start_date, moving_time_s, raw_payload, distance_m')
      .eq('user_id', user.id)
      .eq('source', 'apple_health')
      .is('avg_hr', null)
      .gte('start_date', lookbackIso)
      .order('start_date', { ascending: false })
      .limit(10)

    if (!pendingRows?.length) return

    for (const row of pendingRows as Array<{
      apple_health_uuid: string
      start_date:        string
      moving_time_s:     number
      raw_payload:       any
      distance_m:        string | number
    }>) {
      try {
        const startIso = row.start_date
        const endIso   = new Date(new Date(startIso).getTime() + row.moving_time_s * 1000).toISOString()
        const hrRes = await Health.readSamples({
          dataType:  'heartRate',
          startDate: startIso,
          endDate:   endIso,
          limit:     HR_SAMPLES_PER_WORKOUT_LIMIT,
          ascending: true,
        })
        if (!hrRes.samples.length) continue  // still nothing — leave for the next retry

        // Reconstruct the payload using the stored raw_payload for the shell
        // fields (totalDistance, calories, sourceName, elevation metadata),
        // and overlay the freshly-queried HR samples. The ingest path will
        // route through the consolidate helper, which patches HR on the
        // existing row (same apple_health_uuid → self-resync path).
        const rawPayload = row.raw_payload && typeof row.raw_payload === 'object' ? row.raw_payload : {}
        const payload: HealthKitWorkoutPayload = {
          uuid:                row.apple_health_uuid,
          startDate:           startIso,
          endDate:             endIso,
          totalDistanceMeters: typeof row.distance_m === 'string' ? parseFloat(row.distance_m) : row.distance_m,
          durationSeconds:     row.moving_time_s,
          totalEnergyKcal:     rawPayload.totalEnergyKcal,
          elevationGainMeters: rawPayload.elevationGainMeters,
          hrSamples:           hrRes.samples.map(s => ({ valueBpm: s.value, timestamp: s.startDate })),
          workoutType:         'running',
          sourceName:          rawPayload.sourceName,
        }
        await postWorkout(payload)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[health-sync] hr-retry failed', row.apple_health_uuid, err)
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[health-sync] hr-retry sweep skipped', err instanceof Error ? err.message : err)
  }
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
    // DS-05 — per-stage minutes. deep/rem/light count toward sleepMins above;
    // awake does not (it isn't sleep). Stays all-zero when the source reports
    // only undifferentiated 'asleep' — caller posts null stages in that case.
    stage:     { deep: number; rem: number; light: number; awake: number }
  }> = {}
  const ensure = (date: string) =>
    (byDate[date] ??= { rhrBpm: [], hrvMs: [], sleepMins: 0, stage: { deep: 0, rem: 0, light: 0, awake: 0 } })

  for (const s of rhrRes.samples) {
    if (!s.value || s.value <= 0) continue
    ensure(localDateKey(s.startDate)).rhrBpm.push(s.value)
  }
  for (const s of hrvRes.samples) {
    if (!s.value || s.value <= 0) continue
    ensure(localDateKey(s.startDate)).hrvMs.push(s.value)
  }
  for (const s of sleepRes.samples) {
    if (!s.sleepState) continue
    const isActive = ACTIVE_SLEEP_STATES.has(s.sleepState)
    if (!isActive && s.sleepState !== 'awake') continue  // skip 'inBed' / unknown
    const minutes = (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 60000
    if (minutes <= 0) continue
    // Sleep that crosses midnight is bucketed by start date — the Apple Watch
    // habit of reporting one main session per night makes this consistent.
    const agg = ensure(localDateKey(s.startDate))
    if (isActive) agg.sleepMins += minutes  // deep/rem/light/asleep count as sleep; awake doesn't
    if (s.sleepState === 'deep')  agg.stage.deep  += minutes
    else if (s.sleepState === 'rem')   agg.stage.rem   += minutes
    else if (s.sleepState === 'light') agg.stage.light += minutes
    else if (s.sleepState === 'awake') agg.stage.awake += minutes
  }

  const samples = Object.entries(byDate).map(([sampleDate, agg]) => {
    const staged = agg.stage.deep + agg.stage.rem + agg.stage.light
    return {
      sampleDate,
      rhrBpm:     agg.rhrBpm.length ? Math.round(avg(agg.rhrBpm)) : null,
      hrvMs:      agg.hrvMs.length  ? round1(avg(agg.hrvMs))      : null,
      sleepHours: agg.sleepMins > 0 ? round1(agg.sleepMins / 60)  : null,
      // DS-05 — only post a breakdown when the source actually staged the night.
      sleepStages: staged > 0
        ? {
            deep:  Math.round(agg.stage.deep),
            rem:   Math.round(agg.stage.rem),
            light: Math.round(agg.stage.light),
            awake: Math.round(agg.stage.awake),
          }
        : null,
      vo2Max:     null,  // not exposed by @capgo/capacitor-health — TODO follow-up
    }
  })

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
