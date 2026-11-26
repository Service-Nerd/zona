// FREE — infrastructure. ADR-027 B3 step 4b (ADR027-B3-REMAINING): the trigger vocabulary.
//
// The ten adjustment trigger types, moved here from `lib/coaching/planAdjustment.ts` so L2's
// catalogue can name them without importing the detector. ⚠️ **That import is the reason for the
// move, not tidiness:** `planAdjustment.ts` pulls in `invariants`, `scaleSessionAnchors`,
// `sessionRole` and `weekSessions`, so a catalogue that imported it to learn ten strings would drag
// the whole adjustment engine into L2 and invert ARCH-ENG-001. Same shape as `runOutcome.ts` in 4a.
//
// ⚠️ `planAdjustment.ts` RE-EXPORTS these, so every existing consumer and `TriggerType`'s derivation
// are untouched and there is still exactly ONE definition.
//
// ── THE ARRAY IS THE SOURCE AND THE TYPE IS DERIVED, carried over from its old home ─────────────
// `scripts/backtest-adjustment-triggers.ts` had hand-written its own copy of these ten, and the
// compiler caught it diverging the moment `'manual'` was removed. A vocabulary with two
// hand-maintained copies is this repo's most-recorded defect shape.

export const TRIGGER_TYPES = [
  'acute_chronic_high',   // load ratio spike vs 4-week rolling avg
  'zone_drift',           // easy runs running too hard (HR score + RPE fallback)
  'shadow_load',          // actual km > planned km by threshold
  'ef_decline',           // aerobic efficiency drop over 4-week window
  'fatigue_accumulation', // N consecutive heavy/wrecked sessions
  'skip_with_reason',     // user-initiated: session skipped with a reason
  'session_reorder',      // user-initiated: session moved to another day
  'readiness_signal',     // pre-session RHR / HRV / sleep deviation
  'fitness_signal',       // ENGINE-01: quality faster than band with HR controlled -> benchmark recal prompt
  'long_run_shortfall',   // ENGINE-02: consecutive long runs under planned distance -> reduce prescription
] as const

export type TriggerType = typeof TRIGGER_TYPES[number]

/**
 * The eight the product could honestly claim to WATCH FOR. The other two are the runner telling us,
 * not us noticing — and that distinction is the whole reason the marketing number is eight, not ten.
 */
export const DETECTED_TRIGGER_TYPES = TRIGGER_TYPES
  .filter(t => t !== 'skip_with_reason' && t !== 'session_reorder')
