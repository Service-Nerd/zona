// SESSION-COMPLETION-AVG-HR-STALE-01 — the late-HR path mirrors the run's average heart rate onto its completion.
//
// `session_completions.avg_hr` is copied ONCE, when the run is linked (`autoAnalyse` claimAutoLink). Apple Watch heart
// rate lands after the workout, so a run linked before it arrived kept NULL there for good, while `strava_activities`
// and `run_analysis` held the HR. Every reader of the completion's copy (Today's card, the session popup, the
// completion verification, the reframe) then disagreed with the screens reading the activity row. Measured 2026-11-22:
// avg_hr 153 on the activity, null on the completion.
//
// Patched at the ONE place HR arrives late, beside the existing `session_completions` mirror of the Strava id in
// `healthkitConsolidate.ts`. Only a NULL is filled: a completion that already holds a value (a manual log) is never
// overwritten, and only the LIVE row is touched (COMPLETION-TOMBSTONE-01: the uuid survives on superseded rows).
// ADR-027 B4b's single writer replaces this; until then it is the smallest change that makes the copies agree.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function mirrorAvgHrToCompletion(
  supabase: SupabaseClient,
  userId: string,
  appleHealthUuid: string,
  avgHr: number | null | undefined,
): Promise<{ updated: boolean }> {
  if (avgHr == null || !Number.isFinite(avgHr) || avgHr <= 0) return { updated: false }
  const { data, error } = await supabase
    .from('session_completions')
    .update({ avg_hr: Math.round(avgHr), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('apple_health_uuid', appleHealthUuid)
    .is('superseded_at', null)
    .is('avg_hr', null)
    .select('week_n')
  if (error) {
    console.warn('[completion-hr-mirror] failed', error.message)
    return { updated: false }
  }
  return { updated: Array.isArray(data) && data.length > 0 }
}
