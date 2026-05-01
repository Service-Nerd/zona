// HealthKit-primary consolidation helper.
//
// When a Strava activity arrives (via manual link or webhook) and the user
// has already had the same workout ingested via HealthKit, we patch the
// existing HK row with Strava-only data instead of inserting a duplicate.
//
// Match criteria: start_date within ±15 min and distance within ±15%. Wide
// enough to absorb HK/Strava clock + GPS-rounding drift, tight enough that
// two genuinely different workouts in the same window won't collide.
//
// On match, we keep `source='apple_health'` (provenance), attach the
// `strava_activity_id`, override HR-bucket fields with Strava's higher-
// fidelity stream summary, and mirror the strava_id onto the existing
// `run_analysis` + `session_completions` rows so downstream queries that
// look up by either ID type stay consistent.

import type { HRStreamSummary } from '@/lib/strava'

interface MatchableStravaActivity {
  id:           number
  start_date:   string
  distance:     number          // metres
  name?:        string | null
  suffer_score?: number | null
}

interface ConsolidateResult {
  enriched: boolean
  /** When `enriched`, the apple_health_uuid of the row we attached to —
   *  callers that want to retrigger analyse-run on the merged data can
   *  use this. */
  appleHealthUuid?: string
}

const MATCH_WINDOW_MS = 15 * 60 * 1000
const DIST_TOLERANCE  = 0.15  // ±15%

/** Try to attach a Strava activity to an existing HealthKit-sourced row.
 *  Returns `{ enriched: false }` when no HK row matches — the caller
 *  should then proceed with their own create-Strava-row flow. */
export async function tryEnrichHealthKitRow(
  supabase: any,
  userId: string,
  activity: MatchableStravaActivity,
  hrSummary: HRStreamSummary | null,
): Promise<ConsolidateResult> {
  const stravaStart = new Date(activity.start_date).getTime()
  const distMin     = activity.distance * (1 - DIST_TOLERANCE)
  const distMax     = activity.distance * (1 + DIST_TOLERANCE)

  const { data: candidates } = await supabase
    .from('strava_activities')
    .select('id, apple_health_uuid, distance_m, strava_activity_id')
    .eq('user_id', userId)
    .eq('source', 'apple_health')
    .gte('start_date', new Date(stravaStart - MATCH_WINDOW_MS).toISOString())
    .lte('start_date', new Date(stravaStart + MATCH_WINDOW_MS).toISOString())
    .order('start_date', { ascending: true })

  // Only match unattached HK rows — if `strava_activity_id` is already set,
  // either we already enriched this row or another Strava activity claimed
  // it. In both cases, fall through and let the caller upsert as Strava.
  const match = (candidates ?? []).find((r: any) =>
    r.distance_m >= distMin && r.distance_m <= distMax && r.strava_activity_id == null
  )
  if (!match) return { enriched: false }

  const patch: Record<string, unknown> = {
    strava_activity_id: activity.id,
    name:               activity.name ?? undefined,
    suffer_score:       activity.suffer_score ?? null,
    processed_at:       new Date().toISOString(),
  }
  if (hrSummary) {
    patch.hr_in_zone_pct       = hrSummary.inZonePct
    patch.hr_above_ceiling_pct = hrSummary.abovePct
    patch.hr_below_floor_pct   = hrSummary.belowPct
  }

  const { error: patchErr } = await supabase
    .from('strava_activities')
    .update(patch)
    .eq('id', match.id)
  if (patchErr) {
    console.error('[healthkit-consolidate] patch failed', patchErr.message)
    return { enriched: false }
  }

  // Mirror strava_id onto downstream rows. Both updates are best-effort —
  // if the rows don't exist yet (analysis still in flight), the next
  // analyse-run upsert will land with the strava_id already on the
  // strava_activities row, so the downstream rows will be consistent.
  await supabase
    .from('run_analysis')
    .update({ strava_activity_id: activity.id })
    .eq('user_id', userId)
    .eq('apple_health_uuid', match.apple_health_uuid)
  await supabase
    .from('session_completions')
    .update({ strava_activity_id: activity.id })
    .eq('user_id', userId)
    .eq('apple_health_uuid', match.apple_health_uuid)

  return { enriched: true, appleHealthUuid: match.apple_health_uuid }
}
