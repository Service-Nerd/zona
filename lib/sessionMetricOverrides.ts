import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionMetric, SessionMetricOverrides } from '@/lib/format'

// Data layer for per-session distance⇄duration overrides (ADR-015).
//
// Canonical store is the `session_metric_overrides` table. The in-memory shape is
// SessionMetricOverrides — a map keyed `${weekN}_${sessionKey}`, exactly what
// resolveSessionMetric expects — so callers keep using resolveSessionMetric
// unchanged; only where the map comes FROM moves (localStorage → DB).

const LOCAL_KEY_PREFIX = 'rts_metric_'
const BACKFILL_FLAG = 'rts_metric_migrated_v1'

const mapKey = (weekN: number, sessionKey: string) => `${weekN}_${sessionKey}`

/** Load a user's per-session overrides from the DB into the resolver map shape. */
export async function loadSessionMetricOverrides(
  supabase: SupabaseClient,
  userId: string,
): Promise<SessionMetricOverrides> {
  const { data } = await supabase
    .from('session_metric_overrides')
    .select('week_n, session_key, metric')
    .eq('user_id', userId)

  const out: SessionMetricOverrides = {}
  for (const row of data ?? []) {
    out[mapKey(row.week_n as number, row.session_key as string)] = row.metric as SessionMetric
  }
  return out
}

/** Upsert one per-session override. Unique on (user_id, week_n, session_key). */
export async function setSessionMetricOverride(
  supabase: SupabaseClient,
  userId: string,
  weekN: number,
  sessionKey: string,
  metric: SessionMetric,
): Promise<void> {
  await supabase
    .from('session_metric_overrides')
    .upsert(
      { user_id: userId, week_n: weekN, session_key: sessionKey, metric, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,week_n,session_key' },
    )
}

/** Remove a per-session override (revert to plan default / global preference). */
export async function clearSessionMetricOverride(
  supabase: SupabaseClient,
  userId: string,
  weekN: number,
  sessionKey: string,
): Promise<void> {
  await supabase
    .from('session_metric_overrides')
    .delete()
    .eq('user_id', userId)
    .eq('week_n', weekN)
    .eq('session_key', sessionKey)
}

/**
 * One-time read-through migration of the legacy localStorage overrides
 * (`rts_metric_${weekN}_${sessionKey}`) into the DB, so no user loses their
 * existing per-session toggles when the store moves server-side (D-18 — no
 * half-removed state). Idempotent: sets a localStorage flag once done and no-ops
 * thereafter. Client-only (needs localStorage); safe no-op on the server.
 *
 * Returns the overrides now in the DB (post-backfill) so the caller can seed
 * state in a single round-trip.
 */
export async function backfillAndLoadSessionMetricOverrides(
  supabase: SupabaseClient,
  userId: string,
): Promise<SessionMetricOverrides> {
  if (typeof window === 'undefined' || !window.localStorage) {
    return loadSessionMetricOverrides(supabase, userId)
  }

  if (window.localStorage.getItem(BACKFILL_FLAG)) {
    return loadSessionMetricOverrides(supabase, userId)
  }

  // Collect legacy localStorage entries.
  const legacy: Array<{ week_n: number; session_key: string; metric: SessionMetric }> = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key || !key.startsWith(LOCAL_KEY_PREFIX)) continue
    const rest = key.slice(LOCAL_KEY_PREFIX.length)     // "${weekN}_${sessionKey}"
    const us = rest.indexOf('_')
    if (us <= 0) continue
    const weekN = Number(rest.slice(0, us))
    const sessionKey = rest.slice(us + 1)
    const value = window.localStorage.getItem(key)
    if (!Number.isFinite(weekN) || !sessionKey) continue
    if (value !== 'distance' && value !== 'duration') continue
    legacy.push({ week_n: weekN, session_key: sessionKey, metric: value })
  }

  if (legacy.length > 0) {
    await supabase
      .from('session_metric_overrides')
      .upsert(
        legacy.map(l => ({ user_id: userId, ...l })),
        { onConflict: 'user_id,week_n,session_key' },
      )
  }

  // Mark migrated regardless — a user with no legacy keys is trivially "done".
  window.localStorage.setItem(BACKFILL_FLAG, new Date().toISOString())

  return loadSessionMetricOverrides(supabase, userId)
}
