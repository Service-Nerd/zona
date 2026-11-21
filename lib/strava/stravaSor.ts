// STRAVA-WEBHOOK-SOR-01 (founder 2026-11-21: "Apple health is sor for run data"; ADR-011 §3, INV-DATA-008).
//
// The Strava webhook is a SUPPLEMENT. A Strava activity may only patch an Apple Health run that already exists
// (`tryEnrichHealthKitRow`, the single owner of the merge). With no matching Apple Health run it is DISCARDED, never
// stored, and the discard is recorded so it is visible. A Strava delete may only remove a Strava-source row; on an
// Apple Health row it reverts the Strava patch, because that row is the runner's system of record.
//
// Before this, an unmatched activity was upserted as `source: 'strava'` and auto-matched (21 rows, 1 runner, newest
// 2026-06-21), and a Strava delete removed the Apple Health row the merge had stamped with the Strava id.
//
// STRAVA-SOR-REVIEW-FIX-03 (code review, 2026-11-21): `findRowByStravaId` tells "already patched" from "no match", so a
// duplicate webhook event is not recorded as a discard; the delete reads and records every query's error, and the row
// revert lives with the merge (`revertHealthKitEnrichment`). Deliberately NOT here: any backfill on Apple Health ingest,
// any write to run_analysis or session_completions, any client clean-up of a refused link, and any HR re-derivation.
// All were tried and trimmed after review (see the build-log).
import type { SupabaseClient } from '@supabase/supabase-js'
import { revertHealthKitEnrichment } from '@/lib/coaching/healthkitConsolidate'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

/** The row a Strava id is already attached to, preferring the Apple Health one. `null` when none carries it;
 *  `'unknown'` when the read failed, so a caller never mistakes a failed read for "not attached". */
export async function findRowByStravaId(
  supabase: SupabaseClient | any,
  userId: string,
  stravaActivityId: number,
): Promise<{ source: string; apple_health_uuid: string | null } | null | 'unknown'> {
  const { data, error } = await supabase
    .from('strava_activities')
    .select('source, apple_health_uuid')
    .eq('user_id', userId)
    .eq('strava_activity_id', stravaActivityId)
  if (error) { console.error('[strava-sor] row-by-strava-id read failed', error.message); return 'unknown' }
  const rows = (data ?? []) as { source: string; apple_health_uuid: string | null }[]
  return rows.find(r => r.source === 'apple_health' && r.apple_health_uuid) ?? rows[0] ?? null
}

/**
 * A Strava delete. Removes a Strava-source row only; on an Apple Health row it reverts the Strava-only fields
 * (`revertHealthKitEnrichment`) and leaves the HR data alone. Every query's error is read and recorded.
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
    .select('id')
    .match({ user_id: userId, strava_activity_id: stravaActivityId, source: 'apple_health' })
  await failed('read_healthkit_rows', readErr)
  for (const row of (hkRows ?? []) as { id: string }[]) {
    const { error } = await revertHealthKitEnrichment(supabase, row.id)
    await failed('revert_healthkit_row', error)
  }
}
