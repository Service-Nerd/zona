import type { SupabaseClient } from '@supabase/supabase-js'
import type { DistanceUnits, SessionMetric } from '@/lib/format'

// Display preferences — the units and metric a user reads their training in.
// ONE source of truth: `user_settings.preferred_units` / `preferred_metric`.
//
// On the client these are lifted once in DashboardClient and passed as props
// (M-007). Server paths — the daily push, weekly report, coaching prompts — have
// no access to that lifted state, so they fetch them HERE and hand them to
// lib/format's formatters. This helper is why a server-rendered surface can honour
// "km vs mi" and "distance vs duration" instead of hardcoding 'km' (ADR-015 /
// INV-PREF-001). No send path may format a distance/duration without it.

export interface DisplayPrefs {
  units: DistanceUnits
  metric: SessionMetric
}

/** The defaults a brand-new user (or a settings-read miss) gets. Matches the
 *  client defaults in DashboardClient so server and client agree on day one. */
export const DEFAULT_DISPLAY_PREFS: DisplayPrefs = { units: 'km', metric: 'distance' }

/** Normalise a raw user_settings row into DisplayPrefs — the single owner of the
 *  defaulting rule. Use this directly when the caller already has the settings row
 *  loaded (e.g. the daily-push cron) to avoid a second query; use
 *  getUserDisplayPrefs when it doesn't. */
export function normalizeDisplayPrefs(
  row: { preferred_units?: string | null; preferred_metric?: string | null } | null | undefined,
): DisplayPrefs {
  return {
    units: row?.preferred_units === 'mi' ? 'mi' : 'km',
    metric: row?.preferred_metric === 'duration' ? 'duration' : 'distance',
  }
}

/**
 * Fetch a user's global display preferences for server-side rendering of any
 * distance/duration string. Never throws — a read miss or unset column falls back
 * to DEFAULT_DISPLAY_PREFS so a send is never blocked on preferences.
 *
 * NOTE: per-session metric overrides live in `session_metric_overrides` and are
 * NOT read here — this is the global preference only. Send paths that render a
 * specific session should resolve the per-session override on top of this via
 * resolveSessionMetric when that data is loaded (ADR-015).
 */
export async function getUserDisplayPrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<DisplayPrefs> {
  const { data } = await supabase
    .from('user_settings')
    .select('preferred_units, preferred_metric')
    .eq('id', userId)
    .maybeSingle()

  return normalizeDisplayPrefs(data)
}
