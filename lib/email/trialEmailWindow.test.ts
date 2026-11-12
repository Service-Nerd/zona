import { describe, it, expect } from 'vitest'
import {
  trialDayNumber,
  decideTrialEmails,
  NUDGE_DAY,
  EXPIRY_DAY,
} from './trialEmailWindow'
import { TRIAL_DAYS } from '@/lib/trial'

const NO_STAMPS = {
  trial_email_day11_sent_at: null, trial_email_day14_sent_at: null,
  trial_email_day17_sent_at: null, trial_email_day30_sent_at: null,
}
/** ACT-EMAIL-POSTTRIAL-01 added two REQUIRED access facts; a default keeps these cases about
 *  the thing each one tests. `localHour: 10` is inside the send window. */
const SENDABLE = { isInternal: false, localHour: 10 }

/** The ordinary trial user these emails are actually written for. */
const ON_TRIAL = { tier: 'trial' as const, hasCharityGrant: false, ...SENDABLE }
/** Past day 14 with no grant and no subscription: the expiry email IS for them. */
const LAPSED   = { tier: 'free' as const,  hasCharityGrant: false, ...SENDABLE }

describe('trialEmailWindow constants', () => {
  it('derive from TRIAL_DAYS (single source, no re-typed literals)', () => {
    expect(EXPIRY_DAY).toBe(TRIAL_DAYS)      // 14
    expect(NUDGE_DAY).toBe(TRIAL_DAYS - 3)   // 11
  })
})

describe('trialDayNumber', () => {
  it('is 1-indexed: the start day is day 1', () => {
    expect(trialDayNumber('2026-01-01T00:00:00Z', new Date('2026-01-01T12:00:00Z'))).toBe(1)
  })
  it('counts elapsed whole days + 1', () => {
    expect(trialDayNumber('2026-01-01T00:00:00Z', new Date('2026-01-11T06:00:00Z'))).toBe(11)
  })
})

describe('decideTrialEmails', () => {
  it('sends the nudge on the exact nudge day (regression: exact-day still works)', () => {
    expect(decideTrialEmails(11, NO_STAMPS, ON_TRIAL)).toEqual({ needsDay11: true, needsDay14: false, needsDay17: false, needsDay30: false })
  })

  // The EMAIL-CRON-01 bug: with `day === 11` a cron skipped on day 11 lost the
  // send forever. The windowed check must catch up on days 12–13.
  it('catches the nudge up on days 12 and 13 when day 11 was missed', () => {
    expect(decideTrialEmails(12, NO_STAMPS, ON_TRIAL).needsDay11).toBe(true)
    expect(decideTrialEmails(13, NO_STAMPS, ON_TRIAL).needsDay11).toBe(true)
  })

  it('does not send the nudge before its window', () => {
    expect(decideTrialEmails(10, NO_STAMPS, ON_TRIAL).needsDay11).toBe(false)
  })

  it('sends the expiry email on the expiry day, not the nudge', () => {
    expect(decideTrialEmails(14, NO_STAMPS, LAPSED)).toEqual({ needsDay11: false, needsDay14: true, needsDay17: false, needsDay30: false })
  })

  it('catches the expiry email up on days 15 and 16, and then STOPS', () => {
    // 🔴 THE DAY-14 WINDOW IS NO LONGER OPEN-ENDED, and that is a deliberate change.
    // ACT-EMAIL-POSTTRIAL-01 adds day 17 and day 30; leaving day 14 open-ended meant a runner
    // who had been quiet for a month would receive all three in the same hour. Each window is
    // now closed at the next one's start, and only the last stays open.
    expect(decideTrialEmails(15, NO_STAMPS, LAPSED).needsDay14).toBe(true)
    expect(decideTrialEmails(16, NO_STAMPS, LAPSED).needsDay14).toBe(true)
    expect(decideTrialEmails(17, NO_STAMPS, LAPSED).needsDay14).toBe(false)
    // …and the day they stop getting day 14 is the day day 17 takes over, so nobody falls
    // through the gap.
    expect(decideTrialEmails(17, NO_STAMPS, LAPSED).needsDay17).toBe(true)
  })

  it('windows are disjoint: at expiry only the expiry email fires, even if the nudge never sent', () => {
    // nudge missed entirely (no stamp) but user is already at day 14
    expect(decideTrialEmails(14, NO_STAMPS, LAPSED)).toEqual({ needsDay11: false, needsDay14: true, needsDay17: false, needsDay30: false })
  })

  it('is idempotent: a set stamp suppresses re-sends across daily runs', () => {
    expect(decideTrialEmails(12, { ...NO_STAMPS, trial_email_day11_sent_at: '2026-01-11T08:00:00Z' }, ON_TRIAL).needsDay11).toBe(false)
    expect(decideTrialEmails(16, { ...NO_STAMPS, trial_email_day14_sent_at: '2026-01-14T08:00:00Z' }, LAPSED).needsDay14).toBe(false)
  })
})

// ── Who these emails must NOT reach (GTM-CHARITY-04 follow-up) ──────────────
//
// This route had no tier check at all: it sent on `trial_started_at` alone.
describe('decideTrialEmails — whose access story is it', () => {
  it('never tells a charity runner inside a live grant that their trial ends', () => {
    const grant = { tier: 'paid' as const, hasCharityGrant: true, ...SENDABLE }
    expect(decideTrialEmails(11, NO_STAMPS, grant)).toEqual({ needsDay11: false, needsDay14: false, needsDay17: false, needsDay30: false })
    expect(decideTrialEmails(14, NO_STAMPS, grant)).toEqual({ needsDay11: false, needsDay14: false, needsDay17: false, needsDay30: false })
  })

  // Tier alone does NOT cover this. Once the grant lapses the runner is `free`
  // with an unset day-14 stamp, so without `hasCharityGrant` the expiry email
  // fires months late and tells someone who was given the app that their
  // 14-day trial has ended.
  it('and still does not, months later, once the grant has lapsed', () => {
    const lapsedGrant = { tier: 'free' as const, hasCharityGrant: true, ...SENDABLE }
    expect(decideTrialEmails(200, NO_STAMPS, lapsedGrant)).toEqual({ needsDay11: false, needsDay14: false, needsDay17: false, needsDay30: false })
  })

  it('does not tell someone who subscribed mid-trial that they have 3 days left', () => {
    const subscriber = { tier: 'paid' as const, hasCharityGrant: false, ...SENDABLE }
    expect(decideTrialEmails(11, NO_STAMPS, subscriber).needsDay11).toBe(false)
  })

  // The exclusions must not swallow the people the emails exist for.
  it('still sends to an ordinary trial user, which is the whole point', () => {
    expect(decideTrialEmails(11, NO_STAMPS, ON_TRIAL).needsDay11).toBe(true)
    expect(decideTrialEmails(14, NO_STAMPS, LAPSED).needsDay14).toBe(true)
  })
})
