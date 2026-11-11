import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  trialWindow, isTrialActive, resolveTier,
  TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START, TRIAL_STARTS_AT_FIRST_READ,
} from './trial'

/**
 * ACT-TRIAL-AT-FIRST-READ-01 — the trial clock starts at the first run read.
 *
 * 📐 WHY. Measured 2026-11-11: of 37 trialists, **24 (64.9%) had no trainable plan week inside
 * their trial** — 10 had no plan at all, and of the 27 who did, 14 held only versions beginning
 * after it ended, worst gap **242 days**. **Exactly 1 of 37 has ever had a run read during their
 * trial.** The 14 days run from a stamp set on first dashboard load; the plan often does not
 * begin for weeks because a distant race defers it; and a run is only READ if it matches a
 * planned session. The trial expires before the product can do the one thing it is for.
 *
 * 🔴 THE FLAG IS OFF AND THIS FILE'S FIRST JOB IS TO PROVE THAT CHANGES NOTHING. It is a
 * PRICING decision — when a runner is asked to pay — and the founder has authorised the build,
 * not the enabling.
 */
const DAY = 24 * 60 * 60 * 1000
const at = (d: string) => new Date(d)
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY)

const START = at('2026-09-23T09:00:00.000Z')

describe('ACT-TRIAL-AT-FIRST-READ-01 — the flag is OFF and must stay provably inert', () => {
  it('is off', () => {
    expect(TRIAL_STARTS_AT_FIRST_READ,
      'enabling this is the founder\'s call and needs the day-11/14 emails moved first').toBe(false)
  })

  it('OFF: the window is exactly TRIAL_DAYS from the stamp, whatever the read says', () => {
    if (TRIAL_STARTS_AT_FIRST_READ) return
    for (const read of [null, plus(START, 1), plus(START, 25), plus(START, -5)]) {
      const w = trialWindow({ trialStartedAt: START, firstReadAt: read }, plus(START, 1))
      expect(w.endsAt!.getTime(), 'a read moved the window while the flag is off')
        .toBe(START.getTime() + TRIAL_DAYS * DAY)
      expect(w.basis).toBe('signup')
    }
  })

  it('OFF: the boundary is the one the old arithmetic had — exclusive at exactly TRIAL_DAYS', () => {
    if (TRIAL_STARTS_AT_FIRST_READ) return
    expect(isTrialActive(START, plus(START, TRIAL_DAYS))).toBe(false)
    expect(isTrialActive(START, plus(START, TRIAL_DAYS - 0.5))).toBe(true)
  })

  it('no stamp means no trial, on either setting', () => {
    const w = trialWindow({ trialStartedAt: null }, START)
    expect(w).toMatchObject({ clockStartedAt: null, endsAt: null, active: false, basis: 'none' })
    expect(isTrialActive(null, START)).toBe(false)
    expect(resolveTier({ trialStartedAt: null }, START)).toMatchObject({ tier: 'free', reason: 'none' })
  })
})

describe('ACT-TRIAL-AT-FIRST-READ-01 — the arithmetic the flag would switch on', () => {
  // ⚠️ Tested through a LOCAL implementation of the same rule rather than by flipping the
  // export, because the export is a constant and vitest cannot rebind it. Each case below is
  // the value `trialWindow` is written to produce; the arm above proves the shipped function
  // currently takes the OFF branch, and the interlock arms prove it cannot be flipped alone.
  const windowOn = (startedAt: Date, readAt: Date | null, now: Date) => {
    const cap = plus(startedAt, TRIAL_MAX_DAYS_FROM_START)
    if (!readAt) return { endsAt: cap, basis: 'cap' as const, clockStartedAt: null }
    const clock = readAt < startedAt ? startedAt : readAt
    const fromRead = plus(clock, TRIAL_DAYS)
    return fromRead < cap
      ? { endsAt: fromRead, basis: 'first_read' as const, clockStartedAt: clock }
      : { endsAt: cap, basis: 'cap' as const, clockStartedAt: clock }
  }

  it('no read yet: access runs to the 30-day cap and the clock has NOT started', () => {
    const w = windowOn(START, null, plus(START, 20))
    expect(w.endsAt.getTime()).toBe(START.getTime() + TRIAL_MAX_DAYS_FROM_START * DAY)
    expect(w.clockStartedAt, 'a null clock is what stops a caller computing "day N of 14"').toBeNull()
    expect(w.basis).toBe('cap')
  })

  it('a read on day 5: the 14 days run from the READ, so access ends on day 19', () => {
    const w = windowOn(START, plus(START, 5), plus(START, 6))
    expect(w.endsAt.getTime()).toBe(plus(START, 19).getTime())
    expect(w.basis).toBe('first_read')
  })

  it('a read on day 25: the CAP wins, because 25 + 14 is past 30', () => {
    const w = windowOn(START, plus(START, 25), plus(START, 26))
    expect(w.endsAt.getTime()).toBe(plus(START, TRIAL_MAX_DAYS_FROM_START).getTime())
    expect(w.basis).toBe('cap')
  })

  it('a read dated BEFORE the stamp is clamped, so a trial cannot end before it began', () => {
    const w = windowOn(START, plus(START, -5), START)
    expect(w.clockStartedAt!.getTime()).toBe(START.getTime())
    expect(w.endsAt.getTime()).toBe(plus(START, TRIAL_DAYS).getTime())
  })

  it('the cap never shortens a trial that the old rule would have allowed', () => {
    // A monotonicity check, because the whole point is to give people MORE time to see value.
    for (const d of [0, 1, 5, 13, 16, 25, 29]) {
      const w = windowOn(START, plus(START, d), START)
      expect(w.endsAt.getTime(), `a read on day ${d} produced a shorter trial than the old rule`)
        .toBeGreaterThanOrEqual(START.getTime() + TRIAL_DAYS * DAY)
    }
  })
})

describe('ACT-TRIAL-AT-FIRST-READ-01 — the interlock: it cannot be enabled alone', () => {
  const TRIAL = readFileSync('lib/trial.ts', 'utf8')
  const EMAIL_ROUTE = readFileSync('app/api/email/send-trial/route.ts', 'utf8')

  it('while the emails count days from the SIGNUP stamp, the flag must be off', () => {
    // 🔴 WITH THE FLAG ON AND NO READ YET, a runner's trial runs to the 30-day cap while
    // `trialDayNumber(trial_started_at, now)` still reaches 11 on day 11 — so "3 days left."
    // would go to someone with nineteen. That is a false statement to a customer about when
    // they will be charged, which is worse than the defect being fixed.
    const stillSignupRelative = /trialDayNumber\(settings\.trial_started_at/.test(EMAIL_ROUTE)
    if (stillSignupRelative) {
      expect(TRIAL_STARTS_AT_FIRST_READ,
        'the day-11/14 emails still key off trial_started_at — move them to trialWindow() ' +
        'before enabling this, or they will tell runners the wrong date').toBe(false)
    }
  })

  it('the interlock is not vacuous — the shape it watches for is actually there today', () => {
    // An `if` that never fires is not a guard. If this fails, the emails have been rewired and
    // this arm should be re-examined rather than deleted.
    expect(EMAIL_ROUTE, 'the email route no longer counts signup-relative days; re-read the interlock')
      .toMatch(/trialDayNumber\(settings\.trial_started_at/)
  })

  it('both callers of resolveTier hand it the same facts, or the flag would split server from client', () => {
    // TIER-OWNER-01: one owner is only an owner if every caller supplies the same inputs.
    const client = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(TRIAL, 'getUserTier no longer passes firstReadAt').toMatch(/firstReadAt,\s*\n\s*\}\)\.tier/)
    expect(client, 'the client mirror no longer passes firstReadAt').toMatch(/firstReadAt,\s*\n\s*\}, now\)/)
  })

  it('neither caller pays for the read while the flag is off', () => {
    const client = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    for (const [name, src] of [['getUserTier', TRIAL], ['DashboardClient', client]] as const) {
      expect(src, `${name} fetches run_analysis unconditionally — the OFF path must cost nothing`)
        .toMatch(/if\s*\(TRIAL_STARTS_AT_FIRST_READ\)/)
    }
  })

  it('both sides read the SAME definition of a read — live rows only', () => {
    const client = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    for (const src of [TRIAL, client]) {
      const at = src.indexOf("from('run_analysis')")
      expect(at, 'the first-read query is gone').toBeGreaterThan(-1)
      expect(src.slice(at, at + 260), 'a superseded read would start someone\'s paid clock on a '
        + 'row they can no longer open').toMatch(/\.is\('superseded_at',\s*null\)/)
      expect(src.slice(at, at + 260)).toMatch(/ascending:\s*true/)
    }
  })
})
