// PV2-H / ADR-014 / CD-13 — the recalibration-completion trigger.
//
// The plan schedules a 5K time trial in each recalibration (deload) week and
// tells the runner their paces will update from the result. ADR-014: that
// rewrite is PROMPTED + CONFIRMED (never silent — a single 5K is noisy;
// §69/ADR-012 require a structural change to earn confirmation), via the
// existing applyRecalibration → /api/recalibrate-zones path (paid).
//
// This is the engine-side core the client asks: "is a recalibration-week time
// trial completed but not yet applied?" It is a pure function of the plan + the
// runner's completions + the weeks already recalibrated, so it is fully
// testable. The client surfaces the returned week as a pending-adjustment tile
// (no modal), and on confirm posts the measured time to /api/recalibrate-zones.
//
// The time trial is deliberately typed `hard` (so it doesn't count against the
// beginner quality cap), which is why the existing `fitness_signal` bridge —
// built from {quality, intervals, tempo} — can't see it. ADR-014 chose this
// dedicated trigger over widening that set, so a maximal effort never
// contaminates the AEF / zone-drift signals.
import type { Plan } from '@/types/plan'

export interface CompletionRef {
  week_n: number
  session_day: string
}

/**
 * The earliest recalibration week whose time trial is completed and not yet
 * applied, or null. `appliedWeeks` are the recalibration weeks the runner has
 * already recalibrated from (the caller tracks this — a recalibration should
 * fire once per checkpoint).
 */
export function nextRecalibrationDue(
  plan: Plan,
  completions: CompletionRef[],
  appliedWeeks: number[] = [],
): { week_n: number; session_day: string } | null {
  const recalWeeks = plan.meta?.recalibration_weeks ?? []
  if (recalWeeks.length === 0) return null
  const applied = new Set(appliedWeeks)

  for (const wn of [...recalWeeks].sort((a, b) => a - b)) {
    if (applied.has(wn)) continue
    const week = plan.weeks.find(w => w.n === wn)
    if (!week) continue
    // The recalibration time trial is the week's `hard` session.
    const ttEntry = (Object.entries(week.sessions ?? {}) as [string, { type?: string } | undefined][])
      .find(([, s]) => s?.type === 'hard')
    if (!ttEntry) continue
    const ttDay = ttEntry[0]
    if (completions.some(c => c.week_n === wn && c.session_day === ttDay)) {
      return { week_n: wn, session_day: ttDay }
    }
  }
  return null
}

/**
 * The declared recalibration weeks that hold NO benchmark session.
 *
 * 🧭 `TT-SKIPPED-VISIBILITY-01` — Design Board 2026-11-14, SHIP WITH AMENDMENT. §78's fallback
 * drops a recalibration week when no slot fits, and since §78 Am.2 a slot beside the long run
 * does not fit either. `nextRecalibrationDue` above says `if (!ttEntry) continue` — correct for
 * its own question and **silent**: every declared week falls through, the function returns null,
 * and the runner finishes the block on the paces they started with, with nothing saying why.
 *
 * 📐 Measured on 43 live plans: **6 of the 14 that declare recalibration weeks hold no benchmark
 * session at all.** `INV-PLAN-RECALIBRATION-HAS-SESSION` is error-severity and `npm run
 * audit:stored` reports all six; a live plan cannot be rewritten in place
 * (`regenRefusalReason`), so the runner-facing half is all that is left to do.
 *
 * ⚠️ RETURNS THE WEEKS, NOT A BOOLEAN. The caller needs the earliest one to decide WHEN to speak
 * — a plan declaring weeks 3 and 6 should not announce an absence in week 1.
 *
 * ⚠️ EMPTY MEANS "NOTHING TO SAY", AND THAT COVERS TWO DIFFERENT CASES ON PURPOSE: a plan that
 * declares nothing (29 of 43 live plans — a sentence about nothing), and a plan whose declared
 * weeks all hold their session (the healthy case). The board scoped the sentence to a plan that
 * declares a week and holds none, so a PARTIAL absence returns empty too: the runner still gets
 * a benchmark, so they have not lost the thing the sentence is about.
 */
export function benchmarkAbsentWeeks(plan: Plan): number[] {
  const declared = plan.meta?.recalibration_weeks ?? []
  if (declared.length === 0) return []
  const absent = declared.filter(wn => {
    const week = plan.weeks.find(w => w.n === wn)
    // A declared week that is not in the plan at all is also an absence: there is no session
    // to run either way. (`INV-PLAN-RECALIBRATION-HAS-SESSION` raises its own error for it.)
    if (!week) return true
    return !Object.values(week.sessions ?? {}).some(s => s?.type === 'hard')
  })
  // Partial is not loss: if ANY declared week holds its benchmark, the runner gets one.
  return absent.length === declared.length ? [...absent].sort((a, b) => a - b) : []
}
