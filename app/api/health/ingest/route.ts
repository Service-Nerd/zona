import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { getUserHRZones } from '@/lib/strava'
import { adaptHealthKitWorkout, type HealthKitWorkoutPayload } from '@/lib/health/adapter'
import { autoMatchAndAnalyse, getInternalBaseUrl } from '@/lib/coaching/autoAnalyse'

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

  const { error } = await supabase
    .from('strava_activities')
    .upsert(row, { onConflict: 'user_id,apple_health_uuid' })

  if (error) {
    console.error('[health-ingest] upsert failed', error.message)
    return NextResponse.json({ error: 'Persist failed' }, { status: 500 })
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
