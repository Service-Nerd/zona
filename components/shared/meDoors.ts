// ME-DOORS-01 — the door labels, named once.
//
// A door's row label and the screen's own title are the same string by definition: the
// runner taps a word and expects to arrive at it. Written out twice they drift, and the
// drift is invisible because each surface reads correctly on its own.
//
// `PREFERENCES_TITLE` lives in `PreferencesScreen.tsx` because that screen owns its own
// title; these are the doors whose screen is composed inline in `DashboardClient`.

export const HEART_RATE_TITLE = 'Heart rate'

/** ⚠️ The unset state, and it is a NUDGE, not a label.
 *
 *  It replaces an amber card reading *"Set your resting and max HR BELOW to see your
 *  training zones"* — a sentence whose last word the door makes false. Zones are what the
 *  runner loses, so the consequence is what the subtitle names. No em dash: the app guard
 *  (`noEmDashApp.test.ts`) covers every string literal under `components/`. */
export const HEART_RATE_UNSET_SUB = 'Not set, so your zones are estimated'

export const PLAN_ADJUSTMENTS_TITLE = 'Plan adjustments'
export const PLAN_ADJUSTMENTS_SUB = 'Auto-adjust, and what the engine watches'

/** ⚠️ A pending change is the one state the runner must not have to go looking for.
 *  It is the only subtitle that names an action waiting on them. */
export const PLAN_ADJUSTMENTS_PENDING_SUB = 'A change is waiting for you'
