// GTM-CHARITY-04 — the single owner of "when does a charity grant end?".
//
// Founder decision 2026-09-11: race date + 7 days. Wood's structural argument
// is that an expiry must never land mid-block — removing the scaffolding in
// week twelve of sixteen is worse than never granting it — and the week after
// the race is the only point where withdrawal is behaviourally safe, because
// the behaviour has completed its cycle.
//
// The chicken-and-egg: at redemption there is no plan and therefore no race
// date, and for a marathon runner building the plan is itself the thing the
// grant unlocks. Hence a provisional window that the race date then re-anchors.
//
// Pure functions of their inputs, `now` included. Nothing here reads the clock,
// so every rule is testable at a pinned instant (INV-TIME-001's habit).

const DAY_MS = 24 * 60 * 60 * 1000

/** Provisional window granted at redemption, before any plan exists.
 *
 *  Deliberately SHORT rather than generous. It has to be shorter than a typical
 *  training block, otherwise it, not the race date, would be the value that
 *  actually binds and the race+7d rule would never fire. A runner who redeems
 *  and never builds a plan lapsing at 90 days is the correct outcome: they did
 *  not use the gift. */
export const INITIAL_GRANT_DAYS = 90

/** Hard ceiling measured from redemption.
 *
 *  Re-anchoring is extend-only, so without a ceiling a runner could hold the
 *  grant open indefinitely by entering a new race each season. 18 months is
 *  past any single block we generate (the longest plan we ship is 18 weeks)
 *  plus a deferral, which is the legitimate case the ceiling must not punish. */
export const GRANT_CEILING_DAYS = 18 * 30

/** Days of access after race day. The conversion moment, and the only safe
 *  point to withdraw: they have just finished, and are deciding whether to
 *  keep running. */
export const POST_RACE_GRACE_DAYS = 7

/** The window granted the moment a code is redeemed. */
export function initialGrantExpiry(now: Date): Date {
  return new Date(now.getTime() + INITIAL_GRANT_DAYS * DAY_MS)
}

/**
 * Re-anchor an existing grant to a plan's race date.
 *
 * EXTEND-ONLY, on purpose. A deferred or changed race extends the grant; a
 * runner switching from a marathon to a 10K does not have access clawed back.
 * "Your access just shrank" is a support ticket and a broken promise, and the
 * marginal cost of the extra weeks is zero.
 *
 * Returns the new expiry, or the current one unchanged when the race date adds
 * nothing. Callers may compare against `currentExpiry` to skip a pointless
 * write.
 */
export function reanchorGrantExpiry(args: {
  /** When the code was redeemed. The ceiling is measured from here. */
  grantedAt: Date
  /** The grant's current end date. */
  currentExpiry: Date
  /** Race date from the plan the runner just saved. */
  raceDate: Date
}): Date {
  const { grantedAt, currentExpiry, raceDate } = args

  const racePlusGrace = raceDate.getTime() + POST_RACE_GRACE_DAYS * DAY_MS
  const ceiling = grantedAt.getTime() + GRANT_CEILING_DAYS * DAY_MS

  // max() is the extend-only rule; min() applies the ceiling. Order matters:
  // clamping after taking the max means a race far in the future is capped
  // rather than granted in full.
  const next = Math.min(Math.max(currentExpiry.getTime(), racePlusGrace), ceiling)

  // A grant already past the ceiling (only reachable if the ceiling were ever
  // shortened) must not be pulled backwards — extend-only means exactly that.
  return new Date(Math.max(next, currentExpiry.getTime()))
}

/** Is a grant live at `now`? The question getUserTier asks. */
export function isGrantActive(expiresAt: Date | null | undefined, now: Date): boolean {
  if (!expiresAt) return false
  return expiresAt.getTime() > now.getTime()
}
