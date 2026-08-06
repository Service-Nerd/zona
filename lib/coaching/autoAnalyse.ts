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
  const { getWeekIndexForDate } = await import('@/lib/plan')

  // Anchor to the ACTIVITY date, not today. A Sunday-night run ingested
  // Monday morning belongs to last week's plan — using today's week made
  // the matcher silently miss every late-Sunday / early-Monday boundary
  // case. Fixes a recurring "auto-link missed" symptom that the picker
  // backstop was masking.
  const activityDate = new Date(activity.start_date)
  const weekIndex    = getWeekIndexForDate(plan.weeks, activityDate)
  const week         = plan.weeks[weekIndex]
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

  // POST-RUN-01: silent auto-link only at MIN_AUTO_LINK_CONFIDENCE (currently
  // 'high', ≥70 points). Medium candidates are deliberately ignored — wrong
  // link is worse than a picker tap. Activity still lands in `strava_activities`
  // upstream, so the user sees it in the manual picker as fallback.
  // autoSelectMatch() enforces MIN_AUTO_LINK_CONFIDENCE + exactly-one-match;
  // a non-null return already guarantees both constraints.
  let bestDay: string | null = null
  for (const { session, sessionDate, day } of plannedSessions) {
    const sessionCandidates = findMatchCandidates(session, sessionDate, allActivities)
    const match = autoSelectMatch(sessionCandidates)
    if (match) {
      bestDay = day
      break
    }
  }
  if (!bestDay) return

  // The link-time push must fire EXACTLY ONCE per linked run. The same run is
  // frequently ingested more than once concurrently on app-open (foreground JS
  // sync + the HealthKit observer + multiple boot/resume triggers), so the old
  // read-then-write guard raced: every concurrent invocation read "not linked
  // yet" and each sent a push — the "3× notification" bug. We claim the link
  // ATOMICALLY instead: the unique constraint on session_completions
  // (user_id, week_n, session_day) elects exactly one winner. Only the winner
  // pushes; the winner and any fresh-attach also analyse; already-linked /
  // manually-complete / losing calls do nothing.
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

  const claim = await claimAutoLink(supabase, completionRow)
  if (claim === 'exists') return   // already linked / manually complete / a concurrent winner handled it — no push, no re-analysis
  const shouldPush = claim === 'won'  // a fresh attach onto a pre-existing stub analyses but does not push

  // POST-RUN-01 link-time push. Fires immediately on confident auto-link, so
  // the user is brought back BEFORE the LLM round-trip — the wait gets covered
  // by RPE entry inside the Post-Run screen instead of a silent 30s gap.
  // Replaces the older post-analysis push (now removed from /api/analyse-run).
  if (shouldPush) try {
    const { notifyUser }       = await import('@/lib/webpush')
    const { buildLinkPushCopy } = await import('@/lib/coaching/voiceLines')
    // POST-RUN-02: the lock-screen line proves Kit looked (a morsel built from
    // data we already hold at link time — avg HR vs the planned zone) and frames
    // RPE as the runner's half of the read. The body keeps the destination
    // screen's "how did it feel?" header so the tap-through is a continuation,
    // not a new question. Risk-gate reasoning lives in buildLinkPushCopy.
    const matchedSession = week.sessions?.[bestDay] ?? null
    const { title, body } = buildLinkPushCopy(matchedSession, activity.average_heartrate ?? null)
    const url = `/dashboard?screen=post-run&weekN=${week.n}&sessionDay=${bestDay}`
    void notifyUser(userId, { title, body, tag: 'run-linked', data: { url } })
    // Inbox record (NOTIF-01) — mirrors the push so a missed lock-screen ping
    // is still recoverable from the bell.
    const { recordNotification } = await import('@/lib/notifications')
    void recordNotification(userId, { type: 'run_feedback', title, body, url })
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

/**
 * Atomically claim the auto-link so the link-time push fires exactly once.
 *
 * The unique constraint on session_completions (user_id, week_n, session_day)
 * is the arbiter: among concurrent ingests of the same run, exactly one INSERT
 * succeeds. Returns:
 *   'won'      — this call created the completion → caller pushes + analyses.
 *   'attached' — a row existed as a fully-unlinked, non-complete stub and this
 *                call attached the device link → caller analyses but does NOT
 *                push (attaching to a pre-existing row isn't a fresh-run event).
 *   'exists'   — a row already existed and was already linked or manually
 *                complete (or a concurrent winner beat us) → caller does nothing.
 *
 * `completionRow` must include user_id, week_n, session_day and exactly one of
 * strava_activity_id / apple_health_uuid.
 */
export async function claimAutoLink(
  supabase: any,
  completionRow: Record<string, unknown>,
): Promise<'won' | 'attached' | 'exists'> {
  const insertRes = await supabase
    .from('session_completions')
    .insert(completionRow)
    .select('week_n')
    .maybeSingle()

  if (!insertRes.error) return 'won'

  // 23505 = unique_violation → a row already exists for this session.
  if (insertRes.error.code === '23505') {
    const link = completionRow.strava_activity_id != null
      ? { strava_activity_id: completionRow.strava_activity_id }
      : { apple_health_uuid: completionRow.apple_health_uuid }
    // Attach the link onto a fully-unlinked, non-complete stub ONLY. The
    // `.is(... null)` guards skip already-linked rows; `.neq('status',
    // 'complete')` respects a manual completion. `.select()` tells us whether a
    // row was actually attached (→ analyse) vs nothing matched (→ do nothing).
    const upd = await supabase
      .from('session_completions')
      .update({
        ...link,
        status:               'complete',
        strava_activity_name: completionRow.strava_activity_name ?? null,
        strava_activity_km:   completionRow.strava_activity_km ?? null,
        avg_hr:               completionRow.avg_hr ?? null,
        updated_at:           completionRow.updated_at,
      })
      .eq('user_id', completionRow.user_id)
      .eq('week_n', completionRow.week_n)
      .eq('session_day', completionRow.session_day)
      .is('strava_activity_id', null)
      .is('apple_health_uuid', null)
      .neq('status', 'complete')
      .select('week_n')
    const attached = Array.isArray(upd.data) ? upd.data.length > 0 : upd.data != null
    return attached ? 'attached' : 'exists'
  }

  // Unexpected DB error — never push on uncertainty.
  console.warn('[auto-analyse] claimAutoLink insert failed', insertRes.error.message)
  return 'exists'
}

export function getInternalBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
}
