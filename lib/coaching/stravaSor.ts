// STRAVA-WEBHOOK-SOR-01 (founder 2026-11-21: "Apple health is sor for run data"; ADR-011 §3, INV-DATA-008).
//
// The Strava webhook is a SUPPLEMENT. A Strava activity may only patch an Apple Health run that already exists
// (`tryEnrichHealthKitRow`, the single owner of the merge). With no matching Apple Health run it is DISCARDED, never
// stored, and the discard is recorded so it is visible. A Strava delete may only remove a Strava-source row; on an
// Apple Health row it clears the Strava patch, because that row is the runner's system of record.
//
// Before this, an unmatched activity was upserted as `source: 'strava'` and auto-matched (21 rows, 1 runner, newest
// 2026-06-21), and a Strava delete removed the Apple Health row the merge had stamped with the Strava id.
import type { SupabaseClient } from '@supabase/supabase-js'

/** The Strava-only fields the merge patches onto an Apple Health row (healthkitConsolidate). */
const STRAVA_PATCH_FIELDS = { strava_activity_id: null, splits_metric: null, avg_temp_c: null, suffer_score: null } as const

export async function deleteStravaActivity(supabase: SupabaseClient, userId: string, stravaActivityId: number): Promise<void> {
  await supabase.from('strava_activities').delete()
    .match({ user_id: userId, strava_activity_id: stravaActivityId, source: 'strava' })
  await supabase.from('strava_activities').update(STRAVA_PATCH_FIELDS)
    .match({ user_id: userId, strava_activity_id: stravaActivityId, source: 'apple_health' })
}
