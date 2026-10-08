/**
 * Auto-match a freshly-ingested activity to a planned session and trigger the
 * AI run-analysis pipeline. Source-agnostic — both the Strava webhook and the
 * HealthKit ingest route call this with their own source ref.
 *
 * Extracted from app/api/webhooks/strava/route.ts (triggerAutoAnalysis) so the
 * HealthKit path mirrors Strava exactly. The matching, completion write, and
 * analyse-run fetch are identical; only the ID column differs.
 */

// The only import in this otherwise dependency-free module, and deliberately a
// PURE predicate: `runnerAuthoredTitle` reads two strings and returns a string.
import { runnerAuthoredTitle } from '@/lib/health/activityTitle'

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

  // 🔴 AUTOLINK-OVERRIDE-BLIND-01 (2026-10-07) — THE MATCHER MUST SEE THE WEEK THE
  // RUNNER SEES. This read `week.sessions[day]` straight out of `plan_json` and never
  // consulted `session_overrides`, so a session the runner had MOVED was scored
  // against the day the plan still thought it lived on.
  //
  // Measured on the founder's own run: week 3 `wed → tue`, tempo moved to Tuesday,
  // 9.88 km run on Tue 6 Oct. The matcher scored it against WEDNESDAY, so
  // `sameWeekday` paid 0 of its 40 points. `scoreMatch` needs 70; the session is
  // `quality` (no effort points) and `primary_metric: 'distance'` (no duration
  // points), leaving a CEILING OF 30. Not unlucky — arithmetically impossible.
  //
  // ⚠️ THE GENERAL RULE, which nobody had written down: `sameWeekday` is 40 of the
  // 70, so ANY distance-primary session that is moved can never auto-link. That is
  // 927 of 1,705 sessions (54.4%) across every live plan. A duration-primary easy
  // run can just reach 70 off-day (30 + 30 + 10) if both ratios and HR land, which
  // is why this never looked like a universal failure.
  //
  // ⚠️ `effectiveSessions.ts` IS the owner of this question and had TEN importers —
  // the dashboard, the daily coach note, the daily push, the widget, the plan
  // calendar, the day picker. Everything that SHOWS the runner their week respected
  // the move; the only thing that ACTS on it did not. The two-writer split
  // (`session_overrides` vs `plan_json`) applied to one side.
  const { resolveEffectiveSessions, DAY_KEYS } = await import('@/lib/plan/effectiveSessions')
  const { data: overrideRows } = await supabase
    .from('session_overrides')
    .select('week_n, original_day, new_day')
    .eq('user_id', userId)
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
  const weekOverrides = (overrideRows ?? []).filter((o: any) => o.week_n === week.n)

  const weekStartDate = new Date(week.date)
  const effective = resolveEffectiveSessions(week, weekOverrides)

  // 🔴 MATCH ON THE SLOT, WRITE ON THE ORIGINAL DAY. `session_completions` is keyed
  // `(user_id, week_n, session_day)` on the day the session is DEFINED on, and so are
  // the deep link and the analyse-run payload. Keying the completion to the slot
  // instead would write a row the UI can never find — a silent phantom completion,
  // worse than the defect being fixed. `resolveEffectiveSessions` preserves
  // `originalDay` for exactly this reason.
  const plannedSessions = DAY_KEYS
    .map((slot, idx) => {
      const entry = effective[slot]
      if (!entry) return null
      const sessionDate = new Date(weekStartDate)
      sessionDate.setDate(weekStartDate.getDate() + idx)
      return { session: entry.session, day: entry.originalDay, sessionDate }
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
    // ACTIVITY-NAME-WRITER-01: only a RUNNER-AUTHORED title is copied here. A
    // HealthKit workout has no name, so the adapter's synthesised one ("Run
    // (Connect)") used to be copied onto the completion and rendered on the plan
    // calendar as `● Run (Connect)`. `ref.source` is the test, not the string:
    // 225 of 229 stored HK rows carry a fabricated name and NONE carry a plain
    // 'Run', so sniffing the text would have fixed nothing.
    strava_activity_name: runnerAuthoredTitle(ref.source === 'strava' ? 'strava' : 'apple_health', activity.name),
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
  // Claim the row ATOMICALLY via ON CONFLICT DO NOTHING (the
  // `claim_session_completion` RPC targets the partial live index). Exactly one
  // concurrent ingest inserts and returns `true`; the rest resolve to `false`
  // WITHOUT raising a unique violation — so no benign 23505 reaches the Postgres
  // error log. COMPLETION-CLAIM-NOLOG-01. The bare `.insert()` + catch-23505
  // this replaced was correct but logged an ERROR on every routine auto-link.
  const claimRes = await supabase.rpc('claim_session_completion', { p: completionRow })

  if (claimRes.error) {
    // Unexpected DB error — never push on uncertainty. That part is unchanged.
    //
    // 🔴 COMPLETION-CLAIM-UUID-01: a `console.warn` was the ONLY signal, and it ran
    // twenty times in two minutes on the day this was found while the runner saw
    // nothing. Worse, the 'exists' return below means "already linked" to every
    // caller, so a hard failure and a benign race are the same value. The event is
    // the difference between a silent two-week outage and a question someone can
    // ask of `ops_events`.
    console.warn('[auto-analyse] claimAutoLink claim failed', claimRes.error.message)
    // Imported lazily, like every other dependency in this module: `recordOpsEvent`
    // builds a SERVICE-ROLE client, and `clientBundleBoundary.test.ts` exists
    // because this repo cares which modules can reach a browser bundle.
    const { recordOpsEvent } = await import('@/lib/ops/recordOpsEvent')
    await recordOpsEvent('completion_claim_failed', {
      week_n:      completionRow.week_n ?? null,
      session_day: completionRow.session_day ?? null,
      source:      completionRow.strava_activity_id != null ? 'strava' : 'apple_health',
      message:     String(claimRes.error.message ?? '').slice(0, 500),
    }, (completionRow.user_id as string) ?? null)
    return 'exists'
  }

  if (claimRes.data === true) return 'won'

  // A live row already exists for this session → attach the run onto it.
  {
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
      // COMPLETION-TOMBSTONE-01 — the LIVE row only. A superseded row from the
      // previous plan matches these filters just as well, and attaching a run to
      // it reports 'attached' while the runner sees nothing.
      .is('superseded_at', null)
      .select('week_n')
    const attached = Array.isArray(upd.data) ? upd.data.length > 0 : upd.data != null
    return attached ? 'attached' : 'exists'
  }
}

export function getInternalBaseUrl(): string {
  // GTM-SITE-01 removed NEXT_PUBLIC_APP_URL and made the COMMITTED default
  // `https://www.zonna.run` the single source of truth for the site's own URL
  // across every metadata surface. This helper — the server→server base for the
  // Strava-webhook and HealthKit-ingest calls to /api/analyse-run — was missed,
  // and fell back to the per-deployment VERCEL_URL (which carries Vercel
  // Deployment Protection and is not the canonical host) or localhost. That
  // silently degraded the no-app run-analysis on both ingest paths after
  // 2026-09-10. Aligned here with the same committed default: www in any Vercel
  // environment, localhost only for local dev (where an absolute www URL would
  // wrongly hit production).
  return process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL ? 'https://www.zonna.run' : 'http://localhost:3000')
}
