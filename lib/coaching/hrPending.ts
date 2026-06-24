// HR-SYNC-01: Pending-state classification for HealthKit-sourced runs.
//
// Decides whether a row is in the "pending HR" state (Apple Watch sync hasn't
// caught up yet), the "fallback" state (the run has aged past the point we
// expect sync to land), or has resolved with HR present. Pure function — UI
// callers map the result onto card states; backend callers use it to gate
// retries and the late-arrival coaching trigger.
//
// Boundary at 24h is the same one used by the late-arrival gate
// (`lib/coaching/lateArrivalGate.ts`): inside the window we treat HR as
// "still expected to arrive"; outside we treat it as "if it ever arrives now,
// the coaching moment has passed."

export type HrPendingState =
  /** HR is present on the row. No pending UI. Normal coaching surfaces apply. */
  | 'has-hr'
  /** Apple Watch sync expected — < 24h since workout end, HR-null HK row. */
  | 'pending'
  /** Sync didn't land — > 24h since workout end, HR-null HK row. UI shows the manual-retry fallback. */
  | 'fallback'
  /** Not an Apple Health row, or no end timestamp — pending logic doesn't apply. */
  | 'not-applicable'

export interface HrPendingInput {
  source:        string | null
  avg_hr:        number | null
  /** ISO start_date of the workout — start of the canonical run window. */
  start_date:    string | null
  /** Duration (s) — start_date + moving_time_s yields the run's end. */
  moving_time_s: number | null
}

/** Window after which we stop expecting Apple Watch sync to land (Hutchinson + Wood). */
export const PENDING_HR_WINDOW_HOURS = 24

const HOURS_TO_MS = 60 * 60 * 1000

/**
 * Pure classification. `now` is injected so the callers can be unit-tested
 * deterministically.
 */
export function classifyHrPending(row: HrPendingInput, now: Date): HrPendingState {
  if (row.source !== 'apple_health') return 'not-applicable'
  if (row.avg_hr != null) return 'has-hr'
  if (!row.start_date || row.moving_time_s == null) return 'not-applicable'

  const startMs = new Date(row.start_date).getTime()
  if (!Number.isFinite(startMs)) return 'not-applicable'
  const endMs = startMs + row.moving_time_s * 1000
  const ageMs = now.getTime() - endMs

  if (ageMs < 0) return 'pending'  // clock skew — treat as fresh
  return ageMs <= PENDING_HR_WINDOW_HOURS * HOURS_TO_MS ? 'pending' : 'fallback'
}

/** Convenience wrapper for the common predicate "should the UI show pending or fallback?". */
export function isHrPending(row: HrPendingInput, now: Date): boolean {
  const state = classifyHrPending(row, now)
  return state === 'pending' || state === 'fallback'
}
