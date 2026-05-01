/**
 * Auto-match a freshly-ingested activity to a planned session and trigger the
 * AI run-analysis pipeline. Source-agnostic — both the Strava webhook and the
 * HealthKit ingest route call this with their own source ref.
 *
 * Extracted from app/api/webhooks/strava/route.ts (triggerAutoAnalysis) so the
 * HealthKit path mirrors Strava exactly. The matching, completion write, and
 * analyse-run fetch are identical; only the ID column differs.
 */

export type ActivitySourceRef =
  | { source: 'strava'; stravaActivityId: number }
  | { source: 'apple_health'; appleHealthUuid: string }

/**
 * Activity shape consumed by the matcher. Mirrors the StravaActivity fields
 * `findMatchCandidates` and `autoSelectMatch` already use — both sources
 * marshal into this internal shape before calling.
 */
export interface MatchableActivity {
  id:                  number | string
  type?:               string
  sport_type?:         string
  start_date:          string
  distance:            number     // metres
  moving_time:         number
  elapsed_time:        number
  total_elevation_gain: number
  average_heartrate?:  number
  max_heartrate?:      number
  average_speed?:      number
  name?:               string | null
}

export async function autoMatchAndAnalyse(
  supabase: any,
  userId: string,
  activity: MatchableActivity,
  ref: ActivitySourceRef,
  baseUrl: string,
): Promise<void> {
  if (activity.type !== 'Run' && activity.sport_type !== 'Run') return

  const { data: planRow } = await supabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', userId)
    .single()

  const plan = planRow?.plan_json
  if (!plan?.weeks?.length) return

  const { findMatchCandidates, autoSelectMatch } = await import('@/lib/coaching/sessionMatch')
  const { getCurrentWeekIndex } = await import('@/lib/plan')

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const week      = plan.weeks[weekIndex]
  if (!week) return

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

  // Cast to StravaActivity[] — MatchableActivity is a structural subset, but
  // the matcher's typed signature uses the canonical Strava shape. Both Strava
  // (numeric ID) and HealthKit (UUID string) flow through this matcher; only
  // the matcher's date/distance/HR fields matter for matching.
  const allActivities = [activity] as any

  let bestDay: string | null = null
  let bestScore = 0
  for (const { session, sessionDate, day } of plannedSessions) {
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

  const completionRow: Record<string, unknown> = {
    user_id:              userId,
    week_n:               week.n,
    session_day:          bestDay,
    status:               'complete',
    strava_activity_name: activity.name ?? null,
    strava_activity_km:   activity.distance ? +(activity.distance / 1000).toFixed(1) : null,
    avg_hr:               activity.average_heartrate ?? null,
    updated_at:           new Date().toISOString(),
  }
  if (ref.source === 'strava') {
    completionRow.strava_activity_id = ref.stravaActivityId
  } else {
    completionRow.apple_health_uuid = ref.appleHealthUuid
  }

  await supabase.from('session_completions').upsert(
    completionRow,
    { onConflict: 'user_id,week_n,session_day' }
  )

  const analyseBody: Record<string, unknown> = {
    week_n:      week.n,
    session_day: bestDay,
  }
  if (ref.source === 'strava') {
    analyseBody.strava_activity_id = ref.stravaActivityId
  } else {
    analyseBody.apple_health_uuid = ref.appleHealthUuid
  }

  try {
    await fetch(`${baseUrl}/api/analyse-run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'x-user-id':     userId,
      },
      body: JSON.stringify(analyseBody),
    })
  } catch (err) {
    console.warn('[auto-analyse] analyse-run call failed', err)
  }
}

export function getInternalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
}
