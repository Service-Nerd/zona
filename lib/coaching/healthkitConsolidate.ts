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
// fidelity stream summary, patch the two Strava-only supplement fields
// HealthKit can't provide (`avg_temp_c`, `splits_metric` — ADR-011 §3), and
// mirror the strava_id onto the existing `run_analysis` +
// `session_completions` rows so downstream queries that look up by either ID
// type stay consistent.

import type { HRStreamSummary } from '@/lib/strava'
import { decideLateArrival } from './lateArrivalGate'

interface MatchableStravaActivity {
  id:           number
  start_date:   string
  distance:     number          // metres
  name?:        string | null
  suffer_score?: number | null
  // Strava-only supplement fields HealthKit never carries (ADR-011 §3). Patched
  // onto the canonical HK row on enrich; null when Strava didn't report them.
  average_temp?:  number | null
  splits_metric?: unknown
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
    // Supplement HealthKit with the two fields it can't provide. Safe against
    // overwrite: enrich only ever fires on an unattached HK row (strava_activity_id
    // null match above), so it never clobbers a previously-patched value.
    avg_temp_c:         activity.average_temp ?? null,
    splits_metric:      activity.splits_metric ?? null,
    processed_at:       new Date().toISOString(),
  }
  if (hrSummary) {
    patch.hr_in_zone_pct       = hrSummary.inZonePct
    patch.hr_above_ceiling_pct = hrSummary.abovePct
    patch.hr_below_floor_pct   = hrSummary.belowPct
    patch.hr_pct_z1            = hrSummary.histogram.pctZ1
    patch.hr_pct_z2            = hrSummary.histogram.pctZ2
    patch.hr_pct_z3            = hrSummary.histogram.pctZ3
    patch.hr_pct_z4_5          = hrSummary.histogram.pctZ4_5
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

// ─── INGEST-DEDUP-01: HealthKit-side consolidation ──────────────────────────
//
// The reverse of tryEnrichHealthKitRow. That helper covers "HK row exists, then
// Strava arrives". This covers the two cases that were creating duplicates:
//   (A) an HK workout arrives when a matching Strava row already exists, and
//   (B) the same physical run reaches HealthKit twice via two apps (e.g. the
//       Strava app + Garmin Connect), each a distinct apple_health_uuid.
// In both, the incoming HK row is the one we suppress — so there are NO deletes
// and NO FK re-pointing: the existing row stays canonical and keeps its
// completion/analysis links. If the canonical row lacks an HR zone summary and
// the incoming HK row has one, we lift it across first (the "prefer the HR
// source" half of the rule).
//
// TIGHTER window than the enrich path above (±5 min / ±5% vs ±15 / ±15%):
// suppressing a row is destructive if it's a false match (it would drop a real
// run), so the bar to call two rows "the same run" is higher here than for the
// enrich path, which only attaches an id.
const DEDUP_WINDOW_MS      = 5 * 60 * 1000
const DEDUP_DIST_TOLERANCE = 0.05  // ±5%

export interface DedupCandidate {
  id:                 string
  apple_health_uuid:  string | null
  strava_activity_id: number | null
  distance_m:         number
  start_ms:           number
  hasHrSummary:       boolean
}

export type DedupDecision =
  | { action: 'insert' }
  | { action: 'skip'; matchId: string; patchHr: boolean; convertToHk: boolean }

/**
 * Pure decision: given the incoming HK row and existing candidate rows in the
 * same time neighbourhood, decide whether to insert it or skip it as a dup.
 *
 * First guards the self re-sync of an already-enriched row: if this exact
 * workout already exists with a Strava link patched on, skip — re-upserting the
 * adapted row would null `strava_activity_id` and overwrite the higher-fidelity
 * Strava HR with HK-sample HR. An unenriched same-uuid row falls through and is
 * refreshed normally (insert/upsert). For cross-source matches (different uuid),
 * prefers a Strava-linked row, then an HR-bearing row, as the canonical to keep;
 * `patchHr` is true when that canonical lacks an HR summary but the incoming has one.
 *
 * ADR-011 / HK-SOR: when the canonical is a Strava-only row (apple_health_uuid
 * is null), `convertToHk` is true — the caller patches that row to
 * source='apple_health' and sets apple_health_uuid. The Strava-first webhook
 * race must not strand us without an Apple Health row; HealthKit is the SOR
 * for run data, Strava is provenance.
 */
export function resolveHealthKitDuplicate(
  incoming: { appleHealthUuid: string; distanceM: number; startMs: number; hasHrSummary: boolean },
  candidates: DedupCandidate[],
): DedupDecision {
  // Self re-sync of an enriched row — preserve it, don't re-upsert over the link.
  const self = candidates.find(c => c.apple_health_uuid === incoming.appleHealthUuid)
  if (self && self.strava_activity_id != null) {
    return { action: 'skip', matchId: self.id, patchHr: false, convertToHk: false }
  }

  const distMin = incoming.distanceM * (1 - DEDUP_DIST_TOLERANCE)
  const distMax = incoming.distanceM * (1 + DEDUP_DIST_TOLERANCE)

  const matches = candidates.filter(c =>
    c.apple_health_uuid !== incoming.appleHealthUuid &&
    Math.abs(c.start_ms - incoming.startMs) <= DEDUP_WINDOW_MS &&
    c.distance_m >= distMin && c.distance_m <= distMax
  )
  if (!matches.length) return { action: 'insert' }

  // Canonical = richest existing row: Strava-linked first, then HR-bearing.
  const canonical =
    matches.find(m => m.strava_activity_id != null) ??
    matches.find(m => m.hasHrSummary) ??
    matches[0]

  return {
    action: 'skip',
    matchId: canonical.id,
    patchHr: incoming.hasHrSummary && !canonical.hasHrSummary,
    convertToHk: canonical.apple_health_uuid == null,
  }
}

interface IncomingHealthKitRow {
  apple_health_uuid:    string
  start_date:           string
  /** Used by the late-arrival gate (HR-SYNC-01) to decide whether a fresh
   *  patch should trigger analyse-run or just archive the columns. */
  moving_time_s:        number
  distance_m:           number
  avg_hr:               number | null
  max_hr:               number | null
  hr_in_zone_pct:       number | null
  hr_above_ceiling_pct: number | null
  hr_below_floor_pct:   number | null
  hr_pct_z1:            number | null
  hr_pct_z2:            number | null
  hr_pct_z3:            number | null
  hr_pct_z4_5:          number | null
}

/**
 * DB wrapper around resolveHealthKitDuplicate. Returns `{ skipped: true }` when
 * the incoming HK row duplicates an existing run (caller must NOT insert it);
 * `{ skipped: false }` when it's a genuinely new activity to insert.
 *
 * HR-SYNC-01: when an HR-bearing incoming row patches HR onto a previously
 * HR-null canonical, the return signals (a) whether HR was lifted and
 * (b) whether the workout is still within the fresh coaching window. The
 * caller uses this to fire `/api/analyse-run` for fresh-window patches
 * (so the score card + reframe reflect real HR) and skip it for stale
 * arrivals (per Hutchinson — no two-day-stale fresh reframe).
 */
export async function consolidateIncomingHealthKitRow(
  supabase: any,
  userId: string,
  row: IncomingHealthKitRow,
): Promise<{
  skipped:          boolean
  canonicalId?:     string
  /** The canonical row's apple_health_uuid (after any convertToHk patch).
   *  Caller uses this to look up the row's run_analysis on the HR-refresh path. */
  canonicalAppleHealthUuid?: string | null
  /** True when the patch lifted HR columns onto the canonical (false otherwise). */
  hrLifted?:        boolean
  /** Present when hrLifted=true. False means the patch happened > 24h after workout end. */
  withinFreshWindow?: boolean
}> {
  const startMs = new Date(row.start_date).getTime()
  const { data: candidates } = await supabase
    .from('strava_activities')
    .select('id, apple_health_uuid, strava_activity_id, distance_m, start_date, hr_in_zone_pct')
    .eq('user_id', userId)
    .gte('start_date', new Date(startMs - DEDUP_WINDOW_MS).toISOString())
    .lte('start_date', new Date(startMs + DEDUP_WINDOW_MS).toISOString())

  const decision = resolveHealthKitDuplicate(
    {
      appleHealthUuid: row.apple_health_uuid,
      distanceM:       row.distance_m,
      startMs,
      hasHrSummary:    row.hr_in_zone_pct != null,
    },
    (candidates ?? []).map((c: any) => ({
      id:                 c.id,
      apple_health_uuid:  c.apple_health_uuid,
      strava_activity_id: c.strava_activity_id,
      distance_m:         Number(c.distance_m),
      start_ms:           new Date(c.start_date).getTime(),
      hasHrSummary:       c.hr_in_zone_pct != null,
    })),
  )

  if (decision.action === 'insert') return { skipped: false }

  // Resolve the canonical row's apple_health_uuid for the return value. If
  // convertToHk is true, the canonical becomes HK with the incoming uuid;
  // otherwise it's whatever the matched candidate already carried.
  const matchedCandidate = (candidates ?? []).find((c: any) => c.id === decision.matchId)
  const canonicalAppleHealthUuid: string | null = decision.convertToHk
    ? row.apple_health_uuid
    : (matchedCandidate?.apple_health_uuid ?? null)

  // Build the patch: convert a Strava-only canonical to HK provenance (ADR-011),
  // and/or lift HR onto the canonical if it lacked a summary. Both can apply in
  // the same write — one round-trip.
  const patch: Record<string, unknown> = {}
  if (decision.convertToHk) {
    patch.source            = 'apple_health'
    patch.apple_health_uuid = row.apple_health_uuid
  }
  let lateArrival: { withinFreshWindow: boolean } | null = null
  if (decision.patchHr) {
    patch.avg_hr               = row.avg_hr
    patch.max_hr               = row.max_hr
    patch.hr_in_zone_pct       = row.hr_in_zone_pct
    patch.hr_above_ceiling_pct = row.hr_above_ceiling_pct
    patch.hr_below_floor_pct   = row.hr_below_floor_pct
    patch.hr_pct_z1            = row.hr_pct_z1
    patch.hr_pct_z2            = row.hr_pct_z2
    patch.hr_pct_z3            = row.hr_pct_z3
    patch.hr_pct_z4_5          = row.hr_pct_z4_5

    // HR-SYNC-01: stamp arrival timestamp on late-window patches so the
    // daily coach note can reference "yesterday's HR just landed" without
    // re-firing analyse-run now (Hutchinson). The decision flows back to
    // the caller via the return value.
    lateArrival = decideLateArrival(
      { workoutStartIso: row.start_date, durationSeconds: row.moving_time_s },
      new Date(),
    )
    if (!lateArrival.withinFreshWindow) {
      patch.hr_arrived_late_at = new Date().toISOString()
    }
  }
  if (Object.keys(patch).length > 0) {
    patch.processed_at = new Date().toISOString()
    const { error } = await supabase.from('strava_activities').update(patch).eq('id', decision.matchId)
    if (error) console.error('[healthkit-consolidate] canonical patch failed', error.message)
  }

  return {
    skipped:                  true,
    canonicalId:              decision.matchId,
    canonicalAppleHealthUuid,
    hrLifted:                 decision.patchHr,
    withinFreshWindow:        lateArrival?.withinFreshWindow,
  }
}
