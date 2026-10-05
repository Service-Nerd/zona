// PLAN-AUDIT-AGE-SOURCE-01 (2026-10-05) — how old is a breaching plan, and which
// "old" does the question mean?
//
// 🔴 THE METRIC WAS NAMED FOR ONE TIMESTAMP AND COMPUTED FROM ANOTHER.
// `newest_invalid_plan_age_days` means the age of the PLAN. It was computed from
// `updated_at`, the last time anything wrote to the row. Those coincide right up to
// the moment somebody touches an old plan — and on 2026-10-03 somebody did:
// `RACE-WEEK-VOLUME-REMEDIATE-01` and `FOUNDATION-BUDGET-01` rewrote 16 stored plans.
//
// Measured on the 2026-10-04 run: **23 plans fell in the "0-1d" bucket, and 9 of them
// were created between 63 and 166 DAYS earlier.** One created 2026-04-21 was reported
// as under a day old. The digest's escalation rule reads that bucket as *"the CURRENT
// engine has recently produced a bad plan"*, and for those rows the inference is simply
// false — the engine never touched them; a remediation script did.
//
// ⚠️ THE OTHER SIGNAL IS REAL AND IS KEPT, NOT REPLACED. "A plan was MODIFIED and is
// now breaching" is its own hazard — a reshape or a maintenance-block append can push a
// previously-valid plan into violation, and that is exactly the case the original
// comment was reaching for ("a plan can become invalid AFTER generation"). Collapsing
// the two into one number is what made both unreadable. So both are reported, each
// answering the question its name states.
//
// Pure, so it can be gated: the route had no test, and an inline reduce inside a Vercel
// handler cannot have one.

export interface PlanAgeRow {
  /** When the plan was GENERATED. The engine's output is this old. */
  created_at: string | null | undefined
  /** When the row was last WRITTEN. A remediation or reshape moves this, not the engine. */
  updated_at: string | null | undefined
}

export interface PlanAgeSummary {
  /** Age of the newest breaching plan BY CREATION — "did we just generate this badly?" */
  newest_invalid_plan_age_days: number | null
  /** Buckets by creation age. Same question, distribution form. */
  invalid_by_plan_age: Record<'0-1d' | '2-7d' | '8-30d' | '31d+', number>
  /** Age of the most recently MODIFIED breaching plan — "did something just touch a plan into breach?" */
  newest_invalid_modified_age_days: number | null
  /** How many breaching plans were written within a day but generated earlier. */
  modified_recently_but_older: number
}

const BUCKETS = ['0-1d', '2-7d', '8-30d', '31d+'] as const

/** Whole days between `iso` and `now`, or null when the timestamp is unusable. */
export function ageDays(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  // A future or unparseable timestamp must not become a confident 0.
  if (!Number.isFinite(t) || t > now) return null
  return Math.floor((now - t) / 86_400_000)
}

function bucket(ages: number[]): PlanAgeSummary['invalid_by_plan_age'] {
  return {
    '0-1d': ages.filter(d => d <= 1).length,
    '2-7d': ages.filter(d => d > 1 && d <= 7).length,
    '8-30d': ages.filter(d => d > 7 && d <= 30).length,
    '31d+': ages.filter(d => d > 30).length,
  }
}

/**
 * Summarise the ages of the breaching plans.
 *
 * `rows` is every plan the audit found invalid — including ones whose per-user event was
 * deduped, because the dedupe is right for events and wrong for a fleet measure.
 */
export function summarisePlanAges(rows: readonly PlanAgeRow[], now = Date.now()): PlanAgeSummary {
  const created: number[] = []
  const modified: number[] = []
  let modifiedRecentlyButOlder = 0

  for (const r of rows) {
    const c = ageDays(r.created_at, now)
    const u = ageDays(r.updated_at, now)
    if (c != null) created.push(c)
    if (u != null) modified.push(u)
    // The exact shape that produced the 2026-10-04 false alarm. Counting it makes the
    // divergence visible in the summary instead of leaving it to be rediscovered.
    if (u != null && u <= 1 && c != null && c > 1) modifiedRecentlyButOlder++
  }

  created.sort((a, b) => a - b)
  modified.sort((a, b) => a - b)

  return {
    newest_invalid_plan_age_days: created[0] ?? null,
    invalid_by_plan_age: bucket(created),
    newest_invalid_modified_age_days: modified[0] ?? null,
    modified_recently_but_older: modifiedRecentlyButOlder,
  }
}

export const PLAN_AGE_BUCKETS = BUCKETS
