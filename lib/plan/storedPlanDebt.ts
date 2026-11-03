import type { Plan } from '@/types/plan'
import type { Violation } from './invariants'
import { findWeekByN, isDatePastWeek } from './weekResolution'

/**
 * STORED-PLAN-DEBT-REPAIR-01 — THE SINGLE OWNER of "where in the runner's life does
 * this stored-plan violation sit?"
 *
 * 🔴 WHY THIS EXISTS. §134 stopped `/api/adjust-plan` refusing on violations the
 * reshape did not introduce, which was right, and which left **15 stored plans
 * carrying error-severity debt nothing refuses on any more.** The Coaching Board
 * filed the repair and put it out of scope: *"tolerating a breach is not fixing
 * it."* Willy's seat is the reason it is filed rather than noted, and his reason
 * was that the set includes load rules — *"those breaches exist today in plans
 * people are running."*
 *
 * ⚠️ **THAT SENTENCE CONTAINS AN UNMEASURED CLAIM, AND IT IS THE WHOLE ITEM.** A
 * violation in week 2 of a plan that started in June is not something a runner is
 * about to run — they already ran it, or they did not, and no rewrite reaches
 * backwards. Measured 2026-11-03: **9 of the 15 plans carry violations ONLY in
 * weeks already elapsed or at plan level.** Six carry one in a week still ahead.
 * Without this axis the debt reads three times larger than the part anyone can act
 * on, and the load rules Willy named are the clearest case: of four load breaches,
 * three are in weeks the runner has already lived through.
 *
 * ⚠️ `plan-level` IS ITS OWN POSITION, NOT A DEFAULT. `week: 0` means "plan-wide"
 * to the invariant layer — a missing `difficulty_band`, a compression
 * classification, an input contradiction. Measured 2026-11-03 there are **36** of
 * them against 34 genuinely ahead, so folding them into `ahead` would take the
 * actionable set from 6 plans to all 15 and roughly double the violation count;
 * folding them into `elapsed` would hide a plan that has never been annotated
 * correctly and never will be. It is the same `week: 0` ambiguity that produced 49
 * phantom audit violations on 2026-10-08, pointed at a different question.
 *
 * ⚠️ WHAT THIS DOES NOT ANSWER. Whether a breach is worth repairing (that is
 * `FLEET-TRIGGER-SEVERITY-01`'s prescription/declaration split, designed and
 * deliberately not built), and whether a rewrite is PERMITTED (that is
 * `regenRefusalReason`, which owns it and refuses all six). This answers only
 * where the breach sits in time.
 */

export type DebtPosition =
  /** In a week the runner has not finished yet — the only position a repair can reach. */
  | 'ahead'
  /** In a week whose 7-day window has closed. The runner has lived it. */
  | 'elapsed'
  /** `week: 0`, or a week number no week row carries: a property of the plan, not of a week. */
  | 'plan-level'

export interface PositionedDebt {
  ahead: Violation[]
  elapsed: Violation[]
  planLevel: Violation[]
}

/**
 * Where one violation sits, relative to `today`.
 *
 * ⚠️ IT ASKS `isDatePastWeek`, WHICH IS THE RATIFIED PREDICATE, and never compares
 * week numbers against a current-week index. §73: that pointer SATURATES at the
 * final week once the plan is over, so an index comparison reads the last week of
 * every finished plan as "current" — the in-flight-vs-done class that has bitten
 * the day boundary, the plan-complete surfaces and the post-race prompt.
 *
 * ⚠️ A FOUNDATION WEEK IS A WEEK. `week.n <= 0` is ADR-020's pre-plan runway and
 * those weeks carry real dates, so they position like any other — three of the six
 * actionable plans breach §12 in a foundation week that starts on 2026-11-16. Only
 * a week number NOTHING carries is plan-level.
 */
export function positionOf(plan: Plan, violation: Violation, today: Date): DebtPosition {
  if (typeof violation.week !== 'number') return 'plan-level'
  const week = findWeekByN(plan.weeks, violation.week)
  const date = (week as unknown as { date?: unknown } | undefined)?.date
  if (!week || typeof date !== 'string' || !date) return 'plan-level'
  return isDatePastWeek(week, today) ? 'elapsed' : 'ahead'
}

/** Split a stored plan's violations by position. Order within each list is preserved. */
export function positionStoredPlanDebt(
  plan: Plan,
  violations: readonly Violation[],
  today: Date,
): PositionedDebt {
  const out: PositionedDebt = { ahead: [], elapsed: [], planLevel: [] }
  for (const v of violations) {
    const p = positionOf(plan, v, today)
    if (p === 'ahead') out.ahead.push(v)
    else if (p === 'elapsed') out.elapsed.push(v)
    else out.planLevel.push(v)
  }
  return out
}
