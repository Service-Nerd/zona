// PLAN-WEEK-COLLISION-01 — the single owner of "these rows belong to a plan
// that no longer exists".
//
// THE DEFECT THIS CLOSES. `week_n` is a WITHIN-PLAN coordinate that five tables
// use as a cross-plan database key: `session_completions`, `run_analysis`,
// `session_overrides`, `session_metric_overrides`, `session_reflections`. All
// are keyed (user_id, week_n[, session_day]) with no plan identity. A new race
// plan restarts `week.n` at 1 and therefore lands exactly on the rows of the
// plan it replaced.
//
// Measured on production 2026-09-18: a fresh 12-week 10K plan arrived with
// 44 of its 47 sessions (94%) already marked complete or skipped, five of them
// linked to runs from the previous April.
//
// WHY THE ROWS ARE MARKED AND NOT DELETED. Nothing renders per-week completions
// for an archived plan — Plan History reads `plan_archive` alone. But the
// TIME-WINDOWED readers aggregate across plans: the aerobic trend card, the
// discipline ledger, the reframe cohort, `v_coach_engagement`. Deleting on every
// new race would destroy a runner's training history to fix a display bug.
//
// WHY THIS THROWS RATHER THAN LOGGING. `savePlanForUser` already throws when the
// `plan_weekly_notes` invalidation fails, on the argument that "a cached note
// narrating sessions that no longer exist is brand-destroying". These rows are
// the sessions that note was narrating. A silent failure here reproduces the
// exact defect being fixed, and this codebase's own catalogue names
// silent-fallback as its most expensive class. Fail loudly or do not bother.

import type { SupabaseClient } from '@supabase/supabase-js'

/** Every table keyed on `week_n` with no plan identity.
 *
 *  ⚠️ THIS LIST WAS WRONG ON ITS FIRST WRITE, and the guard built alongside it
 *  could not tell: `supersedeCoverage.test.ts` iterates THIS array, so its
 *  coverage was defined by the same list that was incomplete. That is the exact
 *  flaw CLAUDE.md records for `deloadCadence.test.ts` — a checker sharing the
 *  producer's predicate cannot catch the producer being wrong.
 *
 *  `scripts/check-db-drift.ts` now reconciles this array against the LIVE
 *  SCHEMA: any user-scoped table carrying a `week_n` column must appear here or
 *  in that script's argued exemption list. Adding a table to the database is
 *  what re-opens the defect, so that is where the check belongs.
 *
 *  `plan_weekly_notes` is deliberately ABSENT despite carrying `week_n`:
 *  `savePlanForUser` deletes every row on EVERY save, so it is covered by a
 *  stronger mechanism than this one. */
export const WEEK_KEYED_TABLES = [
  'session_completions',
  'run_analysis',
  'session_overrides',
  'session_metric_overrides',
  'session_reflections',
  // ⚠️ ADDED IN THE COMPLETION PASS, hours after the first cut shipped. The
  // original list was written from memory and ADR-013's prose, which names
  // `weekly_reports` explicitly — and it was still left out. A schema query
  // found both of these carrying `week_n`, with 3 rows live against the new
  // plan on the founder's account.
  'weekly_reports',
  'plan_adjustments',
] as const

export type WeekKeyedTable = typeof WEEK_KEYED_TABLES[number]

export interface SupersedeResult {
  /** Rows stamped per table. Zero across the board is the normal case for a
   *  runner on their first plan, and is not an error. */
  stamped: Record<WeekKeyedTable, number>
  at: string
}

/**
 * Mark every live week-keyed row for `userId` as belonging to a superseded plan.
 *
 * IDEMPOTENT by construction: the update filters `superseded_at IS NULL`, so
 * running it twice stamps nothing the second time. That matters because
 * `savePlanForUser` can fire several times in quick succession on the
 * race → maintenance handoff (ADR-013), which is the burst that once archived
 * the same plan three times.
 *
 * Call this ONLY on a RACE-IDENTITY change. A reshape, recalibration,
 * sub-threshold auto-apply or the appended maintenance block all keep the same
 * `week.n` sequence and MUST keep their completions — superseding there would
 * wipe a runner's progress mid-block, which is a worse bug than the one this
 * fixes.
 */
export async function supersedeWeekKeyedRows(
  userId: string,
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<SupersedeResult> {
  const at = now.toISOString()
  const stamped = {} as Record<WeekKeyedTable, number>

  for (const table of WEEK_KEYED_TABLES) {
    const { data, error } = await supabase
      .from(table)
      .update({ superseded_at: at })
      .eq('user_id', userId)
      .is('superseded_at', null)
      .select('user_id')

    if (error) {
      throw new Error(
        `supersedeWeekKeyedRows: ${table} stamp failed — ${error.message}. ` +
        `Aborting rather than leaving a new plan showing the previous plan's completions.`
      )
    }
    stamped[table] = data?.length ?? 0
  }

  return { stamped, at }
}

/**
 * Does a plan change constitute a NEW RACE, as opposed to a mutation of the
 * current one?
 *
 * Extracted so `savePlanForUser`'s archive decision and the supersede decision
 * are the SAME predicate rather than two copies of one rule — the D-16 class
 * this repo has been bitten by repeatedly (the tier ladder existed in three
 * places; the deload cadence in five). If these two ever disagree, a plan is
 * archived without its rows being stamped, or the reverse.
 */
export function isRaceIdentityChange(
  prior: { race_name?: string | null; race_date?: string | null } | null | undefined,
  next: { race_name?: string | null; race_date?: string | null } | null | undefined,
): boolean {
  if (!prior) return false
  const sig = (m?: { race_name?: string | null; race_date?: string | null } | null) =>
    `${m?.race_name ?? ''}|${m?.race_date ?? ''}`
  return sig(prior) !== sig(next)
}
