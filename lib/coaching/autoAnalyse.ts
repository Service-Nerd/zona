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
import { AI_LIMITS } from '@/lib/ai/limits'
import { readPlanJson } from '@/lib/plan'
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

/**
 * ACT-RUNREAD-REACH-01 — every wall a run can hit between landing and being READ.
 *
 * 🔴 WHY A VOCABULARY AND NOT FOUR STRING LITERALS. This module has four early returns and
 * the ingest route has a fifth, and all five were silent on both sides: the runner watches
 * the run appear and never gets a read, and we could not say which one stopped it. The
 * reasons are listed here so the recorder, the caller's tier-gate branch and the gate all
 * name the same five things.
 *
 * ⚠️ `tier_gated` is recorded by the CALLER, not here — `/api/health/ingest` wraps this
 * whole function in `if (canAnalyse)` (HK-FREE-INGEST-LINE-01), so a free runner's run never
 * reaches this code at all. A reason that lives outside the function it describes is exactly
 * the kind that goes uncounted, which is why it is in this list rather than in that route.
 */
export const RUN_UNMATCHED_REASONS = {
  no_plan:             'the runner had no plan at all when the run arrived',
  plan_read_failed:    'the plan read itself failed, so whether they had one is unknown',
  outside_plan_weeks:  'the run date is not inside the 7-day window of the week it resolved to',
  week_has_no_sessions: 'the week the run resolved to carries no session at all, after overrides',
  below_threshold:     'a session was there and no candidate reached the auto-link score',
  tier_gated:          'free tier: the row lands, the read does not (recorded by the caller)',
} as const

export type RunUnmatchedReason = keyof typeof RUN_UNMATCHED_REASONS

/**
 * Record why a run produced no read. Never throws and never blocks the path it watches —
 * `recordOpsEvent` already guarantees both, and this is awaited only so the row lands before
 * the function returns.
 *
 * ⚠️ SERVER ONLY, like `recordOpsEvent` itself. Both real callers of
 * `autoMatchAndAnalyse` are API routes; `lib/health/observer.ts` only NAMES this module in a
 * comment, which `grep -rl` reports identically to an import. Checked, not assumed.
 */
export async function noteRunUnmatched(
  userId: string,
  reason: RunUnmatchedReason,
  ref: ActivitySourceRef,
  activityStart: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const { recordOpsEvent } = await import('@/lib/ops/recordOpsEvent')
  await recordOpsEvent('run_unmatched', {
    reason,
    source: ref.source,
    // 🔴 ONE ROW PER INGEST ATTEMPT, NOT PER RUN, SO THE ID HAS TO BE HERE. `clientSync`
    // re-posts recent workouts on every sweep and the route documents concurrent app-open
    // ingests, so the same unread run is recorded again and again — `count(*)` would report
    // sweeps, not runs. The link-time push got an atomic one-winner claim for exactly this
    // hazard; telemetry cannot take a write lock, so it carries the id instead and
    // `v_activation_funnel.unmatched_runs` counts DISTINCT.
    activity_id: ref.source === 'strava' ? String(ref.stravaActivityId) : ref.appleHealthUuid,
    // The DATE, never the time: it is enough to join a run back to a plan week and carries
    // less about the runner's day than a timestamp would.
    activity_date: activityStart.slice(0, 10),
    ...extra,
  }, userId)
}

export async function autoMatchAndAnalyse(
  supabase: any,
  userId: string,
  activity: MatchableActivity,
  ref: ActivitySourceRef,
  baseUrl: string,
): Promise<void> {
  // ⚠️ NOT RECORDED. A walk or a ride is not a run that failed to be read; counting it would
  // bury the four reasons that matter under the ones that are not failures at all.
  if (activity.type !== 'Run' && activity.sport_type !== 'Run') return

  const { plan: planRowPlan, error: planRowError } = await readPlanJson(supabase, userId)
  // PLANS-SINGLE-NOT-MAYBE-01 — this read is optional here, so a failure carries on as it did; it is now logged.
  if (planRowError) console.error('[lib/coaching/autoAnalyse.ts] plan read failed:', planRowError)

  const plan = planRowPlan
  if (!plan?.weeks?.length) {
    // ⚠️ A FAILED READ IS NOT "NO PLAN", AND no_plan IS THE 53.1% BUCKET. `readPlanJson`
    // returns `{ plan: null, error }` for a genuine database failure as well as for a runner
    // who has not generated one, and folding the two together would quietly pad the largest
    // reason with our own outages — unrecoverably, since the error is not carried.
    await noteRunUnmatched(userId, planRowError ? 'plan_read_failed' : 'no_plan',
      ref, activity.start_date, planRowError ? { message: String(planRowError).slice(0, 200) } : {})
    return
  }

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
  // 🔴 THIS GUARD IS UNREACHABLE, AND FINDING THAT OUT IS WHY `outside_plan_weeks` IS DECIDED
  // BELOW INSTEAD OF HERE. `getWeekIndexForDate` NEVER returns -1: it falls back to the nearest
  // PAST week, else week 0 (`lib/plan/weekResolution.ts:82-87`). So `plan.weeks[weekIndex]` is
  // always defined once `weeks.length > 0`, which the check above already guaranteed — and a run
  // from outside the plan's calendar is quietly scored against the nearest past week rather than
  // rejected. `isDateWithinWeek` exists for exactly this distinction and its own doc comment says
  // so: *"callers can't otherwise tell 'genuinely inside this week' from 'pinned to the final week
  // because the plan is over'"*. Nothing here had used it.
  // ⚠️ THE BEHAVIOUR IS DELIBERATELY UNCHANGED. This item records WHY a run went unread; the
  // item's own scope note puts changing what can match out of bounds. The fallback match is
  // narrow in practice (`findMatchCandidates` filters to ±2 days of the session date), so what it
  // mostly produces is a run reported as `below_threshold` when the truth is that it was never in
  // the plan — a reason that misdescribes its cause. That is what the split below fixes.
  if (!week) return
  const { isDateWithinWeek } = await import('@/lib/plan/weekResolution')
  const withinWeek = isDateWithinWeek(week, activityDate)

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
  const { resolveEffectiveDay, DAY_KEYS, SESSION_OVERRIDE_COLUMNS } = await import('@/lib/plan/effectiveSessions')
  const { data: overrideRows } = await supabase
    .from('session_overrides')
    .select(SESSION_OVERRIDE_COLUMNS)
    .eq('user_id', userId)
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
  const weekOverrides = (overrideRows ?? []).filter((o: any) => o.week_n === week.n)

  const weekStartDate = new Date(week.date)
  const effective = resolveEffectiveDay(week, weekOverrides)

  // 🔴 MATCH ON THE SLOT, WRITE ON THE ORIGINAL DAY. `session_completions` is keyed
  // `(user_id, week_n, session_day)` on the day the session is DEFINED on, and so are
  // the deep link and the analyse-run payload. Keying the completion to the slot
  // instead would write a row the UI can never find — a silent phantom completion,
  // worse than the defect being fixed. `resolveEffectiveSessions` preserves
  // `originalDay` for exactly this reason.
  // SESSION-SLOTS-01 — every session on every day, AM before PM. A double holds two sessions on one
  // date, and the first match used to win and `break`, so the day's second run met the morning's claim
  // (`'exists'`) and never linked. A session already completed is skipped, so the next run of the day
  // links to the next session. (The server holds a UTC start, not a local time of day: ORDER is the
  // signal, and runs arrive in order.)
  const { data: doneRows } = await supabase
    .from('session_completions').select('session_day, status')
    .eq('user_id', userId).eq('week_n', week.n).is('superseded_at', null)
  const done = new Set<string>((doneRows ?? []).filter((r: any) => r.status === 'complete').map((r: any) => r.session_day))
  const plannedSessions = plannedSessionsForMatch(effective, weekStartDate, done, DAY_KEYS)

  if (!plannedSessions.length) {
    // ⚠️ THE SAME SPLIT AS THE SCORE RETURN BELOW, and leaving it out mislabelled the
    // commonest post-plan case: a run after the plan ends is pinned to the final week, and if
    // that week is empty it would read as "that week has no session" when the truth is the run
    // was never in the plan. `last_unmatched_reason` surfaces only `reason`, so a `within_week`
    // flag in the detail could not have corrected it downstream.
    await noteRunUnmatched(userId, withinWeek ? 'week_has_no_sessions' : 'outside_plan_weeks',
      ref, activity.start_date, { week_n: week.n, within_week: withinWeek })
    return
  }

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
  if (!bestDay) {
    // ⚠️ TWO DIFFERENT FAILURES ARRIVE AT THE SAME `return`, and reporting them as one would
    // make the commonest cause invisible. If the run is not inside the resolved week's own
    // 7-day window it was never in the plan — `below_threshold` would blame the matcher for a
    // run it should never have been given. Otherwise a session really was sitting there:
    // `sameWeekday` is 40 of the 70 points `autoSelectMatch` needs, so that is usually a run on
    // a day the plan did not expect, or one whose distance or duration missed its band.
    await noteRunUnmatched(userId, withinWeek ? 'below_threshold' : 'outside_plan_weeks',
      ref, activity.start_date, { week_n: week.n, candidates: plannedSessions.length })
    return
  }

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
    // PLANS-SINGLE-NOT-MAYBE-01 — the plan is now TYPED (it was `any`), which surfaced this
    // string index. Narrowed, not cast away: the day keys are the ones the match produced.
    const matchedSession = week.sessions?.[bestDay as keyof NonNullable<typeof week.sessions>] ?? null
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
      // AI-ROUTE-HTTP-HOP-CEILING-01 — bound the hop, or the CALLER is what dies.
      signal: AbortSignal.timeout(AI_LIMITS.HOP_TIMEOUT_MS),
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
/**
 * COMPLETION-ACTIVITY-DUPE-01 — "this run is already linked to another session".
 *
 * Matched on the INDEX NAME, not on the message text: `session_completions_live_key`
 * (the week/day key) is a different situation with a different answer, and a substring
 * test for "duplicate key" cannot tell them apart.
 */
function isActivityAlreadyLinked(err: { code?: string; message?: string; details?: string } | null): boolean {
  if (!err || err.code !== '23505') return false
  return /session_completions_live_(hk_uuid|strava_id)_key/.test(`${err.message ?? ''} ${err.details ?? ''}`)
}

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
    // COMPLETION-ACTIVITY-DUPE-01 (2026-11-04) — ONE OF THESE IS NOT A FAILURE.
    //
    // The RPC's `ON CONFLICT (user_id, week_n, session_day) DO NOTHING` absorbs a
    // collision on the LIVE-KEY index and returns false. It cannot absorb a violation
    // of a DIFFERENT index, and the activity-uniqueness indexes added by migration
    // 20261104 are different indexes. So a re-ingest of an activity already linked to
    // ANOTHER day — the ordinary case that migration exists to prevent — now raises
    // 23505 here, and without this arm it would fire `completion_claim_failed` on
    // every one of them. That event exists precisely to separate a hard outage from a
    // benign race (COMPLETION-CLAIM-UUID-01); drowning it is how it stops being read.
    //
    // The run is already recorded against a session. 'exists' is the honest answer and
    // the caller's behaviour is already correct for it: do not analyse, do not push.
    if (isActivityAlreadyLinked(claimRes.error)) return 'exists'

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
    // The same indexes bind here: this `.update()` writes the activity id onto a row,
    // and the id may already sit on another live row. `upd.error` was never read, so
    // a violation fell through `upd.data == null` and returned 'exists' with no log
    // and no event at all — the discarded-`{ error }` class this wave is about.
    if (upd.error) {
      if (!isActivityAlreadyLinked(upd.error)) {
        console.warn('[auto-analyse] claimAutoLink attach failed', upd.error.message)
        const { recordOpsEvent } = await import('@/lib/ops/recordOpsEvent')
        await recordOpsEvent('completion_claim_failed', {
          week_n:      completionRow.week_n ?? null,
          session_day: completionRow.session_day ?? null,
          source:      completionRow.strava_activity_id != null ? 'strava' : 'apple_health',
          stage:       'attach',
          message:     String(upd.error.message ?? '').slice(0, 500),
        }, (completionRow.user_id as string) ?? null)
      }
      return 'exists'
    }
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

/**
 * SESSION-SLOTS-01 — the sessions an incoming run may link to, in match order: every session of every
 * day, AM before PM. On a double day a session already completed is left out, so the day's second run
 * links to the day's second session instead of meeting the first one's claim. Single days are
 * unchanged (a completed single still goes through `claimAutoLink`, which respects it).
 */
export function plannedSessionsForMatch<S>(
  effective: Partial<Record<string, { session: S; originalDay: string }[]>>,
  weekStartDate: Date,
  done: ReadonlySet<string>,
  dayKeys: readonly string[],
): { session: S; day: string; sessionDate: Date }[] {
  return dayKeys.flatMap((slot, idx) => {
    const list = effective[slot] ?? []
    return list
      .filter(entry => !(list.length > 1 && done.has(entry.originalDay)))
      .map(entry => {
        const sessionDate = new Date(weekStartDate)
        sessionDate.setDate(weekStartDate.getDate() + idx)
        return { session: entry.session, day: entry.originalDay, sessionDate }
      })
  })
}
