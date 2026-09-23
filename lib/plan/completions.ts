import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * COMPLETION-TOMBSTONE-01 — the single owner of writing a session completion.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * There were EIGHT `.from('session_completions').upsert(...)` calls, each
 * passing `onConflict: 'user_id,week_n,session_day'`. That key is not
 * plan-scoped, and `week_n` is a WITHIN-PLAN coordinate (ADR-013), so once a
 * runner started a new plan the numbering restarted at 1 and every write
 * collided with the PREVIOUS plan's row — updating it in place and inheriting
 * its `superseded_at` tombstone. The write succeeded, every read filtered it
 * out, and nothing errored.
 *
 * Measured before the fix: 150 superseded rows, 2 writes that landed on
 * tombstones, and a session skipped for `Injury / illness` carrying `rpe = 3`
 * from a plan five months earlier — a false signal into the fatigue triggers.
 *
 * ⚠️ EIGHT CALL SITES IS THE REASON, NOT AN ASIDE. The cheap fix was to add
 * `superseded_at: null` to each of them, which fixes seven of eight until
 * someone writes the ninth. This repo has recorded that shape under five names.
 *
 * ── THE CONTRACT ───────────────────────────────────────────────────────────
 * **A KEY YOU PASS IS WRITTEN. A KEY YOU OMIT IS PRESERVED.** Passing `null`
 * CLEARS the column; leaving the key out leaves the stored value alone.
 *
 * That distinction is load-bearing in both directions and existing callers
 * already depend on both halves:
 *   · `saveReflect` passes `rpe: null` to CLEAR an RPE the runner removed.
 *   · the manual-log write OMITS `rpe`/`fatigue_tag` so a DS-07 edit cannot
 *     wipe body-state the runner already logged.
 * A `coalesce`-style merge would satisfy the second and silently break the
 * first — a new silent defect inside the fix for a silent defect.
 *
 * ── WHY AN RPC ─────────────────────────────────────────────────────────────
 * The live-row uniqueness is a PARTIAL index (`WHERE superseded_at IS NULL`).
 * PostgREST's `.upsert()` emits `ON CONFLICT (cols) DO UPDATE` with no
 * predicate and Postgres will not match that to a partial index. Only
 * hand-written SQL can carry the predicate, so the write lives in
 * `upsert_session_completion(jsonb)` and this is its typed front door.
 */
export interface CompletionWrite {
  week_n: number
  session_day: string
  status?: string
  skip_reason?: string | null
  rpe?: number | null
  fatigue_tag?: string | null
  coaching_flag?: string | null
  avg_hr?: number | null
  strava_activity_id?: number | null
  strava_activity_name?: string | null
  strava_activity_km?: number | null
  apple_health_uuid?: string | null
}

/**
 * ⚠️ `user_id` IS NOT A PARAMETER. The RPC takes it from `auth.uid()`, so a
 * client cannot write another runner's row even if it wanted to. Callers used
 * to pass `user.id` explicitly; that is now the database's business.
 *
 * Returns `{ error }` rather than throwing. Every existing call site is
 * `await`ed inside a `try {} catch {}` that swallows, which is how this stayed
 * silent — surfacing the error is the caller's job, and now it is possible.
 */
export async function upsertCompletion(
  supabase: SupabaseClient,
  write: CompletionWrite,
): Promise<{ error: Error | null }> {
  // Only keys the caller actually set are sent. `undefined` means "not
  // addressed"; the RPC's `p ? 'key'` test reads exactly that, and JSON.stringify
  // drops undefined for us. Done explicitly rather than relying on that, because
  // the whole contract turns on it.
  const payload: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(write)) {
    if (v !== undefined) payload[k] = v
  }

  const { error } = await supabase.rpc('upsert_session_completion', { p: payload })
  return { error: error ? new Error(error.message) : null }
}
