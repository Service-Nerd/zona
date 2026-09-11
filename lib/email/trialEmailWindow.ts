import { TRIAL_DAYS, type UserTier } from '@/lib/trial'

// Trial-email send windows (EMAIL-CRON-01). Pure, side-effect-free decision so
// the send logic is unit-testable independently of the route + Supabase.
//
// The core rule (architectural-principles N-014): a scheduled send is gated on a
// lower-bounded, stamp-guarded RANGE, never exact-day equality. GitHub Actions
// cron is best-effort — a run skipped on the single matching day would lose an
// exact-match send forever. A `>=` window + idempotency stamp lets a missed day
// catch up on the next run while still sending exactly once.
//
// Both days derive from TRIAL_DAYS (single source in lib/trial.ts) so they can
// never drift from the trial length: nudge 3 days before expiry, expiry on the
// final trial day.

export const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Nudge fires from this day up to (but not including) EXPIRY_DAY. */
export const NUDGE_DAY = TRIAL_DAYS - 3
/** Expiry fires on/after this day (open-ended so it always lands once). */
export const EXPIRY_DAY = TRIAL_DAYS

/** 1-indexed trial day: the day the trial started is day 1. */
export function trialDayNumber(trialStartedAt: string, now: Date): number {
  const start = new Date(trialStartedAt).getTime()
  return Math.floor((now.getTime() - start) / MS_PER_DAY) + 1
}

export interface TrialEmailStamps {
  trial_email_day11_sent_at: string | null
  trial_email_day14_sent_at: string | null
}

export interface TrialEmailDecision {
  /** The pre-expiry nudge (legacy "day 11"). */
  needsDay11: boolean
  /** The expiry email (legacy "day 14"). */
  needsDay14: boolean
}

/** Whose access story this actually is. Required, not optional: the dangerous
 *  default here is "send", so the compiler makes every caller answer it. */
export interface TrialEmailAccess {
  /** Resolved by `resolveTier`. `paid` means the trial is not what ends. */
  tier: UserTier
  /** Has EVER claimed a charity code — live OR lapsed. See below. */
  hasCharityGrant: boolean
}

/**
 * Decide which trial emails are due for a user on a given trial day.
 *
 * Windows are disjoint: the nudge window is [NUDGE_DAY, EXPIRY_DAY); once the
 * user is at/past EXPIRY_DAY the expiry email supersedes the nudge. A set stamp
 * suppresses that email (idempotent across daily cron runs).
 *
 * ── WHO IS EXCLUDED, and why it is decided here rather than in the route ────
 *
 * These emails say "3 days left." and "Trial ends today", and the day-14 body
 * says "across your trial". For two groups that is simply false, and this route
 * had no tier check at all, so it sent to everyone with a `trial_started_at`:
 *
 *  1. `tier === 'paid'` — an admin, someone who SUBSCRIBED mid-trial (told "3
 *     days left" while paying), or a charity runner inside a live grant.
 *
 *  2. `hasCharityGrant` — anyone who has ever redeemed a charity code, even
 *     after it lapses. Tier alone does not cover this: once a grant expires the
 *     runner is `free` with an unset day-14 stamp, so the expiry email would
 *     fire months late and tell someone who was GIVEN the app that their
 *     14-day trial had ended. They never had a trial story to end.
 *
 * This matters more than an in-app screen because it is outbound email to a
 * charity partner's runners, which is the first thing Make-A-Wish's fundraisers
 * would see from us.
 */
export function decideTrialEmails(
  day: number,
  stamps: TrialEmailStamps,
  access: TrialEmailAccess,
): TrialEmailDecision {
  if (access.tier === 'paid' || access.hasCharityGrant) {
    return { needsDay11: false, needsDay14: false }
  }
  return {
    needsDay11: day >= NUDGE_DAY && day < EXPIRY_DAY && !stamps.trial_email_day11_sent_at,
    needsDay14: day >= EXPIRY_DAY && !stamps.trial_email_day14_sent_at,
  }
}
