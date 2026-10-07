// MATCH-EMPTY-CAUSE-01 (2026-10-07) — why the manual-link picker is empty.
//
// One message served three causes, and it named the one that was innocent. The
// founder moved a session, ran it, and found nothing to link: the copy said
// "near this session date", so the date window was the suspect. The pipe was
// empty. `strava_activities` had held nothing for 17 days because the Apple
// Health *Workouts* permission was off.
//
// A pure function with its own owner rather than a ternary in the JSX, because
// the three causes need three different actions from the runner and the only
// way to prove which one renders is to be able to call it.

export type MatchEmptyCause =
  /** Nothing has ever reached the app. A connection problem, not a date problem. */
  | 'no_runs'
  /** Runs exist, none inside the link window. The original, correct message. */
  | 'none_near_date'
  /** Runs exist inside the window, all already linked to other sessions. */
  | 'all_claimed'

/**
 * @param pooled   every run the screen holds, before ANY filter
 * @param inWindow those inside `isInLinkPool`'s window, before the claimed filter
 *
 * Only called when the rendered list is empty, so `inWindow > 0` means every
 * in-window run was claimed by another session.
 */
export function matchEmptyCause({ pooled, inWindow }: { pooled: number; inWindow: number }): MatchEmptyCause {
  if (pooled === 0) return 'no_runs'
  if (inWindow === 0) return 'none_near_date'
  return 'all_claimed'
}

/**
 * The runner-facing sentence per cause.
 *
 * ⚠️ VOICE, not design (`brand.md`, and CLAUDE.md puts copy tone there rather
 * than with the Design Board): one sentence where one will do, specific over
 * abstract, never motivational. "Worth checking" is the register already
 * approved for `HR went high. Worth checking.`
 *
 * ⚠️ NO EM DASH: these are sentences the runner reads, which is exactly the
 * scope the founder settled on 2026-09-22. Guarded by `noEmDashApp.test.ts`,
 * which reads string literals, so these are covered where JSX text was not.
 *
 * ⚠️ IT NEVER NAMES THE CAUSE IT CANNOT KNOW. A denied HealthKit read resolves
 * EMPTY, not as an error, so "no runs have synced" is a fact and "your
 * permission is off" would be a guess. See `health_sync_swept`.
 */
export function matchEmptyCopy(cause: MatchEmptyCause): string {
  switch (cause) {
    case 'no_runs':        return 'No runs have synced yet. Worth checking your health connection.'
    case 'all_claimed':    return 'Every run near this date is already linked to another session.'
    case 'none_near_date': return 'No activities found near this session date'
  }
}
