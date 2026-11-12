import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildDay14Email, buildDay17Email, buildDay30Email, extendTrialUrl } from './trialEmailTemplates'
import { decideTrialEmails, DAY17, DAY30, DAY30_UNTIL, EXPIRY_DAY } from './trialEmailWindow'
import { TRIAL_EXTENSION_DAYS } from '@/lib/trial'

/**
 * ACT-EMAIL-DAY14-01 + ACT-EMAIL-POSTTRIAL-01 — Release 2 of the activation brief.
 *
 * 📐 `ops_events.email_sent`, by subject: **"Fourteen days, no runs read." went out 13 times of
 * 16**, and nothing at all was sent after day 14.
 */
const run = (n: number) => ({
  actualLoadKm: n > 0 ? 8.2 : null,
  hrInZonePct: n > 0 ? 61 : null,
  hrAboveCeilingPct: n > 0 ? 4 : null,
  verdict: n > 0 ? 'held' : null,
  analysedRunCount: n,
  dayName: n > 0 ? 'Tuesday' : null,
})
const TOK = 'tok-123'
const STAMPS = {
  trial_email_day11_sent_at: null, trial_email_day14_sent_at: null,
  trial_email_day17_sent_at: null, trial_email_day30_sent_at: null,
}
const LAPSED = { tier: 'free' as const, hasCharityGrant: false, isInternal: false, hasEverSubscribed: false, localHour: 10 }

describe('ACT-EMAIL-DAY14-01 — the day-14 email never states a zero', () => {
  it('with no reads it offers the week back instead of counting nothing', () => {
    const e = buildDay14Email('Russ', run(0), TOK)
    expect(e.subject).not.toMatch(/no runs read/i)
    expect(e.html).not.toMatch(/no runs read/i)
    expect(e.html).toContain(extendTrialUrl(TOK))
    expect(e.html).toContain(`Add ${TRIAL_EXTENSION_DAYS} days`)
  })

  it('it still leaves the free path visible, so the offer is not a trap', () => {
    expect(buildDay14Email('Russ', run(0), TOK).html).toMatch(/do nothing/i)
  })

  it('with reads it is unchanged: the count IS the message', () => {
    const e = buildDay14Email('Russ', run(3), TOK)
    expect(e.subject).toBe('Fourteen days, 3 runs read.')
    expect(e.html, 'an extension offer where there is nothing to fix').not.toContain('/api/email/extend-trial')
  })

  it('the zero branch carries no upgrade CTA — we are not invoicing them for our silence', () => {
    expect(buildDay14Email('Russ', run(0), TOK).html).not.toContain('screen=upgrade')
  })
})

describe('ACT-EMAIL-POSTTRIAL-01 — day 17 branches on what we actually know', () => {
  it('reads: summarise what we saw, and say it does not expire', () => {
    const e = buildDay17Email('Russ', run(4), TOK, false)
    expect(e.subject).toMatch(/saw/i)
    expect(e.html).toContain('4 runs')
    expect(e.html, 'nothing to extend when the product worked').not.toContain('/api/email/extend-trial')
  })

  it('no reads, offer untaken: offer it again, once', () => {
    const e = buildDay17Email('Russ', run(0), TOK, false)
    expect(e.html).toContain(extendTrialUrl(TOK))
  })

  it('no reads, offer ALREADY taken: never offer it twice', () => {
    // Offering a week to someone who accepted one three days ago reads as a system that is not
    // paying attention, which is the opposite of what this product claims to be.
    const e = buildDay17Email('Russ', run(0), TOK, true)
    expect(e.html, 'the extension is offered to someone who already has it')
      .not.toContain('/api/email/extend-trial')
    expect(e.subject).toBe('Still here.')
  })
})

describe('ACT-EMAIL-POSTTRIAL-01 — day 30 asks one question and sells nothing', () => {
  it('has no CTA at all', () => {
    const e = buildDay30Email('Russ', TOK)
    expect(e.html, 'a question with a Buy button under it is not a question')
      .not.toContain('screen=upgrade')
    expect(e.html).not.toContain('/api/email/extend-trial')
  })

  it('says it is the last one, and the window is BOUNDED so it cannot backfill', () => {
    expect(buildDay30Email('Russ', TOK).html).toMatch(/last one/i)
    expect(decideTrialEmails(DAY30, STAMPS, LAPSED).needsDay30).toBe(true)
    expect(decideTrialEmails(DAY30 + 6, STAMPS, LAPSED).needsDay30).toBe(true)
    // 🔴 Left open-ended, the first hourly run after this shipped would have asked EVERY
    // trialist in the app's history what stopped them subscribing, months late.
    expect(decideTrialEmails(400, STAMPS, LAPSED).needsDay30).toBe(false)
    expect(decideTrialEmails(DAY30, { ...STAMPS, trial_email_day30_sent_at: 'x' }, LAPSED))
      .toMatchObject({ needsDay11: false, needsDay14: false, needsDay17: false, needsDay30: false })
  })

  it('never asks a LAPSED SUBSCRIBER what stopped them subscribing', () => {
    // They resolve `free`, so tier alone does not cover it — the same gap `hasCharityGrant`
    // already exists for, and the premise of the question is visibly false to them.
    const lapsedSub = { ...LAPSED, hasEverSubscribed: true }
    expect(decideTrialEmails(DAY30, STAMPS, lapsedSub).needsDay30).toBe(false)
    // …but they still get the ordinary trial emails, which are true for them.
    expect(decideTrialEmails(DAY17, STAMPS, lapsedSub).needsDay17).toBe(true)
  })
})

describe('ACT-EMAIL-POSTTRIAL-01 — the windows do not overlap', () => {
  it('a runner quiet for a month gets ONE email, not three', () => {
    // 🔴 Day 14 used to be open-ended, which was right when it was the last email. With day 17
    // and day 30 added, leaving it so would deliver all three in the same hour.
    const d = decideTrialEmails(DAY30 + 1, STAMPS, LAPSED)
    const firing = Object.entries(d).filter(([, v]) => v).map(([k]) => k)
    expect(firing).toEqual(['needsDay30'])
  })

  it('a runner quiet for a YEAR gets none at all', () => {
    expect(Object.values(decideTrialEmails(400, STAMPS, LAPSED)).some(Boolean)).toBe(false)
  })

  it('every boundary hands over cleanly, with no silent day', () => {
    for (const day of [EXPIRY_DAY, EXPIRY_DAY + 1, DAY17, DAY17 + 1, DAY30, DAY30_UNTIL - 1]) {
      const d = decideTrialEmails(day, STAMPS, LAPSED)
      const firing = Object.values(d).filter(Boolean).length
      expect(firing, `day ${day} fires ${firing} emails`).toBe(1)
    }
  })

  it('internal accounts receive none of them', () => {
    // 18 of 56 accounts are internal — a third of the list (INTERNAL-ACCOUNTS-01).
    for (const day of [11, 14, 17, 30, 90]) {
      const d = decideTrialEmails(day, STAMPS, { ...LAPSED, isInternal: true })
      expect(Object.values(d).some(Boolean), `an internal account is mailed on day ${day}`).toBe(false)
    }
  })
})

describe('ACT-EMAIL-DAY14-01 — the route that grants the extension', () => {
  const ROUTE = readFileSync('app/api/email/extend-trial/route.ts', 'utf8')

  it('grants it ONCE, conditionally on the column still being null', () => {
    expect(ROUTE).toMatch(/\.is\('trial_extended_at',\s*null\)/)
  })

  it('GET confirms and POST grants, so a link scanner cannot spend the offer', () => {
    // 🔴 A GET that mutates is granted by every mail-gateway link scanner on delivery: the
    // offer would be consumed before the runner read the sentence, the acceptance number would
    // measure spam filters, and day 17's "offer still open" branch would be unreachable for
    // anyone behind a corporate gateway.
    const get = ROUTE.slice(ROUTE.indexOf('export async function GET'),
                            ROUTE.indexOf('export async function POST'))
    expect(get, 'GET still writes').not.toMatch(/\.update\(/)
    expect(get, 'GET still reads the runner').not.toMatch(/\.from\('user_settings'\)/)
    expect(get, 'GET records an outcome it has not produced').not.toMatch(/recordOpsEvent\('trial_extended'/)
    expect(get).toMatch(/confirmPage\(/)
    expect(ROUTE).toMatch(/export async function POST/)
    expect(ROUTE, 'the confirm page must post back').toMatch(/method="post"/)
  })

  it('a second click reports the extension they have, rather than erroring or granting another', () => {
    expect(ROUTE).toMatch(/outcome:\s*'already'/)
  })

  it('records every outcome, including the failures', () => {
    for (const kind of ['trial_extended', 'trial_extend_failed']) {
      expect(ROUTE, `${kind} is never recorded`).toContain(kind)
    }
    // A failed READ must not be reported as an unknown token: that would be a lie we could not
    // detect later.
    expect(ROUTE).toMatch(/stage:\s*'read'/)
    expect(ROUTE).toMatch(/stage:\s*'unknown_token'/)
  })
})
