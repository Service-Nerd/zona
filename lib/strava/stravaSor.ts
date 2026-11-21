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
import type { SupabaseClient } from '@supabase/supabase-js'
import { bucketHRHistogram, fetchActivities, fetchHRStreamSummary, fetchStravaActivity, getRuns, getStravaToken, getUserHRZones } from '@/lib/strava'
import { tryEnrichHealthKitRow } from '@/lib/coaching/healthkitConsolidate'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

/** The name `adaptHealthKitWorkout` stores on every Apple Health run (lib/health/adapter.ts; pinned there by
 *  activityTitle.test.ts, which is why it is not imported). */
const HEALTHKIT_RUN_NAME = 'Run'

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
 * A Strava delete. Removes a Strava-source row; on an Apple Health row it reverts the patch, and it nulls the id the
 * merge mirrored onto `run_analysis` and `session_completions`. Every query's error is read and recorded.
 *
 * What the revert restores: the Strava-only fields go back to null, the name to the Apple Health name, and the HR
 * buckets are re-derived from the row's own `hr_bpm_histogram` (Apple Health samples, which the merge never touches)
 * at the runner's CURRENT zones. A row with no histogram had no Apple Health HR, so its buckets return to null.
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
    .select('id, hr_bpm_histogram')
    .match({ user_id: userId, strava_activity_id: stravaActivityId, source: 'apple_health' })
  await failed('read_healthkit_rows', readErr)
  if ((hkRows ?? []).length) {
    const zones = await getUserHRZones(supabase, userId)
    for (const row of hkRows as { id: string; hr_bpm_histogram: Record<string, number> | null }[]) {
      const hr = bucketHRHistogram(row.hr_bpm_histogram, zones)
      const { error } = await supabase.from('strava_activities').update({
        strava_activity_id: null, splits_metric: null, avg_temp_c: null, suffer_score: null,
        name:                 HEALTHKIT_RUN_NAME,
        hr_in_zone_pct:       hr?.inZonePct ?? null,
        hr_above_ceiling_pct: hr?.abovePct ?? null,
        hr_below_floor_pct:   hr?.belowPct ?? null,
        hr_pct_z1:            hr?.histogram.pctZ1 ?? null,
        hr_pct_z2:            hr?.histogram.pctZ2 ?? null,
        hr_pct_z3:            hr?.histogram.pctZ3 ?? null,
        hr_pct_z4_5:          hr?.histogram.pctZ4_5 ?? null,
      }).eq('id', row.id)
      await failed('revert_healthkit_row', error)
    }
  }

  // The mirrors tryEnrichHealthKitRow wrote, on the LIVE rows only, as it wrote them (COMPLETION-TOMBSTONE-01: a
  // superseded row is history and is never written).
  const { error: raErr } = await supabase.from('run_analysis').update({ strava_activity_id: null })
    .match({ user_id: userId, strava_activity_id: stravaActivityId })
    .is('superseded_at', null)
  await failed('clear_run_analysis', raErr)
  const { error: scErr } = await supabase.from('session_completions').update({ strava_activity_id: null })
    .match({ user_id: userId, strava_activity_id: stravaActivityId })
    .is('superseded_at', null)
  await failed('clear_session_completions', scErr)
}

/** Strava activities are listed this far either side of the Apple Health start; the merge itself matches at ±15 min. */
const BACKFILL_LIST_WINDOW_MS = 60 * 60 * 1000

export type BackfillResult = 'no_strava' | 'enriched' | 'no_match' | 'failed'

/**
 * The Strava-first race, closed from the ingest side. When Strava's webhook arrives BEFORE the Apple Health run it is
 * discarded (there is nothing to patch), so the run would never get its Strava detail. A NEW Apple Health row therefore
 * looks for its Strava twin once. Best effort: never throws, and records every outcome but "no Strava".
 */
export async function enrichNewHealthKitRowFromStrava(
  supabase: SupabaseClient | any,
  userId: string,
  startDateIso: string,
): Promise<BackfillResult> {
  try {
    const { data: settings } = await supabase
      .from('user_settings')
      .select('strava_refresh_token')
      .eq('id', userId)
      .maybeSingle()
    if (!settings?.strava_refresh_token) return 'no_strava'

    const { access_token } = await getStravaToken(settings.strava_refresh_token)
    const startMs = new Date(startDateIso).getTime()
    const listed = getRuns(await fetchActivities(access_token,
      new Date(startMs - BACKFILL_LIST_WINDOW_MS).toISOString(),
      new Date(startMs + BACKFILL_LIST_WINDOW_MS).toISOString()))

    for (const summary of listed) {
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
