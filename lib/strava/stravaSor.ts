// STRAVA-WEBHOOK-SOR-01 (founder 2026-11-21: "Apple health is sor for run data"; ADR-011 §3, INV-DATA-008).
//
// The Strava webhook is a SUPPLEMENT. A Strava activity may only patch an Apple Health run that already exists
// (`tryEnrichHealthKitRow`, the single owner of the merge). With no matching Apple Health run it is DISCARDED, never
// stored, and the discard is recorded so it is visible. A Strava delete may only remove a Strava-source row; on an
// Apple Health row it clears the Strava patch, because that row is the runner's system of record.
//
// Before this, an unmatched activity was upserted as `source: 'strava'` and auto-matched (21 rows, 1 runner, newest
// 2026-06-21), and a Strava delete removed the Apple Health row the merge had stamped with the Strava id.
//
// STRAVA-SOR-REVIEW-FIX-01 (code review, 2026-11-21): this module also owns the two lookups the review found missing.
// `findRowByStravaId` tells "already patched" from "no match", so a duplicate webhook event or a re-link is not
// recorded as a discard; `enrichNewHealthKitRowFromStrava` closes the Strava-first race from the ingest side.
//
// STRAVA-SOR-REVIEW-FIX-02 (second review round): the backfill is bounded (recent runs only, one per runner per
// interval, no detail fetch for an id already attached) and re-scores an analysis that already exists; the delete
// repoints the completion to its Apple Health run, and the row revert lives with the merge in healthkitConsolidate.ts.
import type { SupabaseClient } from '@supabase/supabase-js'
import { bucketHRHistogram, fetchActivities, fetchHRStreamSummary, fetchStravaActivity, getRuns, getStravaToken, getUserHRZones } from '@/lib/strava'
import { revertHealthKitEnrichment, tryEnrichHealthKitRow } from '@/lib/coaching/healthkitConsolidate'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { checkRateLimit } from '@/lib/security/rateLimit'
import { getInternalBaseUrl } from '@/lib/coaching/autoAnalyse'
import { AI_LIMITS } from '@/lib/ai/limits'

/**
 * STRAVA-SOR-REVIEW-FIX-02 — the backfill's bounds. Limits on how often we call Strava, not coaching numerics, so they
 * are not in GENERATION_CONFIG: they never change what a runner is prescribed.
 *  - RECENT_WINDOW_MS: only a run that STARTED this recently looks for its Strava twin. The race it closes is minutes
 *    wide, while a first sync posts up to 30 days of runs, and each used to cost a list call plus a detail and a stream
 *    call per listed activity, against Strava's per-app rate limit that every runner shares.
 *  - LIST_WINDOW_MS: Strava is listed this far either side of the Apple Health start (the merge matches at ±15 min).
 *  - PER_USER_*: at most one backfill per runner per interval, so a sync that posts several recent runs costs one.
 */
export const STRAVA_BACKFILL = {
  RECENT_WINDOW_MS:        6 * 60 * 60 * 1000,
  LIST_WINDOW_MS:          60 * 60 * 1000,
  PER_USER_LIMIT:          1,
  PER_USER_WINDOW_SECONDS: 300,
} as const

/** The row a Strava id is already attached to, preferring the Apple Health one. `null` when none carries it. */
export async function findRowByStravaId(
  supabase: SupabaseClient | any,
  userId: string,
  stravaActivityId: number,
): Promise<{ source: string; apple_health_uuid: string | null } | null> {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('source, apple_health_uuid')
    .eq('user_id', userId)
    .eq('strava_activity_id', stravaActivityId)
  if (error) console.error('[strava-sor] row-by-strava-id read failed', error.message)
  const rows = (data ?? []) as { source: string; apple_health_uuid: string | null }[]
  return rows.find(r => r.source === 'apple_health' && r.apple_health_uuid) ?? rows[0] ?? null
}

/**
 * A Strava delete. Removes a Strava-source row; on an Apple Health row it reverts the patch
 * (`revertHealthKitEnrichment`), nulls the id the merge mirrored onto `run_analysis`, and repoints the completion to the
 * Apple Health run. Every query's error is read and recorded.
 *
 * The HR buckets are re-derived from the row's own `hr_bpm_histogram` (Apple Health samples, which the merge never
 * touches) at the runner's CURRENT zones. A row with no histogram had no Apple Health HR, so its buckets return to null.
 */
export async function deleteStravaActivity(supabase: SupabaseClient | any, userId: string, stravaActivityId: number): Promise<void> {
  const failed = async (stage: string, error: { message: string } | null | undefined) => {
    if (!error) return
    console.error(`[strava-sor] delete ${stage} failed`, error.message)
    await recordOpsEvent('strava_sor_write_failed', { stage, strava_activity_id: stravaActivityId, message: error.message.slice(0, 500) }, userId)
  }

  const { error: delErr } = await supabase.from('strava_activities').delete()
    .match({ user_id: userId, strava_activity_id: stravaActivityId, source: 'strava' })
  await failed('delete_strava_row', delErr)

  const { data: hkRows, error: readErr } = await supabase.from('strava_activities')
    .select('id, apple_health_uuid, hr_bpm_histogram')
    .match({ user_id: userId, strava_activity_id: stravaActivityId, source: 'apple_health' })
  await failed('read_healthkit_rows', readErr)
  const rows = (hkRows ?? []) as { id: string; apple_health_uuid: string | null; hr_bpm_histogram: Record<string, number> | null }[]
  if (rows.length) {
    const zones = await getUserHRZones(supabase, userId)
    for (const row of rows) {
      // STRAVA-SOR-REVIEW-FIX-02 — the revert is the merge's inverse, so it lives with the merge (INV-DATA-008).
      const { error } = await revertHealthKitEnrichment(supabase, row.id, bucketHRHistogram(row.hr_bpm_histogram, zones))
      await failed('revert_healthkit_row', error)
    }
  }

  // The mirrors tryEnrichHealthKitRow wrote, on the LIVE rows only, as it wrote them (COMPLETION-TOMBSTONE-01: a
  // superseded row is history and is never written).
  const { error: raErr } = await supabase.from('run_analysis').update({ strava_activity_id: null })
    .match({ user_id: userId, strava_activity_id: stravaActivityId })
    .is('superseded_at', null)
  await failed('clear_run_analysis', raErr)

  // STRAVA-SOR-REVIEW-FIX-02 — the completion keeps its run. One linked from the Strava picker carried the Strava id and
  // no uuid, so nulling the id left it linked to nothing while its Apple Health run was still there. It is repointed to
  // the row the id was merged onto (one, by construction: the merge only patches an unattached row). If that collides
  // with another live completion on the same run, the collision is recorded and the id is still cleared.
  const hkUuid = rows.length === 1 ? rows[0].apple_health_uuid : null
  const clearCompletions = (patch: Record<string, unknown>) => supabase.from('session_completions').update(patch)
    .match({ user_id: userId, strava_activity_id: stravaActivityId })
    .is('superseded_at', null)
  if (hkUuid) {
    const { error } = await clearCompletions({ strava_activity_id: null, apple_health_uuid: hkUuid })
    if (!error) return
    await failed('repoint_session_completions', error)
  }
  const { error: scErr } = await clearCompletions({ strava_activity_id: null })
  await failed('clear_session_completions', scErr)
}

export type BackfillResult = 'no_strava' | 'not_recent' | 'rate_limited' | 'enriched' | 'no_match' | 'failed'

export interface BackfillOptions {
  /** Paid analysis is allowed (`activity_intelligence`). Gates the re-score, never the patch. */
  canAnalyse: boolean
  now?:       Date
  fetcher?:   typeof fetch
}

/**
 * The Strava-first race, closed from the ingest side. When Strava's webhook arrives BEFORE the Apple Health run it is
 * discarded (there is nothing to patch), so the run would never get its Strava detail. A NEW, RECENT Apple Health row
 * therefore looks for its Strava twin once. Best effort: never throws, and records every outcome but "no Strava" and
 * "not recent".
 *
 * Cost, in order (STRAVA-SOR-REVIEW-FIX-02): a run older than `RECENT_WINDOW_MS` costs nothing; a runner with no Strava
 * costs one settings read; a runner already backfilled this interval costs one limiter call; otherwise one list call,
 * and a detail + stream call only for a listed id that no row carries yet.
 */
export async function enrichNewHealthKitRowFromStrava(
  supabase: SupabaseClient | any,
  userId: string,
  startDateIso: string,
  opts: BackfillOptions,
): Promise<BackfillResult> {
  const startMs = new Date(startDateIso).getTime()
  const nowMs = (opts.now ?? new Date()).getTime()
  if (!Number.isFinite(startMs) || nowMs - startMs > STRAVA_BACKFILL.RECENT_WINDOW_MS) return 'not_recent'
  try {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('strava_refresh_token')
      .eq('id', userId)
      .maybeSingle()
    if (!settings?.strava_refresh_token) return 'no_strava'

    if (!await checkRateLimit(`strava:backfill:${userId}`, STRAVA_BACKFILL.PER_USER_LIMIT, STRAVA_BACKFILL.PER_USER_WINDOW_SECONDS)) {
      await recordOpsEvent('strava_healthkit_backfill', { result: 'rate_limited' }, userId)
      return 'rate_limited'
    }

    const { access_token } = await getStravaToken(settings.strava_refresh_token)
    const listed = getRuns(await fetchActivities(access_token,
      new Date(startMs - STRAVA_BACKFILL.LIST_WINDOW_MS).toISOString(),
      new Date(startMs + STRAVA_BACKFILL.LIST_WINDOW_MS).toISOString()))

    for (const summary of listed) {
      // Already on a row (the webhook won after all, or another run claimed it): no detail or stream fetch.
      if (await findRowByStravaId(supabase, userId, summary.id as number)) continue
      const { activity } = await fetchStravaActivity(access_token, summary.id as number)
      if (!activity) continue
      const hrSummary = await fetchHRStreamSummary(supabase, access_token, activity.id, userId)
      const r = await tryEnrichHealthKitRow(supabase, userId, {
        id:            activity.id,
        start_date:    activity.start_date,
        distance:      activity.distance,
        name:          activity.name,
        suffer_score:  activity.suffer_score ?? null,
        average_temp:  activity.average_temp ?? null,
        splits_metric: activity.splits_metric ?? null,
      }, hrSummary)
      if (r.enriched) {
        await recordOpsEvent('strava_healthkit_backfill', { result: 'enriched', strava_activity_id: activity.id, apple_health_uuid: r.appleHealthUuid }, userId)
        if (opts.canAnalyse && r.appleHealthUuid) await rescoreExistingAnalysis(supabase, userId, r.appleHealthUuid, opts.fetcher ?? fetch)
        return 'enriched'
      }
    }
    await recordOpsEvent('strava_healthkit_backfill', { result: 'no_match', listed: listed.length }, userId)
    return 'no_match'
  } catch (err) {
    await recordOpsEvent('strava_healthkit_backfill', { result: 'failed', message: String((err as Error)?.message ?? err).slice(0, 500) }, userId)
    return 'failed'
  }
}

/**
 * STRAVA-SOR-REVIEW-FIX-02 — the patch changes the run's HR buckets after it may already have been analysed (the
 * ingest's own auto-match runs alongside the backfill). When a live analysis exists it is re-scored: `scores_only`
 * recomputes the numbers and leaves the coach note untouched (HR-LATE-RESCORE-01). With none, the analysis still to come
 * reads the patched row. Best effort.
 */
async function rescoreExistingAnalysis(supabase: any, userId: string, appleHealthUuid: string, fetcher: typeof fetch): Promise<void> {
  const { data: existing } = await supabase
    .from('run_analysis')
    .select('week_n, session_day')
    .eq('user_id', userId)
    .eq('apple_health_uuid', appleHealthUuid)
    .is('superseded_at', null)
    .maybeSingle()
  if (!existing) return
  try {
    await fetcher(`${getInternalBaseUrl()}/api/analyse-run`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY!,
        'x-user-id':     userId,
      },
      body: JSON.stringify({ apple_health_uuid: appleHealthUuid, week_n: existing.week_n, session_day: existing.session_day, scores_only: true }),
      // AI-ROUTE-HTTP-HOP-CEILING-01 — bound the hop.
      signal: AbortSignal.timeout(AI_LIMITS.HOP_TIMEOUT_MS),
    })
  } catch (err) {
    console.error('[strava-sor] backfill re-score failed', err)
  }
}
