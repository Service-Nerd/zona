import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { getUserHRZones } from '@/lib/strava'
import { adaptHealthKitWorkout, type HealthKitWorkoutPayload } from '@/lib/health/adapter'
import { autoMatchAndAnalyse, getInternalBaseUrl } from '@/lib/coaching/autoAnalyse'
import { consolidateIncomingHealthKitRow } from '@/lib/coaching/healthkitConsolidate'
import { decideLateArrival } from '@/lib/coaching/lateArrivalGate'

// POST /api/health/ingest
//
// Accepts a HealthKit workout payload from the iOS sync, adapts it to the
// canonical strava_activities row shape, persists it, and triggers the same
// auto-match + AI analysis pipeline the Strava webhook uses.
//
// Auth: bearer token (paid/trial). Tier-gated on `activity_intelligence`.
// Free users cannot ingest — the iOS sync should not call this for free tier
// (the gate also lives client-side in lib/health/sync.ts).

let _supabase: ReturnType<typeof createServiceClient> | undefined
function getSupabase(): any {
  return (_supabase ??= createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ))
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  let payload: HealthKitWorkoutPayload
  try {
    payload = await req.json() as HealthKitWorkoutPayload
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  if (!payload.uuid || !payload.startDate || !payload.totalDistanceMeters || !payload.durationSeconds) {
    return NextResponse.json({ error: 'uuid, startDate, totalDistanceMeters, durationSeconds required' }, { status: 422 })
  }
  if (payload.workoutType !== 'running') {
    return NextResponse.json({ status: 'ignored', reason: 'non-run workout' })
  }

  const userId = user.id
  const supabase = getSupabase()
  const zones = await getUserHRZones(supabase, userId)

  const row = adaptHealthKitWorkout(userId, payload, zones)

  // INGEST-DEDUP-01 + HR-SYNC-01: if a Strava row or another HealthKit row
  // already covers this physical run (±5 min / ±5%), don't insert a duplicate.
  // The canonical row stays and keeps its completion/analysis links; we only
  // lift the HR summary onto it if it was missing one. When the lift happens
  // INSIDE the fresh-coaching window, re-trigger analyse-run so the score card
  // and reframe reflect real HR. When OUTSIDE the window, the consolidate
  // helper already stamped hr_arrived_late_at — we skip the trigger here so
  // the user doesn't get a stale fresh reframe two days after the run
  // (Hutchinson, ADR-011 §5).
  const dedup = await consolidateIncomingHealthKitRow(supabase, userId, row)
  if (dedup.skipped) {
    if (dedup.hrLifted && dedup.withinFreshWindow && dedup.canonicalAppleHealthUuid) {
      const { data: canonicalAnalysis } = await supabase
        .from('run_analysis')
        .select('week_n, session_day')
        .eq('user_id', userId)
        .eq('apple_health_uuid', dedup.canonicalAppleHealthUuid)
        .maybeSingle()
      if (canonicalAnalysis) {
        waitUntil(triggerHrRefreshAnalysis(userId, dedup.canonicalAppleHealthUuid,
          canonicalAnalysis.week_n, canonicalAnalysis.session_day))
      }
    }
    return NextResponse.json({ status: 'deduped', canonical_id: dedup.canonicalId })
  }

  // Capture the existing row's state before the upsert. Three things we need
  // to know:
  //   1. wasHrAbsent — was HR missing on the existing row? Drives whether
  //      this is an HR-arrival event worth re-analysing.
  //   2. hr_present_at_first_query — set ONCE on insert; preserved on resync.
  //      Drives the instrumentation cohort (Fried/Traynor non-negotiable).
  //   3. workout-end staleness — if HR just arrived but the run is > 24h old,
  //      patch HR but skip the fresh-reframe trigger (Hutchinson).
  const { data: existingAct } = await supabase
    .from('strava_activities')
    .select('id, avg_hr, hr_present_at_first_query')
    .eq('user_id', userId)
    .eq('apple_health_uuid', payload.uuid)
    .maybeSingle()
  const isFirstInsert = existingAct == null
  const wasHrAbsent   = !!existingAct && existingAct.avg_hr == null && row.avg_hr != null

  // HR-SYNC-01 instrumentation: stamp the first-query state once on insert.
  // On resync, preserve whatever was set originally (Supabase upsert doesn't
  // expose a per-column UPDATE filter, so we set the field explicitly to its
  // existing value to make the preservation intent explicit).
  const rowToWrite = {
    ...row,
    hr_present_at_first_query: isFirstInsert
      ? (row.avg_hr != null)
      : existingAct!.hr_present_at_first_query ?? null,
  }

  // HR-SYNC-01: late-arrival stamp on the same-uuid resync path.
  // (Cross-source consolidate path stamps via consolidate helper above.)
  let lateArrival: ReturnType<typeof decideLateArrival> | null = null
  if (wasHrAbsent) {
    lateArrival = decideLateArrival(
      { workoutStartIso: payload.startDate, durationSeconds: payload.durationSeconds },
      new Date(),
    )
    if (!lateArrival.withinFreshWindow) {
      (rowToWrite as any).hr_arrived_late_at = new Date().toISOString()
    }
  }

  const { error } = await supabase
    .from('strava_activities')
    .upsert(rowToWrite, { onConflict: 'user_id,apple_health_uuid' })

  if (error) {
    console.error('[health-ingest] upsert failed', error.message)
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 })
  }

  // HR just arrived for an already-linked + already-analysed session AND we're
  // still inside the fresh-coaching window — re-run analyse-run so the score
  // card + reframe reflect real HR. Stale arrivals (> 24h) are intentionally
  // skipped: the column is patched, the daily coach note can reference it
  // tomorrow via hr_arrived_late_at, but no fresh reframe.
  if (wasHrAbsent && lateArrival?.withinFreshWindow) {
    const { data: existingAnalysis } = await supabase
      .from('run_analysis')
      .select('week_n, session_day')
      .eq('user_id', userId)
      .eq('apple_health_uuid', payload.uuid)
      .maybeSingle()
    if (existingAnalysis) {
      waitUntil(triggerHrRefreshAnalysis(userId, payload.uuid,
        existingAnalysis.week_n, existingAnalysis.session_day))
    }
  }

  // Auto-match + analysis runs in the background. Fire-and-forget via waitUntil
  // mirrors the Strava webhook behaviour (the AI step takes 5-15s).
  waitUntil(
    autoMatchAndAnalyse(
      supabase,
      userId,
      {
        id:                   payload.uuid,
        type:                 'Run',
        sport_type:           'Run',
        start_date:           payload.startDate,
        distance:             payload.totalDistanceMeters,
        moving_time:          payload.durationSeconds,
        elapsed_time:         payload.durationSeconds,
        total_elevation_gain: payload.elevationGainMeters ?? 0,
        average_heartrate:    row.avg_hr ?? undefined,
        max_heartrate:        row.max_hr ?? undefined,
        average_speed:        row.avg_speed ?? undefined,
        name:                 row.name,
      },
      { source: 'apple_health', appleHealthUuid: payload.uuid },
      getInternalBaseUrl(),
    ).catch(err => console.error('[health-ingest] auto-analyse failed', err))
  )

  return NextResponse.json({ status: 'ok', activity_id: row.apple_health_uuid })
}

// HR-SYNC-01: re-fire analyse-run silently when HR appears for a session that
// was already linked + analysed with no HR. Shared between the same-uuid
// resync path and the cross-source consolidation patch path. No push — the
// link-time notification already fired on the original ingest, and Wendy's
// habit rule says we don't re-trigger the post-run loop with a notification.
function triggerHrRefreshAnalysis(
  userId:           string,
  appleHealthUuid:  string,
  weekN:            number,
  sessionDay:       string,
): Promise<void> {
  return fetch(`${getInternalBaseUrl()}/api/analyse-run`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'x-user-id':     userId,
    },
    body: JSON.stringify({
      apple_health_uuid: appleHealthUuid,
      week_n:            weekN,
      session_day:       sessionDay,
    }),
  })
    .then(() => undefined)
    .catch(err => { console.error('[health-ingest] hr-refresh analyse failed', err) })
}
