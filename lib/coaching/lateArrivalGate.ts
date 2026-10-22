// HR-SYNC-01: Late-arrival coaching-correctness gate (Hutchinson).
//
// When HR samples arrive on a row that was previously HR-null, two ingest
// paths converge here to ask: "is this still a fresh coaching moment, or has
// it aged out?"
//
//   - inside the window: trigger /api/analyse-run so the score card, reframe,
//     and coach note reflect real HR
//   - outside the window: patch the HR columns for archival use (zone ledger,
//     weekly report, fitness signals) but do NOT fire a fresh reframe — the
//     runner has moved on, two-day-stale coaching is dishonest
//
// The window is shared with the pending-state UX in `hrPending.ts` so the
// "we're waiting for HR" expectation and the "we'll coach when HR arrives"
// promise match exactly.

import { PENDING_HR_WINDOW_HOURS } from './hrPending'

const HOURS_TO_MS = 60 * 60 * 1000

export interface LateArrivalInput {
  /** ISO start_date of the workout. */
  workoutStartIso: string
  /** Duration in seconds — added to start to compute workout end. */
  durationSeconds: number
}

export interface LateArrivalDecision {
  /** True when the workout ended within `PENDING_HR_WINDOW_HOURS` of `now`. */
  withinFreshWindow: boolean
  /** Workout-end ms since epoch. */
  workoutEndMs: number
  /** How late HR landed, in seconds since workout end. Useful for instrumentation. */
  secondsSinceEnd: number
}

/**
 * Pure decision. `now` is injected so callers can be unit-tested deterministically.
 *
 * If `workoutStartIso` is unparseable, treats it as "fresh" — we'd rather
 * re-fire analyse-run on a parse glitch than silently drop coaching.
 */
export function decideLateArrival(input: LateArrivalInput, now: Date): LateArrivalDecision {
  const startMs = new Date(input.workoutStartIso).getTime()
  if (!Number.isFinite(startMs)) {
    return { withinFreshWindow: true, workoutEndMs: now.getTime(), secondsSinceEnd: 0 }
  }
  const workoutEndMs   = startMs + input.durationSeconds * 1000
  const secondsSinceEnd = Math.max(0, Math.floor((now.getTime() - workoutEndMs) / 1000))
  const withinFreshWindow = secondsSinceEnd <= PENDING_HR_WINDOW_HOURS * 60 * 60
  return { withinFreshWindow, workoutEndMs, secondsSinceEnd }
}

/**
 * HR-LATE-STAMP-01 — the one writer of `hr_arrived_late_at`. Its migration defines it as *"timestamp when HR was patched
 * onto a previously HR-null row"*: EVERY late arrival, not only the ones past the fresh window. Both ingest paths
 * stamped only past 24 h, so 29 of the 32 runs that gained HR carried no stamp (measured 2026-10-22, lags 0.1–23.9 h)
 * and any count read from the column undercounted ten-fold. Whether to coach is still `decideLateArrival`'s call; the
 * column only records that HR came late, and when.
 */
export function hrArrivalStamp(now: Date): { hr_arrived_late_at: string } {
  return { hr_arrived_late_at: now.toISOString() }
}
