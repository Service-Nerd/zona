import { createClient } from '@supabase/supabase-js'
import { waitUntil } from '@vercel/functions'
import { NextRequest, NextResponse } from 'next/server'
import { getStravaToken } from '@/lib/strava'

// Strava webhook docs: https://developers.strava.com/docs/webhooks/
//
// GET  — subscription verification (challenge-response handshake)
// POST — activity events (create / update / delete)
//
// Verification token stored in STRAVA_WEBHOOK_VERIFY_TOKEN env var.
// Service-role Supabase client used — no user session in webhook context.

// Lazily instantiated — env vars are only available at request time, not build time
let _supabase: ReturnType<typeof createClient> | undefined
function getSupabase(): any {
  return (_supabase ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ))
}

// ─── GET — Strava subscription verification ───────────────────────────────────

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const mode      = params.get('hub.mode')
  const challenge = params.get('hub.challenge')
  const token     = params.get('hub.verify_token')

  if (mode !== 'subscribe' || !challenge) {
    return NextResponse.json({ error: 'Invalid verification request' }, { status: 400 })
  }

  if (token !== process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ error: 'Token mismatch' }, { status: 403 })
  }

  // Echo challenge back — Strava confirms subscription on 200 + {"hub.challenge": "..."}
  return NextResponse.json({ 'hub.challenge': challenge })
}

// ─── POST — Strava activity event ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let payload: StravaEvent
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 })
  }

  // Only process Run activity creates/updates — ignore deletes and other types
  if (payload.object_type !== 'activity') {
    return NextResponse.json({ status: 'ignored' })
  }
  if (payload.aspect_type === 'delete') {
    await handleActivityDelete(payload)
    return NextResponse.json({ status: 'ok' })
  }

  // Strava's webhook timeout is 2s, but the enrichment pipeline (Strava
  // fetch + HR stream + AI feedback + DB writes) takes 5-15s. waitUntil
  // tells the serverless runtime to keep the function alive after the
  // 200 response so the background work actually completes. Fire-and-
  // forget without waitUntil silently dropped the work — the function
  // context died at the 200 return.
  waitUntil(
    enrichAndPersist(payload).catch(err =>
      console.error('[strava-webhook] enrichAndPersist failed', payload.object_id, err)
    )
  )

  return NextResponse.json({ status: 'ok' })
}

// ─── Enrichment pipeline ──────────────────────────────────────────────────────

async function enrichAndPersist(event: StravaEvent) {
  const userId = await resolveUserId(event.owner_id)
  if (!userId) {
    console.warn('[strava-webhook] no user for athlete_id', event.owner_id)
    return
  }

  // Fetch Strava tokens for this user.
  // user_settings uses `id` as PK (referencing auth.users.id) — not `user_id`.
  // Bug fix 2026-04-27: this query previously filtered on user_id, returning
  // null silently and aborting the entire enrichment pipeline.
  const { data: settings } = await getSupabase()
    .from('user_settings')
    .select('strava_refresh_token')
    .eq('id', userId)
    .single() as { data: { strava_refresh_token: string } | null; error: unknown }

  if (!settings?.strava_refresh_token) return

  const { access_token } = await getStravaToken(settings.strava_refresh_token)

  // Fetch full activity detail
  const actRes = await fetch(
    `https://www.strava.com/api/v3/activities/${event.object_id}`,
    { headers: { Authorization: `Bearer ${access_token}` }, cache: 'no-store' }
  )
  if (!actRes.ok) {
    console.error('[strava-webhook] activity fetch failed', event.object_id, actRes.status)
    return
  }
  const activity = await actRes.json()

  // Only process runs
  if (activity.type !== 'Run' && activity.sport_type !== 'Run') return

  // Fetch HR stream and compute zone percentages (raw stream discarded after)
  const hrSummary = await fetchHRStreamSummary(access_token, event.object_id, userId)

  // Upsert into strava_activities
  const { error } = await getSupabase().from('strava_activities').upsert({
    user_id:             userId,
    strava_activity_id:  activity.id,
    activity_type:       activity.type,
    sport_type:          activity.sport_type,
    name:                activity.name,
    start_date:          activity.start_date,
    distance_m:          activity.distance,
    moving_time_s:       activity.moving_time,
    elapsed_time_s:      activity.elapsed_time,
    elevation_gain:      activity.total_elevation_gain,
    avg_hr:              activity.average_heartrate ?? null,
    max_hr:              activity.max_heartrate ?? null,
    avg_speed:           activity.average_speed,
    suffer_score:        activity.suffer_score ?? null,
    hr_in_zone_pct:      hrSummary?.inZonePct    ?? null,
    hr_above_ceiling_pct: hrSummary?.abovePct    ?? null,
    hr_below_floor_pct:  hrSummary?.belowPct     ?? null,
    raw_payload:         event,
    processed_at:        new Date().toISOString(),
  }, { onConflict: 'user_id,strava_activity_id' })

  if (error) {
    console.error('[strava-webhook] upsert failed', error.message)
    return
  }

  // Auto-match to a planned session and trigger analysis
  await triggerAutoAnalysis(userId, activity, event.object_id)
}

async function triggerAutoAnalysis(userId: string, activity: any, stravaActivityId: number) {
  if (activity.type !== 'Run' && activity.sport_type !== 'Run') return

  const { data: planRow } = await getSupabase()
    .from('plans')
    .select('plan_json')
    .eq('user_id', userId)
    .single()

  const plan = planRow?.plan_json
  if (!plan?.weeks?.length) return

  // Dynamically import match logic to avoid edge-runtime issues
  const { findMatchCandidates, autoSelectMatch } = await import('@/lib/coaching/sessionMatch')
  const { getCurrentWeekIndex } = await import('@/lib/plan')

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const week      = plan.weeks[weekIndex]
  if (!week) return

  const activityDate = new Date(activity.start_date)

  // Build flat list of planned sessions with dates
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const weekStartDate = new Date(week.date)

  const plannedSessions = days
    .map((day, idx) => {
      const session = week.sessions[day]
      if (!session) return null
      const sessionDate = new Date(weekStartDate)
      sessionDate.setDate(weekStartDate.getDate() + idx)
      return { session, day, sessionDate }
    })
    .filter(Boolean) as { session: any; day: string; sessionDate: Date }[]

  if (!plannedSessions.length) return

  // Find best match
  const allActivities = [{ ...activity, id: stravaActivityId }]
  const candidates = findMatchCandidates(
    plannedSessions[0].session,  // Pass first session to get nearby activities
    activityDate,
    allActivities,
  )

  // Find which planned session best matches this activity
  let bestDay: string | null = null
  let bestScore = 0

  for (const { session, day, sessionDate } of plannedSessions) {
    const sessionCandidates = findMatchCandidates(session, sessionDate, allActivities)
    const match = autoSelectMatch(sessionCandidates)
    if (match && sessionCandidates[0]?.confidence === 'high') {
      bestDay   = day
      bestScore = 1
      break
    }
    if (sessionCandidates.length && sessionCandidates[0]?.confidence === 'medium' && bestScore === 0) {
      bestDay   = day
    }
  }

  if (!bestDay) return

  // Mark session complete in session_completions so the UI reflects the auto-link immediately
  await getSupabase().from('session_completions').upsert({
    user_id:              userId,
    week_n:               week.n,
    session_day:          bestDay,
    status:               'complete',
    strava_activity_id:   stravaActivityId,
    strava_activity_name: activity.name ?? null,
    strava_activity_km:   activity.distance ? +(activity.distance / 1000).toFixed(1) : null,
    avg_hr:               activity.average_heartrate ?? null,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id,week_n,session_day' })

  // Call analyse-run via internal fetch (includes AI enrichment + push notification)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  try {
    await fetch(`${baseUrl}/api/analyse-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'x-user-id':     userId,
      },
      body: JSON.stringify({
        strava_activity_id: stravaActivityId,
        week_n:             week.n,
        session_day:        bestDay,
      }),
    })
  } catch (err) {
    console.warn('[strava-webhook] auto-analysis failed', err)
  }
}

async function fetchHRStreamSummary(
  accessToken: string,
  activityId: number,
  userId: string,
): Promise<{ inZonePct: number; abovePct: number; belowPct: number } | null> {
  try {
    // Get user's zone boundaries from their current plan
    const { data: planRow } = await getSupabase()
      .from('plans')
      .select('plan_json')
      .eq('user_id', userId)
      .single()

    const zone2Ceiling: number | null = planRow?.plan_json?.meta?.zone2_ceiling ?? null
    const maxHR: number | null        = planRow?.plan_json?.meta?.max_hr ?? null

    const streamRes = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=heartrate,time&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' }
    )
    if (!streamRes.ok) return null

    const streams = await streamRes.json()
    const hrData: number[] = streams?.heartrate?.data
    if (!hrData || !hrData.length) return null

    const ceiling = zone2Ceiling ?? (maxHR ? Math.round(maxHR * 0.76) : null)
    const floor   = maxHR ? Math.round(maxHR * 0.60) : null

    if (!ceiling) return null

    const total   = hrData.length
    const inZone  = hrData.filter(hr => (!floor || hr >= floor) && hr <= ceiling).length
    const above   = hrData.filter(hr => hr > ceiling).length
    const below   = floor ? hrData.filter(hr => hr < floor).length : 0

    return {
      inZonePct:  Math.round((inZone / total) * 100 * 100) / 100,
      abovePct:   Math.round((above  / total) * 100 * 100) / 100,
      belowPct:   Math.round((below  / total) * 100 * 100) / 100,
    }
  } catch (err) {
    console.warn('[strava-webhook] HR stream fetch failed', err)
    return null
  }
}

async function handleActivityDelete(event: StravaEvent) {
  const userId = await resolveUserId(event.owner_id)
  if (!userId) return
  await getSupabase()
    .from('strava_activities')
    .delete()
    .match({ user_id: userId, strava_activity_id: event.object_id })
}

/** Resolves Strava athlete_id → Zona user_id via user_settings. */
async function resolveUserId(stravaAthleteId: number): Promise<string | null> {
  // user_settings PK is `id` (referencing auth.users.id) — not `user_id`.
  // Same bug pattern as the strava_refresh_token query fixed in 991c617.
  const { data } = await getSupabase()
    .from('user_settings')
    .select('id')
    .eq('strava_athlete_id', stravaAthleteId)
    .single() as { data: { id: string } | null; error: unknown }
  return data?.id ?? null
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StravaEvent {
  object_type:  'activity' | 'athlete'
  object_id:    number
  aspect_type:  'create' | 'update' | 'delete'
  owner_id:     number            // Strava athlete ID
  subscription_id: number
  event_time:   number
  updates?:     Record<string, string>
}
