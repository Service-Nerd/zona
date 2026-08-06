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
