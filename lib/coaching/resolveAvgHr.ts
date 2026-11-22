// SESSION-COMPLETION-AVG-HR-STALE-01 (narrow) — which average heart rate a coach read quotes.
//
// `session_completions.avg_hr` is a copy taken ONCE, when the run is linked to its session
// (`lib/coaching/autoAnalyse.ts` claimAutoLink). Apple Watch heart rate lands AFTER the workout, so a run linked before
// its HR arrived keeps NULL there for good: nothing on the late-HR path writes the completion. ADR-011 makes the
// activity row the system of record for run metrics and the completion the owner of RPE, fatigue and link ids only.
// Measured 2026-11-22: a run stored avg_hr 153 on the activity and null on the completion, and the post-run reframe
// read the completion.
//
// The completion's own value still wins when present (a manual log writes it), so no existing read changes.
const valid = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0

export function resolveAvgHr(completionAvgHr: number | null | undefined, activityAvgHr: number | null | undefined): number | null {
  if (valid(completionAvgHr)) return completionAvgHr
  return valid(activityAvgHr) ? activityAvgHr : null
}
