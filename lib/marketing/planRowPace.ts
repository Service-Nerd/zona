// MKT-STEP-CEILING-BAND-01 (Design Board 2026-11-16) — how a published plan page's session row
// states its pace. One line, extracted, for one reason: **the gate could not otherwise test it.**
//
// 🔴 The row lives inside `PlanPage`, a client component, so a node test cannot render it. My first
// gate "proved" the row behaviour by calling `easyPaceAsCeiling` **in the test harness** and
// asserting the result — which tests the harness, not the page. Two mutations (restoring the raw
// `s.pace_target`, and over-reducing by passing a hardcoded `'easy'`) left those arms GREEN and
// were caught only by a string match on the source. **An arm that recomputes the subject is not a
// check**, so the expression moved here and both now call the same function.
import { easyPaceAsCeiling } from '@/lib/plan/easyPaceCeiling'

/**
 * The pace a session row prints, reduced to its CEILING where the session has one.
 *
 * ⚠️ It passes the session's REAL type, so `easyPaceAsCeiling` reduces easy / recovery / run and
 * leaves a quality band alone. That asymmetry is the point: §12 caps an easy run at the top of Z2
 * and running slower is still correct, so a range invents a boundary the plan does not set — while
 * a quality band IS a two-ended target and reducing it would delete half the prescription.
 */
export function planRowPace(session: { type?: string | null; pace_target?: string | null }): string | null {
  return easyPaceAsCeiling(session.pace_target, session.type ?? '') ?? null
}
