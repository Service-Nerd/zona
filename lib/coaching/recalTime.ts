// Recalibration time-trial result — pure time helpers (FORMS-PRIM-01, 2026-09-13).
//
// The entry screen moved from a free-text `mm:ss` input to the shared wheel
// DurationPicker (no keyboard, no format-guessing, no iOS zoom trap — the same
// reasons RaceResultSheet's finish time uses it). The wheel yields minutes +
// seconds; these functions own the arithmetic, the plausibility window and the
// display string so the component stays presentational and the rules are tested.

/** Fastest plausible time trial for the supported distances (5K/10K). Below
 *  this is a mis-entry, not a result. */
export const RECAL_MIN_SECONDS = 12 * 60
/** Slowest plausible time trial. 60:00 exactly is allowed; past it is not. */
export const RECAL_MAX_SECONDS = 60 * 60

export function recalSecondsFromParts(mins: number, secs: number): number {
  return mins * 60 + secs
}

export function isRecalTimeInRange(seconds: number): boolean {
  return seconds >= RECAL_MIN_SECONDS && seconds <= RECAL_MAX_SECONDS
}

/** mm:ss for display (eyebrow on the applied state). Minutes are not padded
 *  (a time trial is never hours); seconds always are. */
export function formatRecalTime(mins: number, secs: number): string {
  return `${mins}:${String(secs).padStart(2, '0')}`
}

/** A plausible starting point so the runner nudges the wheel rather than
 *  scrolling from zero — ~5 min/km, clamped into the valid window. */
export function defaultRecalMins(distanceKm: number): number {
  const lo = Math.ceil(RECAL_MIN_SECONDS / 60)   // 12
  const hi = Math.floor(RECAL_MAX_SECONDS / 60)  // 60
  const est = Math.round(distanceKm * 5)
  return Math.min(hi, Math.max(lo, est))
}
