// PLAN-CHANGE-FAIL-VISIBLE-01 (2026-10-16) — the one sentence a runner sees when a plan
// change did not save: the Adjust sheet, the change card, the readiness card and the
// Reshape screen. It was the Adjust sheet's own string, written once; the other three
// surfaces said nothing at all. One owner so the four cannot drift.
export const PLAN_CHANGE_SAVE_FAILED = 'Could not save that change. Try again.'

// 🔴 PLAN-CHECK-REFUSED-01 (2026-11-03) — a REFUSAL WAS SHOWN AS REASSURANCE.
//
// `/api/adjust-plan` returns `{ adjustment: null, message: 'No adjustment needed' }` on two
// completely different outcomes: the engine found nothing to change, and the engine REFUSED
// because the reshaped plan breaches its own rules (`reshape_invalid`). `ReshapeScreen` maps
// `adjustment: null` to `status: 'clean'`, which renders a green tick, **"Plan looks good."**
// and *"No adjustment signals in your recent sessions. Keep going."*
//
// Measured 2026-11-03: `validateReshapedPlan` returns EVERY error-severity violation in the
// plan (only two codes are week-scoped), so one historical defect anywhere makes every
// adjustment refuse — **18 of 39 live plans (46%)**, measured at 20 / 51% before the 2 plans
// §40b Am.4 had frozen were remediated. Those runners are told their plan looks good,
// by a check that declined to run, and `onChecked(false)` stamps "Last checked …" as a
// successful check that found nothing.
//
// A silent failure is bad. **A silent failure wearing a green tick is a false claim**, and
// CLAUDE.md's first rule for this product is that we do not tell the runner something we
// have not established.
//
// ⚠️ WORDING IS THE FOUNDER'S (brand.md owns voice). This is the honest minimum — it says
// what happened, blames the runner for nothing, promises nothing, and does not alarm them
// about a plan they cannot fix themselves. Replace it with his line when he gives one.
export const PLAN_CHECK_REFUSED = 'Could not check your plan this time. Nothing has changed.'
