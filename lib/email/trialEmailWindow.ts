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
/** Expiry fires on/after this day. */
export const EXPIRY_DAY = TRIAL_DAYS

// ── ACT-EMAIL-POSTTRIAL-01 — the two post-trial sends ───────────────────────
// 📐 Nothing at all was sent after day 14: `trial_email_day11_sent_at` and `day14` were the only
// stamps on `user_settings`, and `ops_events.email_sent` holds no post-trial id.

/** Three days after expiry: extend, or summarise what we saw. */
export const DAY17 = EXPIRY_DAY + 3
/** One question, no follow-up. Open-ended, so it always lands once. */
export const DAY30 = 30

// ── QUIET HOURS ─────────────────────────────────────────────────────────────
// 📐 MEASURED 2026-11-11, and this is a live defect rather than a formality. The trial email
// cron ran ONCE DAILY at 08:00 UTC, which is **03:00 for the 4 of 37 runners in New York and
// Toronto**. Every runner in the metric population has a timezone set, so this is knowable.
//
// 🔴 AND THE OBVIOUS FIX IS A TRAP. Adding a quiet-hours guard to a ONCE-DAILY cron is not a
// deferral, it is PERMANENT SUPPRESSION: the local hour is the same every run, so a runner whose
// local hour falls outside the window never receives the email at all. The window only reopens
// if the sender runs more often than the window is wide. **The cron moved to hourly in the same
// commit** (`.github/workflows/email-cron-trial.yml`), which is what makes this a deferral.
// `lib/email/quietHours.test.ts` asserts that pairing, because the guard and the schedule are
// one decision in two files.

/** Send only inside the runner's own waking hours, local time. */
export const SEND_HOUR_FROM = 8
export const SEND_HOUR_UNTIL = 20

/**
 * Is it a civil hour to arrive in this runner's inbox?
 *
 * ⚠️ `null` means we could not work out their local hour, and it answers TRUE. Refusing to send
 * to someone whose timezone we cannot read would turn an unknown into a permanent silence, and
 * the stamp still guarantees exactly one send. Measured: 0 of 37 runners are in that state.
 */
export function withinSendHours(localHour: number | null): boolean {
  if (localHour == null) return true
  return localHour >= SEND_HOUR_FROM && localHour < SEND_HOUR_UNTIL
}

/**
 * The runner's local hour, or null if the zone is unusable.
 * ⚠️ Wrapped: an invalid IANA name throws from `Intl`, and a bad string in one row must not
 * stop the whole cron for everyone else.
 */
export function localHourIn(timezone: string | null | undefined, now: Date): number | null {
  if (!timezone) return null
  try {
    const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: timezone })
      .format(now)
    const n = Number(h)
    return Number.isFinite(n) ? n % 24 : null
  } catch { return null }
}

/** 1-indexed trial day: the day the trial started is day 1. */
export function trialDayNumber(trialStartedAt: string, now: Date): number {
  const start = new Date(trialStartedAt).getTime()
  return Math.floor((now.getTime() - start) / MS_PER_DAY) + 1
}

export interface TrialEmailStamps {
  trial_email_day11_sent_at: string | null
  trial_email_day14_sent_at: string | null
  trial_email_day17_sent_at: string | null
  trial_email_day30_sent_at: string | null
}

export interface TrialEmailDecision {
  /** The pre-expiry nudge (legacy "day 11"). */
  needsDay11: boolean
  /** The expiry email (legacy "day 14"). */
  needsDay14: boolean
  /** Three days after expiry: extend, or summarise. */
  needsDay17: boolean
  /** One question, no follow-up. */
  needsDay30: boolean
}

/** Whose access story this actually is. Required, not optional: the dangerous
 *  default here is "send", so the compiler makes every caller answer it. */
export interface TrialEmailAccess {
  /** Resolved by `resolveTier`. `paid` means the trial is not what ends. */
  tier: UserTier
  /** Has EVER claimed a charity code — live OR lapsed. See below. */
  hasCharityGrant: boolean
  /**
   * `user_settings.is_internal` (INTERNAL-ACCOUNTS-01). REQUIRED for the same reason the other
   * two are: the dangerous default is SEND. The brief asks that internal accounts never receive
   * these, and 18 of 56 accounts are internal — a third of the list.
   */
  isInternal: boolean
  /** The runner's local hour, from `localHourIn`. Null when the zone is unreadable. */
  localHour: number | null
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
  const none = { needsDay11: false, needsDay14: false, needsDay17: false, needsDay30: false }
  if (access.tier === 'paid' || access.hasCharityGrant || access.isInternal) return none
  // Not an exclusion but a DEFERRAL: the hourly cron asks again next hour, and the stamps still
  // guarantee exactly one send. See the note on SEND_HOUR_FROM.
  if (!withinSendHours(access.localHour)) return none

  return {
    needsDay11: day >= NUDGE_DAY && day < EXPIRY_DAY && !stamps.trial_email_day11_sent_at,
    // ⚠️ Each window is CLOSED at the next one's start, except the last. Day 14 used to be
    // open-ended, which was right when it was the final email; leaving it so would mean a
    // runner who had been quiet for a month received day 14 and day 17 and day 30 in one hour.
    needsDay14: day >= EXPIRY_DAY && day < DAY17 && !stamps.trial_email_day14_sent_at,
    needsDay17: day >= DAY17 && day < DAY30 && !stamps.trial_email_day17_sent_at,
    needsDay30: day >= DAY30 && !stamps.trial_email_day30_sent_at,
  }
}
