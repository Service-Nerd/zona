// ME-DOORS-01 — the door labels, named once.
//
// A door's row label and the screen's own title are the same string by definition: the
// runner taps a word and expects to arrive at it. Written out twice they drift, and the
// drift is invisible because each surface reads correctly on its own.
//
// `PREFERENCES_TITLE` lives in `PreferencesScreen.tsx` because that screen owns its own
// title; these are the doors whose screen is composed inline in `DashboardClient`.

export const HEART_RATE_TITLE = 'Heart rate'

/** ⚠️ RELOCATED, NOT REWRITTEN. This is the sublabel `HRZonesSection`'s own card header
 *  carried before the card became a screen. Moving it to the door's `ScreenHeader` keeps
 *  the words a runner reads identical while the title is said once. */
export const HEART_RATE_SUB = 'How hard. Training zones set from your resting and max HR.'

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

// ── ME-ORDER-01 (Design Board, 2026-09-28) ────────────────────────────────────

export const CONNECTIONS_TITLE = 'Connections'

/**
 * The Connections subtitle, which carries LIVE STATE rather than a label.
 *
 * 🔴 SILVANTO'S BLOCKING CONCERN, AND HOW IT IS ANSWERED. A connection row shows
 * connected-or-not, which a runner wants at a glance, and a door hides it. Rather than
 * granting Connections an exception to "nothing lives on Me", the state rides the row —
 * `ME-DOORS-01`'s own pattern, already shipped on `Heart rate → 51 / 185 bpm`.
 *
 * ⚠️ IT MAY NEVER ASSERT A NEGATIVE IT DOES NOT KNOW. `undefined` means the profile row
 * has not loaded; returning "No sources connected" then would flash a false negative on
 * every open. Unknown returns `null` and the row simply has no subtitle: *empty means
 * calm, not broken.*
 */
export function connectionsSubtitle(
  healthkitConnectedAt: string | null | undefined,
  stravaConnected: boolean,
): string | null {
  if (healthkitConnectedAt === undefined) return null      // not loaded — say nothing
  const on: string[] = []
  if (healthkitConnectedAt) on.push('Apple Health')
  if (stravaConnected) on.push('Strava')
  if (on.length === 2) return 'Apple Health and Strava'
  if (on.length === 1) return `${on[0]} connected`
  // ⚠️ The consequence, not a judgement — same shape as HEART_RATE_UNSET_SUB. Without a
  // source the runner marks sessions complete by hand, which is true and worth knowing.
  // ⚠️ 40 chars, PARALLEL TO `HEART_RATE_UNSET_SUB` ("Not set, so your zones are
  // estimated", 36 chars, one line at 375px). The first draft ran to 46 and WRAPPED TO TWO
  // LINES beside a sibling that fits one — caught by rendering it, not by reading it.
  // Two lines on an index row is density where the whole screen's job is to be left.
  return 'Not connected, so runs are added by hand'
}

/**
 * The Me index, in order. ONE list, so the screen and its gate cannot disagree.
 *
 * 🔴 THE ORDERING PRINCIPLE, stated because there is no telemetry and we should not
 * pretend otherwise: **most likely reason you came first, account lifecycle last,
 * destructive last.** Nobody reads Me; they arrive having already decided, and the only
 * question is how fast they can leave (Sierra).
 *
 * ⚠️ `null` marks a group with NO heading. A heading that governs one row is not a
 * heading — it is a category pretending to be content (Collins). `Preferences` and
 * `Connections` are single doors, so they share one unlabelled card instead of taking a
 * label each.
 */
export const ME_SECTION_ORDER: string[] = [
  'Your training',    // Heart rate · Race benchmark · Plan history · Plan adjustments
  'Setup',            // Preferences · Connections
  'Subscription',     // plan card · charity access · redeem a code
  'Support',
  'Careful Now',      // sign out · delete account
]

/**
 * 🔴 THE IDENTITY REGION HAS NO HEADING AND IS NOT IN THE LIST. Identity card, the
 * email row and "What Kit knows about you" sit above the first `SectionLabel`. That is the
 * ONLY unlabelled position that works, and finding out why cost a render:
 *
 *   **An unlabelled card placed after a heading INHERITS that heading.**
 *
 * `Preferences` and `Connections` were built as an unlabelled pair, on the argument that a
 * heading governing one door is not a heading. They rendered as part of `Your training` —
 * the exact defect the same change was fixing one section up, where `Plan adjustments` had
 * inherited `Connections`. The principle held; the count did not. The card holds TWO
 * doors, so `Setup` governs two items and is a legitimate heading.
 */

/** Every heading must govern at least this many items, or it is not a heading. */
export const MIN_ITEMS_PER_HEADING = 2
