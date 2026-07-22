// RESHAPE-FIX-WAVE2B — Completion verification helper
//
// A completion is "verified" when it carries at least one signal beyond
// the bare "user said done" tap. Concretely: an activity link
// (Strava / HealthKit), or an RPE input, or a fatigue tag.
//
// Doctrine (ADR-011 §3, strengthened 2026-06-26):
//   RPE is user input always — never overridden by device data.
//   A completion without ANY signal is not a verified session.
//   Downstream coaching surfaces must not treat unverified completions
//   as equivalent to verified runs for analytics purposes.
//
// The WRITE path now gates the user-facing flow so future completions
// always carry at least RPE (see DashboardClient.tsx RESHAPE-FIX-WAVE2B
// edits to handleMarkComplete + the two "Mark as done" / "Confirm
// complete" buttons). This helper exists so historical bare stubs AND
// any defensive-write that slips through are filterable at the READ
// boundary by the six AI-DEPTH-01 coaching surfaces.
//
// Read-boundary audit COMPLETE (RESHAPE-FIX-WAVE2B-AUDIT, 2026-07-22):
//   - daily-coach-note, weekly-report, phase-summary, race-readiness now filter
//     their completion COUNTS through isVerifiedCompletion.
//   - analyse-run (422s without an activity ref) and adjust-plan (filters
//     `.not(fatigue_tag, is, null)`) are self-protecting — documented in place.
//   - weekly-report's `completedDays` (missed-session detection) intentionally
//     does NOT filter: a bare "done" tap is attendance, not a miss.
//
// ⚠️ GUARDRAIL for any FUTURE consumer: this predicate reads the activity-link
// columns (strava_activity_id, apple_health_uuid) as verification signals. If
// your `.select(...)` omits them, an activity-linked run with no RPE/HR (e.g.
// phone-only Strava) is misclassified as a bare stub and DROPPED. Always select
// the CompletionVerificationInput columns you rely on before filtering.

export interface CompletionVerificationInput {
  status?:              string | null
  rpe?:                 number | null
  fatigue_tag?:         string | null
  avg_hr?:              number | null
  strava_activity_id?:  number | string | null
  apple_health_uuid?:   string | null
  strava_activity_name?: string | null
  strava_activity_km?:  number | string | null
}

/**
 * Return true if the completion carries at least one verification signal.
 *
 * Used by the coaching surfaces to gate analytics that should not
 * treat "user tapped done with no data" as equivalent to a logged run.
 * Pure function; safe to call on any row shape that includes the
 * canonical session_completions columns.
 */
export function isVerifiedCompletion(c: CompletionVerificationInput | null | undefined): boolean {
  if (!c) return false
  if (c.status === 'skipped') return true  // skip-with-reason carries a fatigue_tag by definition
  if (c.rpe         != null) return true
  if (c.fatigue_tag != null && c.fatigue_tag !== '') return true
  if (c.avg_hr      != null) return true
  if (c.strava_activity_id   != null) return true
  if (c.apple_health_uuid    != null && c.apple_health_uuid !== '') return true
  if (c.strava_activity_name != null && c.strava_activity_name !== '') return true
  if (c.strava_activity_km   != null) return true
  return false
}

/**
 * True iff the row is a bare-stub — `status='complete'` with no signal
 * of any kind. The pre-Wave-2B incident phantom completion has this
 * shape: id 5d13a19b, week 23, session_day='sun', status='complete',
 * everything else null. This predicate is the read-side mirror of the
 * WRITE-side gate; any consumer that wants to exclude bare stubs from
 * analytics should call it.
 */
export function isBareStubCompletion(c: CompletionVerificationInput | null | undefined): boolean {
  if (!c) return false
  return c.status === 'complete' && !isVerifiedCompletion(c)
}
