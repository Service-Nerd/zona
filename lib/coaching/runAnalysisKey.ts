// STRAVA-SOR-REVIEW-FIX-02 — the identity of a run_analysis row is the ACTIVITY ROW's, never the request's.
//
// run_analysis carries two unique keys, (user_id, apple_health_uuid) and (user_id, strava_activity_id), and Postgres
// treats NULLs as distinct. analyse-run used to key its upsert on whichever id the CALLER sent and write only that id,
// so one run analysed once by its Apple Health uuid (link-activity) and once by its Strava id (the post-run RPE save)
// produced two live rows: { uuid, strava: null } and { uuid: null, strava }. The activity row knows both ids, so the
// analysis takes both from it and keys on the Apple Health uuid whenever the run has one (ADR-011: it is the SOR).

/** The activity row analyse-run reads. A Strava id can sit on a legacy Strava-source row as well as the Apple Health
 *  row it was merged onto; the Apple Health row wins, matching `findRowByStravaId`. */
export function pickAnalysisActivity<T extends { source?: string | null; apple_health_uuid?: string | null }>(
  rows: readonly T[] | T | null | undefined,
): T | null {
  if (!rows) return null
  const list = (Array.isArray(rows) ? rows : [rows]) as readonly T[]
  return list.find(r => r.source === 'apple_health' && r.apple_health_uuid) ?? list[0] ?? null
}

export interface RunAnalysisKey {
  apple_health_uuid:  string | null
  strava_activity_id: number | null
  onConflict:         'user_id,apple_health_uuid' | 'user_id,strava_activity_id'
}

/** Both ids from the activity row (the request's id only as a fallback), keyed on the Apple Health uuid when present. */
export function runAnalysisKey(
  activity: { apple_health_uuid?: string | null; strava_activity_id?: number | null },
  request: { apple_health_uuid?: string | null; strava_activity_id?: number | null },
): RunAnalysisKey {
  const apple_health_uuid  = activity.apple_health_uuid ?? request.apple_health_uuid ?? null
  const strava_activity_id = activity.strava_activity_id ?? request.strava_activity_id ?? null
  return {
    apple_health_uuid,
    strava_activity_id,
    onConflict: apple_health_uuid ? 'user_id,apple_health_uuid' : 'user_id,strava_activity_id',
  }
}

/**
 * Upsert one analysis row, so there is one live row per run. When the run has both ids, a LIVE row written before this
 * fix under the Strava id alone is adopted (given the uuid) or, if the uuid already has its own row, removed as the
 * duplicate it is; otherwise the upsert would collide with it on the Strava key. Superseded rows are history and are
 * never touched.
 */
export async function upsertRunAnalysis(
  supabase: any,
  userId: string,
  key: RunAnalysisKey,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  if (key.apple_health_uuid && key.strava_activity_id != null) {
    const { data: strays } = await supabase
      .from('run_analysis')
      .select('id')
      .eq('user_id', userId)
      .eq('strava_activity_id', key.strava_activity_id)
      .is('apple_health_uuid', null)
      .is('superseded_at', null)
    for (const s of (strays ?? []) as { id: string }[]) {
      const { error } = await supabase.from('run_analysis').update({ apple_health_uuid: key.apple_health_uuid }).eq('id', s.id).is('superseded_at', null)
      if (error) await supabase.from('run_analysis').delete().eq('id', s.id).is('superseded_at', null)
    }
  }
  const { error } = await supabase
    .from('run_analysis')
    .upsert({ ...row, apple_health_uuid: key.apple_health_uuid, strava_activity_id: key.strava_activity_id }, { onConflict: key.onConflict })
  return { error: error ?? null }
}
