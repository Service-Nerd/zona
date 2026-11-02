import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * WEEKLY-REPORT-SUPERSEDED-WRITE-01 — the single owner of writing a row that must belong
 * to the LIVE plan.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────
 * `weekly_reports`, `session_reflections` and `session_metric_overrides` are keyed
 * `(user_id, week_n[, ...])` with no plan identity, every read filters
 * `superseded_at IS NULL` (PLAN-WEEK-COLLISION-01), and all three were written with a
 * PostgREST `.upsert()` on that same key. `week_n` is a WITHIN-PLAN coordinate
 * (ADR-013), so a new plan restarts at 1 and the upsert found the PREVIOUS plan's row,
 * updated it in place and inherited its tombstone. The write succeeded, every read
 * excluded it, nothing errored.
 *
 * Measured 2026-11-02: 1 ghost write live (a runner's week-1 report, written onto a row
 * superseded a week earlier), 21 superseded rows across the other two tables waiting for
 * the same collision. COMPLETION-TOMBSTONE-01 fixed the fourth table of this family on
 * 2026-09-23 and left these three.
 *
 * ── THE CONTRACT ─────────────────────────────────────────────────────────────────────
 * Read the LIVE row's primary key, then UPDATE by that key, or INSERT when there is
 * none. An update targeted at `id` cannot reach a tombstone by construction — which is
 * the property `.upsert()` could not express, because PostgREST emits
 * `ON CONFLICT (cols) DO UPDATE` with no predicate and Postgres will not match that to a
 * PARTIAL index (the same wall COMPLETION-TOMBSTONE-01 hit, where the answer was an RPC
 * because it had eight call sites and a per-column merge contract; these have single
 * owners and write whole rows, so they do not need one).
 *
 * ⚠️ A WHOLE-ROW WRITE, DELIBERATELY. Unlike `upsert_session_completion`, every caller
 * here supplies the complete row, so there is no key-present/key-omitted distinction to
 * preserve and no field is inherited from the previous write.
 *
 * ⚠️ THE UNIQUE VIOLATION IS NOT SWALLOWED. Two things produce one, and they need
 * opposite handling:
 *   · a concurrent writer inserted the live row between our read and our insert — retry
 *     once against the row that now exists;
 *   · the live partial index is absent because 20261102_live_week_keys.sql has not been
 *     applied, so the old plain UNIQUE is still matching the TOMBSTONE — report it. The
 *     caller logs it and declines rather than writing history (a silent fallback must
 *     attribute before it swallows).
 */

export type LiveWriteOutcome =
  | { ok: true; action: 'inserted' | 'updated' }
  /** The live partial index is missing: the collision is with a superseded row, so the
   *  write was NOT made. Almost always "the migration has not been applied yet". */
  | { ok: false; reason: 'tombstone-collision'; message: string }
  | { ok: false; reason: 'error'; message: string }

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = '23505'

/**
 * @param key the columns identifying the row WITHIN the live plan (e.g.
 *            `{ user_id, week_n, session_day }`). Never includes `superseded_at`: this
 *            function adds the live filter itself, so a caller cannot forget it.
 * @param row the complete row to store. Must contain the `key` columns.
 */
export async function writeLiveRow(
  supabase: SupabaseClient,
  table: string,
  key: Record<string, string | number>,
  row: Record<string, unknown>,
): Promise<LiveWriteOutcome> {
  const findLive = async () => {
    let q = supabase.from(table).select('id').is('superseded_at', null)
    for (const [col, val] of Object.entries(key)) q = q.eq(col, val)
    return q.maybeSingle()
  }

  const live = await findLive()
  if (live.error) return { ok: false, reason: 'error', message: live.error.message }

  const liveId = (live.data as { id?: string } | null)?.id
  if (liveId) {
    const upd = await supabase.from(table).update(row).eq('id', liveId)
    return upd.error
      ? { ok: false, reason: 'error', message: upd.error.message }
      : { ok: true, action: 'updated' }
  }

  const ins = await supabase.from(table).insert(row)
  if (!ins.error) return { ok: true, action: 'inserted' }
  if ((ins.error as { code?: string }).code !== UNIQUE_VIOLATION) {
    return { ok: false, reason: 'error', message: ins.error.message }
  }

  // A unique violation with no live row means one of exactly two things. Ask again:
  // a concurrent insert leaves a live row to update, a tombstone collision does not.
  const again = await findLive()
  if (again.error) return { ok: false, reason: 'error', message: again.error.message }
  const raceId = (again.data as { id?: string } | null)?.id
  if (!raceId) {
    return {
      ok: false,
      reason: 'tombstone-collision',
      message: `${table}: unique violation on ${JSON.stringify(key)} with no live row. `
        + 'The live partial index is missing — apply supabase/migrations/20261102_live_week_keys.sql. '
        + 'Nothing was written; the superseded row was left intact.',
    }
  }
  const upd = await supabase.from(table).update(row).eq('id', raceId)
  return upd.error
    ? { ok: false, reason: 'error', message: upd.error.message }
    : { ok: true, action: 'updated' }
}
