import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getStravaToken, fetchHRStreamSummary } from '@/lib/strava'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'

// POST /api/strava/link-activity
// Called when a user manually links a Strava activity to a planned session.
// Mirrors the webhook's enrichment + analysis pipeline so manual linking
// produces the same strava_activities + run_analysis rows as auto-linking.

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('strava_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const { strava_activity_id, week_n, session_day } = body as {
    strava_activity_id: number
    week_n: number
    session_day: string
  }
  if (!strava_activity_id || week_n == null || !session_day) {
    return NextResponse.json({ error: 'strava_activity_id, week_n, session_day required' }, { status: 422 })
  }

  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // user_settings PK is `id` (referencing auth.users.id) — same column-name bug pattern fixed in 991c617.
  const { data: settings } = await supabase
    .from('user_settings')
    .select('strava_refresh_token')
    .eq('id', user.id)
    .single() as { data: { strava_refresh_token: string } | null; error: unknown }

  if (!settings?.strava_refresh_token) {
    return NextResponse.json({ error: 'Strava not connected' }, { status: 400 })
  }

  const { access_token } = await getStravaToken(settings.strava_refresh_token)

  const actRes = await fetch(
    `https://www.strava.com/api/v3/activities/${strava_activity_id}`,
    { headers: { Authorization: `Bearer ${access_token}` }, cache: 'no-store' }
  )
  if (!actRes.ok) {
    return NextResponse.json({ error: 'Strava activity fetch failed', status: actRes.status }, { status: 502 })
  }
  const activity = await actRes.json()

  if (activity.type !== 'Run' && activity.sport_type !== 'Run') {
    return NextResponse.json({ error: 'Activity is not a run' }, { status: 422 })
  }

  const hrSummary = await fetchHRStreamSummary(supabase, access_token, strava_activity_id, user.id)

  const { error: upsertErr } = await supabase.from('strava_activities').upsert({
    user_id:              user.id,
    strava_activity_id:   activity.id,
    activity_type:        activity.type,
    sport_type:           activity.sport_type,
    name:                 activity.name,
    start_date:           activity.start_date,
    distance_m:           activity.distance,
    moving_time_s:        activity.moving_time,
    elapsed_time_s:       activity.elapsed_time,
    elevation_gain:       activity.total_elevation_gain,
    avg_hr:               activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
    max_hr:               activity.max_heartrate     != null ? Math.round(activity.max_heartrate)     : null,
    avg_speed:            activity.average_speed,
    suffer_score:         activity.suffer_score ?? null,
    hr_in_zone_pct:       hrSummary?.inZonePct ?? null,
    hr_above_ceiling_pct: hrSummary?.abovePct  ?? null,
    hr_below_floor_pct:   hrSummary?.belowPct  ?? null,
    raw_payload:          { source: 'manual_link' },
    processed_at:         new Date().toISOString(),
  }, { onConflict: 'user_id,strava_activity_id' })

  if (upsertErr) {
    console.error('[link-activity] strava_activities upsert failed', upsertErr.message)
    return NextResponse.json({ error: 'Failed to persist activity' }, { status: 500 })
  }

  // Trigger analysis via internal call (same pattern as the webhook).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  try {
    await fetch(`${baseUrl}/api/analyse-run`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'x-user-id':     user.id,
      },
      body: JSON.stringify({ strava_activity_id, week_n, session_day }),
    })
  } catch (err) {
    console.warn('[link-activity] analyse-run trigger failed', err)
  }

  return NextResponse.json({ ok: true })
}
