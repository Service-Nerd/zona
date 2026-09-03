// ADR-020 / CB-2 — validation of foundation weeks (`phase: 'foundation'`, n <= 0).
//
// Foundation weeks are built by `generateFoundationBlock` and prepended to the
// plan AFTER it leaves the server, so the `validatePlan()` run inside
// `generateRulePlan()` never sees them. Until ADR-020 Option A moves that
// construction server-side, this is the only validation they get.
//
// ── Why this file exists rather than an inline helper ────────────────────────
//
// The previous inline version filtered by invariant CODE:
//
//     .filter(v => v.code === 'INV-PLAN-FOUNDATION-BLOCK')
//
// which is the wrong axis. It answered "did the foundation-specific invariant
// fire?" when the question is "is anything wrong with these weeks?". Measured on
// the founder's real input with FOUNDATION-DAYS-01 reinstated: `validatePlan`
// found 4 INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS violations on the foundation
// weeks and the filter discarded all 4. The live code detected the bug and threw
// the answer away.
//
// Filtering by WEEK is the correct axis: report everything that lands on a
// foundation week, whichever invariant found it. Main weeks are excluded because
// the server already validated them — reporting them here would duplicate, not
// add.

import { validatePlan } from './invariants'
import type { Violation } from './invariants'
import type { Plan, GeneratorInput } from '@/types/plan'

/** A week the server never validated: foundation weeks carry n <= 0 (§57). */
export function isFoundationWeek(week: { n: number }): boolean {
  return week.n <= 0
}

/**
 * Every error-severity violation landing on a foundation week of `assembled`.
 *
 * `assembled` must be the FULL plan (foundation weeks + main weeks): several
 * invariants are plan-wide or compare across weeks, so validating the foundation
 * block in isolation would both miss violations and invent them.
 *
 * Never throws — a validation problem must not stop a runner seeing their plan
 * (ADR-006). A malformed plan yields an empty list and the caller logs it.
 */
export function foundationWeekViolations(
  assembled: Plan,
  input: GeneratorInput,
): Violation[] {
  try {
    return validatePlan(assembled, input)
      .filter(v => v.severity === 'error')
      .filter(v => v.week != null && v.week <= 0)
  } catch {
    return []
  }
}
