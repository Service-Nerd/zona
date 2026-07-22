import { TRIAL_DAYS } from '@/lib/trial'

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

/**
 * Decide which trial emails are due for a user on a given trial day.
 *
 * Windows are disjoint: the nudge window is [NUDGE_DAY, EXPIRY_DAY); once the
 * user is at/past EXPIRY_DAY the expiry email supersedes the nudge. A set stamp
 * suppresses that email (idempotent across daily cron runs).
 */
export function decideTrialEmails(day: number, stamps: TrialEmailStamps): TrialEmailDecision {
  return {
    needsDay11: day >= NUDGE_DAY && day < EXPIRY_DAY && !stamps.trial_email_day11_sent_at,
    needsDay14: day >= EXPIRY_DAY && !stamps.trial_email_day14_sent_at,
  }
}
