/**
 * Reframe data-source ladder — determines which tier of evidence the post-run
 * reframe can lean on for a given user.
 *
 * Tier A — full history:  ≥ TIER_A_MIN_ACTIVITIES analysed runs in the last
 *                          TIER_A_WINDOW_DAYS. Cohort + trend + drift evidence
 *                          available.
 * Tier B — plan + RPE:    ≥ TIER_B_MIN_COMPLETIONS logged in the last
 *                          TIER_B_WINDOW_DAYS but insufficient activity history.
 *                          RPE pattern + completion rate available.
 * Tier C — minimum:        Anything below Tier B. Structural anchors only —
 *                          phase position, total sessions logged.
 *
 * Architectural rule: the reframe MUST work at every tier. Lower tiers don't
 * fail — they degrade gracefully. See docs/canonical/brand.md § Reframe Voice.
 *
 * This is pure tier detection — does not fetch the evidence itself. The route
 * uses the returned tier to decide which evidence fetchers to invoke.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { REFRAME_TIER } from './constants'

export type ReframeTier = 'A' | 'B' | 'C'

export interface ReframeTierCounts {
  /** Analysed runs in the Tier A window. Source-mixed (HealthKit + Strava). */
  recentActivities: number
  /** Logged session_completions in the Tier B window. */
  recentCompletions: number
}

export interface ReframeTierResult {
  tier: ReframeTier
  counts: ReframeTierCounts
}

/**
 * Detects the highest data tier supported for this user's reframe.
 *
 * One round-trip per check: two count queries in parallel. Cheap enough to
 * run on every reframe request; results aren't cached because the tier can
 * flip mid-week (new Strava activity links, new completion logged).
 */
export async function detectReframeTier(
  supabase: SupabaseClient,
  userId: string,
): Promise<ReframeTierResult> {
  const now = new Date()
  const tierAFrom = new Date(now)
  tierAFrom.setDate(tierAFrom.getDate() - REFRAME_TIER.TIER_A_WINDOW_DAYS)
  const tierBFrom = new Date(now)
  tierBFrom.setDate(tierBFrom.getDate() - REFRAME_TIER.TIER_B_WINDOW_DAYS)

  const [{ count: actCount }, { count: compCount }] = await Promise.all([
    supabase
      .from('strava_activities')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or('activity_type.eq.Run,sport_type.eq.Run')
      .gte('start_date', tierAFrom.toISOString()),
    supabase
      .from('session_completions')
      .select('week_n', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('updated_at', tierBFrom.toISOString()),
  ])

  const recentActivities = actCount ?? 0
  const recentCompletions = compCount ?? 0

  let tier: ReframeTier
  if (recentActivities >= REFRAME_TIER.TIER_A_MIN_ACTIVITIES) {
    tier = 'A'
  } else if (recentCompletions >= REFRAME_TIER.TIER_B_MIN_COMPLETIONS) {
    tier = 'B'
  } else {
    tier = 'C'
  }

  return {
    tier,
    counts: { recentActivities, recentCompletions },
  }
}

/**
 * Pure tier detection from already-fetched counts. Used in tests and in
 * paths where the counts are computed elsewhere (e.g. a debug surface).
 */
export function classifyReframeTier(counts: ReframeTierCounts): ReframeTier {
  if (counts.recentActivities >= REFRAME_TIER.TIER_A_MIN_ACTIVITIES) return 'A'
  if (counts.recentCompletions >= REFRAME_TIER.TIER_B_MIN_COMPLETIONS) return 'B'
  return 'C'
}
