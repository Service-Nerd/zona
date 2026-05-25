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

  // POST-RUN-01: silent auto-link only at high confidence (≥70). Medium
  // candidates are deliberately ignored — wrong link is worse than a picker
  // tap. Activity still lands in `strava_activities` upstream, so the user
  // sees it in the manual picker as fallback.
  let bestDay: string | null = null
  for (const { session, sessionDate, day } of plannedSessions) {
    const sessionCandidates = findMatchCandidates(session, sessionDate, allActivities)
    const match = autoSelectMatch(sessionCandidates)
    if (match && sessionCandidates[0]?.confidence === 'high') {
      bestDay = day
      break
    }
  }
  if (!bestDay) return

  // POST-RUN-01 race-condition guard: never clobber an existing user-manual
  // link, and never re-fire push/analyse for an activity we've already linked.
  const { data: existing } = await supabase
    .from('session_completions')
    .select('strava_activity_id, apple_health_uuid')
    .eq('user_id', userId)
    .eq('week_n', week.n)
    .eq('session_day', bestDay)
    .maybeSingle()

  if (existing) {
    const existingRef: number | string | null =
      existing.strava_activity_id ?? existing.apple_health_uuid ?? null
    if (existingRef != null) {
      // Either same activity (idempotent) or a different user-chosen link
      // (don't overwrite). Either way: this auto-flow is done.
      return
    }
  }

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

  // POST-RUN-01 link-time push. Fires immediately on confident auto-link, so
  // the user is brought back BEFORE the LLM round-trip — the wait gets covered
  // by RPE entry inside the Post-Run screen instead of a silent 30s gap.
  // Replaces the older post-analysis push (now removed from /api/analyse-run).
  try {
    const { notifyUser } = await import('@/lib/webpush')
    const distKm = activity.distance / 1000
    const distLabel = distKm > 0
      ? (distKm < 10 ? `${distKm.toFixed(1)}K` : `${Math.round(distKm)}K`)
      : 'your run'
    const dayNames: Record<string, string> = {
      mon: 'Monday',  tue: 'Tuesday',  wed: 'Wednesday',
      thu: 'Thursday', fri: 'Friday',   sat: 'Saturday',  sun: 'Sunday',
    }
    const dayName = dayNames[bestDay] ?? bestDay
    // POST-RUN-02: title carries the *what* (so the lock-screen preview reads
    // as the run, not a process step); body mirrors the destination screen's
    // own "How did it feel?" header so the tap-through is a continuation, not
    // a new question.
    const title = distKm > 0
      ? `${dayName}'s ${distLabel}.`
      : `${dayName}'s run.`
    const url = `/dashboard?screen=post-run&weekN=${week.n}&sessionDay=${bestDay}`
    void notifyUser(userId, {
      title,
      body:  'How did it feel?',
      tag:   'run-linked',
      data:  { url },
    })
    // Inbox record (NOTIF-01) — mirrors the push so a missed lock-screen ping
    // is still recoverable from the bell.
    const { recordNotification } = await import('@/lib/notifications')
    void recordNotification(userId, { type: 'run_feedback', title, body: 'How did it feel?', url })
  } catch (err) {
    console.warn('[auto-analyse] link push failed', err)
  }

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
