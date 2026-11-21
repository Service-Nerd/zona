/**
 * ADJUST-LEDGER-DUPLICATE-01 (2026-11-10) — is this adjustment a re-write of one already in the
 * ledger, or a second thing the runner actually did?
 *
 * 🔴 THE DEFECT. `app/api/adjust-plan/route.ts` already carried a duplicate guard — *"return any
 * existing pending adjustment rather than creating a duplicate"* — scoped to `status: 'pending'`.
 * **An auto-applied adjustment never passes through `pending`**, so the only status the guard
 * protected was the one that already blocks itself, and the statuses that actually duplicated in
 * production (`auto_applied`, `reverted`) were unguarded. The population excluded the cases at
 * risk.
 *
 * 📐 MEASURED ON PRODUCTION (22 ledger rows), AND THE FILED PREMISE WAS WRONG BY 4×. The item
 * read *"8 of 22 rows are duplicates — 4 pairs, 1–7 seconds apart"*. It grouped by
 * `(user, week_n, trigger_type, status)` and never compared `trigger_detail`. Four of the five
 * sub-ten-second pairs are **distinct moves**:
 *
 * | week | first | second | gap | same payload? |
 * |---|---|---|---|---|
 * | 21 | `wed → thu` | `tue → wed` | 2.3s | no — a CHAIN, two sessions shuffled at once |
 * | 22 | `wed → thu` | `tue → wed` | 1.6s | no — the same chain shape |
 * | 17 | `wed → tue` | `wed → thu` | 7.4s | no — a CORRECTION of the first move |
 * | 15 | `sat → sun` | `sat → mon` | 9.3s | no — likewise |
 * | 6  | `zone_drift` | `zone_drift` | 4.1s | **YES — the one true duplicate** |
 *
 * So the ledger is **2 of 22 (9%)**, not 36%. One pair, one user, one detector since fixed.
 *
 * 🔑 WHICH IS WHY THE MATCH IS ON THE PAYLOAD AND NOT A UNIQUE INDEX. The item's candidate — a
 * unique index on `(user_id, week_n, trigger_type) where superseded_at is null` — **would forbid
 * all four legitimate chains**, and needs a migration plus a GRANT (MIGRATION-GRANTS-01). The
 * payload is the measured discriminator: identical on the real duplicate, different on every
 * chain. No migration, and it cannot refuse a move the runner actually made.
 *
 * ⚠️ IT IS DELIBERATELY NOT TIME-BOUNDED. A window would need a number nobody can justify — the
 * real gaps run 1.6s to 9.3s and the legitimate week-20 pair is 4.5 days — and a re-write is
 * wrong whenever it happens, not only when it is quick. The payload answers the question without
 * one.
 *
 * ⚠️ AND IT READS ONLY LIVE ROWS. The caller filters `superseded_at is null`
 * (PLAN-WEEK-COLLISION-01), so a superseded row from a previous plan on the same week number can
 * never suppress a real adjustment on the current one.
 */

/** The subset of a ledger row this decision needs. */
export interface LedgerRowLike {
  id: string
  status: string
  trigger_type: string
  trigger_detail: unknown
}

/**
 * The open row this adjustment would merely re-write, or null.
 *
 * ⚠️ Compared by serialised payload rather than by reference or by a field list: `trigger_detail`
 * is a jsonb blob whose shape differs per trigger (`{toDay, fromDay, hardAdjacentViolation}` for a
 * reorder, `{rpe, source, sessionType}` for a drift), so naming fields here would be a second
 * place that has to know every trigger's payload — and would go stale the next time one changes.
 */
export function duplicateOf(
  openRowsThisWeek: readonly LedgerRowLike[],
  candidate: { trigger_type: string; trigger_detail: unknown },
): LedgerRowLike | null {
  const key = JSON.stringify(candidate.trigger_detail ?? null)
  return openRowsThisWeek.find(
    r => r.trigger_type === candidate.trigger_type && JSON.stringify(r.trigger_detail ?? null) === key,
  ) ?? null
}

/**
 * Statuses that count toward `MAX_ADJUSTMENTS_PER_WEEK`.
 *
 * 🔴 `reverted` IS NOT ONE OF THEM, and it is named here because the duplicate check above needs
 * reverted rows while the cap must not count them. A reverted adjustment is one the runner
 * REJECTED; counting it toward their weekly allowance would punish them for saying no. The two
 * lists were one list before this item, which is how widening the query for the check would have
 * quietly tightened the cap.
 */
export const CAPPED_STATUSES = ['pending', 'confirmed', 'auto_applied'] as const

export const countsTowardCap = (row: { status: string }): boolean =>
  (CAPPED_STATUSES as readonly string[]).includes(row.status)
