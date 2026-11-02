import { WEEK_KEYED_TABLES } from '@/lib/plan/supersede'

/**
 * CHECK-DB-LIVE-KEY-CRON-01 — the single owner of "is this week_n-keyed uniqueness scoped to
 * the live plan?".
 *
 * ── WHY IT IS A MODULE AND NOT A SECOND COPY ───────────────────────────────────────────
 * The classification was written inline in `scripts/check-db-drift.ts`. The scheduled probe
 * (`/api/ops/live-key-integrity`) asks the identical question, and a second hand-written copy
 * of one answer is the shape behind `DELOAD-OWNER-01` (the deload cadence in five places),
 * `TIER-OWNER-01` (the tier order in three) and `hrBand.ts`'s own forty-line header. Two
 * producers agree until one is edited.
 *
 * ── WHAT IT IS FOR ─────────────────────────────────────────────────────────────────────
 * The `%_live_key` partial unique indexes are the write side of PLAN-WEEK-COLLISION-01. A
 * unique on `(user_id, week_n, …)` WITHOUT `WHERE superseded_at IS NULL` means a new plan's
 * row cannot insert beside its superseded history: `week_n` restarts at 1 (ADR-013), so the
 * write lands on the tombstone or fails, every read excludes it, and nothing errors. Weeks
 * invisible twice — COMPLETION-TOMBSTONE-01 and WEEKLY-REPORT-SUPERSEDED-WRITE-01 — and the
 * survivors (WEEK-KEY-PLAIN-UNIQUE-SURVIVORS-01) were found only because a query was run by
 * hand to prove an RPC worked.
 *
 * ⚠️ SCOPE IS DERIVED, NOT LISTED. Only tables carrying `superseded_at` are in scope, because
 * a table without the column cannot have the predicate. `plan_weekly_notes` falls out on its
 * own: its pkey is `(user_id, week_n)` and `savePlanForUser` deletes every row on every save,
 * which is the stronger mechanism `supersede.ts` already documents. The authority is
 * `WEEK_KEYED_TABLES`, the same array the schema is reconciled against.
 */

/** One row of `public.week_key_uniqueness()`. */
export interface WeekKeyRow {
  table_name: string
  index_name: string
  /** 'index' — a bare unique index. 'constraint' — backed by a table constraint, which is the
   *  form that BLOCKS a new plan's insert rather than merely scoping it. */
  kind: string
  columns: string
  /** The index's WHERE clause, or null when it has none. */
  predicate: string | null
}

export interface LiveKeyAudit {
  /** Week_n-keyed uniques on a stamped table, correctly scoped to the live plan. */
  liveScoped: WeekKeyRow[]
  /** Week_n-keyed uniques on a stamped table that are NOT. Each one is a defect. */
  findings: WeekKeyRow[]
  /** Rows on tables that carry no `superseded_at`, so the predicate cannot apply. */
  outOfScope: WeekKeyRow[]
  healthy: boolean
}

/** Is this predicate the live-plan scope? */
export function isLiveScoped(predicate: string | null): boolean {
  return /superseded_at\s+is\s+null/i.test(predicate ?? '')
}

/**
 * Sort the RPC's rows. Pure: no I/O, so both callers can be tested against the same fixtures
 * and neither can drift from the other.
 */
export function auditWeekKeyUniqueness(rows: readonly WeekKeyRow[]): LiveKeyAudit {
  const stamped = new Set<string>(WEEK_KEYED_TABLES as readonly string[])
  const outOfScope = rows.filter(r => !stamped.has(r.table_name))
  const inScope    = rows.filter(r => stamped.has(r.table_name))
  const liveScoped = inScope.filter(r => isLiveScoped(r.predicate))
  const findings   = inScope.filter(r => !isLiveScoped(r.predicate))
  return { liveScoped, findings, outOfScope, healthy: findings.length === 0 }
}

/** One line per finding, for a log or an ops-event detail. Shared so the script and the probe
 *  describe the same defect the same way. */
export function describeFinding(r: WeekKeyRow): string {
  return `${r.table_name}.${r.index_name} (${r.kind}) on (${r.columns}) — predicate ${r.predicate ?? 'NONE'}`
}
