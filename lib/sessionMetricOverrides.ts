import type { SupabaseClient } from '@supabase/supabase-js'
import type { SessionMetric, SessionMetricOverrides } from '@/lib/format'
import { writeLiveRow } from './supabase/liveRowWrite'

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
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only

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
  // 🔴 WEEKLY-REPORT-SUPERSEDED-WRITE-01 — was
  // `.upsert(…, { onConflict: 'user_id,week_n,session_key' })`, COMPLETION-TOMBSTONE-01's
  // twin. `week_n` is a WITHIN-PLAN coordinate (ADR-013): a new plan restarts at 1, the
  // upsert updated the PREVIOUS plan's row in place and inherited its `superseded_at`,
  // and `loadSessionMetricOverrides` twelve lines above filters exactly those rows out.
  // The runner's toggle appeared to save and was gone on the next read. 13 superseded
  // rows in production on 2026-11-02.
  await writeLiveRow(
    supabase,
    'session_metric_overrides',
    { user_id: userId, week_n: weekN, session_key: sessionKey },
    { user_id: userId, week_n: weekN, session_key: sessionKey, metric, updated_at: new Date().toISOString() },
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
    // 🔴 WEEKLY-REPORT-SUPERSEDED-WRITE-01, third arm. Without this filter the delete
    // also removed the runner's SUPERSEDED rows for the same (week, session_key) — their
    // previous plan's history — while the loader twelve lines above reads live rows only.
    // A delete is the one operation superseding cannot undo.
    .is('superseded_at', null)
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
    // 🔴 WEEKLY-REPORT-SUPERSEDED-WRITE-01 — one write per row rather than a batch
    // upsert on `(user_id, week_n, session_key)`. The batch form inherited the previous
    // plan's tombstone on every key that collided, which on a one-time backfill means
    // the runner's legacy toggles land where nothing reads them. Sequential is fine: this
    // runs ONCE per device and `legacy` is the handful of keys in their localStorage.
    for (const l of legacy) {
      await writeLiveRow(
        supabase,
        'session_metric_overrides',
        { user_id: userId, week_n: l.week_n, session_key: l.session_key },
        { user_id: userId, ...l },
      )
    }
  }

  // Mark migrated regardless — a user with no legacy keys is trivially "done".
  window.localStorage.setItem(BACKFILL_FLAG, new Date().toISOString())

  return loadSessionMetricOverrides(supabase, userId)
}
