import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  withinSendHours, localHourIn, decideTrialEmails,
  SEND_HOUR_FROM, SEND_HOUR_UNTIL, NUDGE_DAY,
} from './trialEmailWindow'

/**
 * ACT-EMAIL-POSTTRIAL-01 — quiet hours, and the schedule they depend on.
 *
 * 📐 MEASURED 2026-11-11: the trial email cron ran ONCE DAILY at 08:00 UTC, which is **03:00
 * for the 4 of 37 runners in New York and Toronto**. Every runner in the metric population has
 * a timezone set (21 Europe/London, 8 UTC, 2 New York, 2 Toronto, and one each in Singapore,
 * Kuala Lumpur, Rome and Oslo), so this was knowable.
 *
 * 🔴 THE GUARD AND THE SCHEDULE ARE ONE DECISION IN TWO FILES. A quiet-hours check on a
 * once-daily sender is not a deferral: the local hour is identical on every run, so a runner
 * outside the window never receives the email at all. This file asserts the pairing.
 */
const NO_STAMPS = {
  trial_email_day11_sent_at: null, trial_email_day14_sent_at: null,
  trial_email_day17_sent_at: null, trial_email_day30_sent_at: null,
}
const ON_TRIAL = (localHour: number | null) =>
  ({ tier: 'trial' as const, hasCharityGrant: false, isInternal: false, hasEverSubscribed: false, localHour })

describe('ACT-EMAIL-POSTTRIAL-01 — the send window', () => {
  it('sends inside waking hours and defers outside them', () => {
    expect(withinSendHours(SEND_HOUR_FROM)).toBe(true)
    expect(withinSendHours(SEND_HOUR_UNTIL - 1)).toBe(true)
    expect(withinSendHours(SEND_HOUR_UNTIL)).toBe(false)
    expect(withinSendHours(SEND_HOUR_FROM - 1)).toBe(false)
    expect(withinSendHours(3), '03:00 is the hour this item exists for').toBe(false)
  })

  it('an unreadable timezone falls back to UTC, not to "any hour"', () => {
    // 🔴 The first cut answered TRUE for null, which was harmless on a daily 08:00 cron and is
    // not on an hourly one: the runner would be mailed at whatever hour the cron reached them,
    // which is the 3am problem this change exists to fix. UTC is a guess, but a civil-hours
    // guess, and 08:00-20:00 UTC comes round every day so nobody is silenced.
    const utcHour = new Date().getUTCHours()
    expect(withinSendHours(null)).toBe(utcHour >= SEND_HOUR_FROM && utcHour < SEND_HOUR_UNTIL)
    expect(localHourIn(null, new Date())).toBeNull()
    expect(localHourIn('Not/AZone', new Date()), 'a bad IANA name must not throw').toBeNull()
  })

  it('reads a real local hour, and two zones disagree as they should', () => {
    const noon = new Date('2026-11-11T12:00:00.000Z')
    expect(localHourIn('UTC', noon)).toBe(12)
    expect(localHourIn('America/New_York', noon)).toBe(7)
    expect(localHourIn('Asia/Singapore', noon)).toBe(20)
  })

  it('the decision DEFERS at 3am and sends at 10am, same runner, same day', () => {
    expect(decideTrialEmails(NUDGE_DAY, NO_STAMPS, ON_TRIAL(3)).needsDay11).toBe(false)
    expect(decideTrialEmails(NUDGE_DAY, NO_STAMPS, ON_TRIAL(10)).needsDay11).toBe(true)
  })
})

describe('ACT-EMAIL-POSTTRIAL-01 — the guard needs an hourly sender', () => {
  const WORKFLOW = readFileSync('.github/workflows/email-cron-trial.yml', 'utf8')

  it('the trial email cron runs HOURLY, or the guard is permanent suppression', () => {
    // 🔴 On `0 8 * * *` the local hour never changes, so a runner outside the window would
    // never be mailed again. The window only reopens if the sender runs more often than the
    // window is wide.
    const cron = /cron:\s*'([^']+)'/.exec(WORKFLOW)?.[1]
    expect(cron, 'no cron schedule found — this arm has stopped looking').toBeTruthy()
    const [, hour] = cron!.split(' ')
    expect(hour, `the cron is '${cron}': a quiet-hours guard on a daily sender silences whole `
      + 'timezones permanently. Make it hourly, or remove the guard.').toBe('*')
  })

  it('the workflow still targets the send route, so the pairing is about the right job', () => {
    expect(WORKFLOW).toMatch(/api\/email\/send-trial/)
  })

  it('the window is narrower than the interval between runs is wide', () => {
    // An hourly sender inside an N-hour window gets N chances. If the window were ever narrowed
    // to under an hour this pairing would stop being enough.
    expect(SEND_HOUR_UNTIL - SEND_HOUR_FROM).toBeGreaterThan(1)
  })
})
