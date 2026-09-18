// PLAN-WEEK-COLLISION-01 — the production detector.
//
// `supersedeCoverage.test.ts` stops a NEW unfiltered read shipping. It cannot
// see a row that is already wrong in the database: a backfill that missed a
// user, a write path that forgets the stamp, a future table added to the
// week-keyed family. This is the observing half.
//
// WHY IT NEEDS TO EXIST AT ALL. The defect had no symptom. Nothing threw,
// nothing logged, every gate stayed green, and `validatePlan()` cannot reach it
// by construction — it validates the plan OBJECT while the collision lives in
// another table. It was found because a human opened his own plan and read it.
// With 500 charity runners arriving, "a human happens to look" is not a control.
//
// Pure, so it is testable at a pinned clock with no database.

/** The minimum a caller must know about a live week-keyed row. */
export interface LiveWeekRow {
  week_n: number
  /** When the row was written. `created_at`, or `updated_at` where the table
   *  has no `created_at` (session_overrides, session_metric_overrides). */
  at: string | null
}

export interface CollisionFinding {
  userId: string
  table: string
  /** Rows dated before the plan they are attached to could have existed. */
  staleRows: number
  /** The earliest offender, for a human reading the ops digest. */
  earliest: string | null
  planStart: string
  raceName: string | null
}

/**
 * A live row that predates its own plan cannot belong to it.
 *
 * `week_n` restarts at 1 on every new race plan, so a stale row is not merely
 * old — it RESOLVES, and the UI renders it as a completed session of the plan
 * the runner is looking at now. The date is the only signal available: a
 * completion for week 3 of a plan that starts in September cannot have been
 * written in April.
 *
 * Deliberately generous by one week. A runner can log a session slightly before
 * their plan's official Monday start (the plan begins the Monday after
 * generation, and people run on the Sunday), and flagging that would train
 * whoever reads the digest to ignore it.
 */
export function findWeekCollisions(
  userId: string,
  plan: { meta?: { plan_start?: string; race_name?: string | null }; weeks?: { n?: number }[] } | null,
  rowsByTable: Record<string, LiveWeekRow[]>,
  graceDays = 7,
): CollisionFinding[] {
  const planStart = plan?.meta?.plan_start
  if (!planStart || !plan?.weeks?.length) return []

  const cutoff = new Date(planStart)
  if (Number.isNaN(cutoff.getTime())) return []
  cutoff.setDate(cutoff.getDate() - graceDays)

  // Only weeks the plan actually owns can collide. A row at week 40 on a
  // 12-week plan is orphaned, not colliding — different defect, not this one.
  const owned = new Set(plan.weeks.map(w => w.n).filter((n): n is number => typeof n === 'number'))

  const findings: CollisionFinding[] = []
  for (const [table, rows] of Object.entries(rowsByTable)) {
    const stale = rows.filter(r =>
      owned.has(r.week_n) && r.at != null && new Date(r.at) < cutoff)
    if (!stale.length) continue
    findings.push({
      userId,
      table,
      staleRows: stale.length,
      earliest: stale.map(r => r.at!).sort()[0] ?? null,
      planStart,
      raceName: plan.meta?.race_name ?? null,
    })
  }
  return findings
}
