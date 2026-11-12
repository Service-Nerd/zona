// ACT-TRIAL-AT-FIRST-READ-01 wiring (2026-11-12) — `trialDayOfWindow` is the single owner of
// "what day of the trial is it", and four surfaces moved onto it.
//
// 🔴 THE CLAIM THIS FILE EXISTS TO PROVE IS THE SAFETY ONE, NOT THE FEATURE ONE. The wiring
// changes what four runner-facing surfaces compute, **while the flag is off and nothing is
// supposed to move at all**. "It is identical because the subtraction cancels" is an argument;
// a grid is evidence. If this file is green, the day-11 email, the day-14 email, the day-17 and
// day-30 follow-ups and the trial-insight push all fire on exactly the days they fired on
// before, for every runner.
//
// ⚠️ The OLD function is reproduced here, once, as the thing being compared against — which is
// normally the `deloadCadence` anti-pattern (a checker sharing the producer's predicate cannot
// catch the producer being wrong). It is correct here precisely because it is NOT the producer:
// it is the deleted implementation, kept as a fixture of what shipped, and the whole point is
// that the new producer must agree with it.

import { describe, it, expect } from 'vitest'
import {
  trialDayOfWindow, resolveTrialWindow,
  TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START, TRIAL_EXTENSION_DAYS, TRIAL_STARTS_AT_FIRST_READ,
} from './trial'

const DAY = 24 * 60 * 60 * 1000
const START = new Date('2026-03-01T09:17:43.000Z')   // a deliberately untidy hour
const plus = (d: Date, n: number) => new Date(d.getTime() + n * DAY)

/**
 * The middle of day `n`, for a trial ending at `endsAt`.
 *
 * ⚠️ WRITTEN BECAUSE I GOT IT WRONG BY HAND, THREE TIMES, IN THIS FILE. Day numbers are
 * 1-indexed and `TRIAL_DAYS` is the LAST day, so **day n spans `[endsAt - (TRIAL_DAYS - n + 1),
 * endsAt - (TRIAL_DAYS - n))`** — day 11 of 14 is `endsAt - 4d` to `endsAt - 3d`, not
 * "`endsAt` minus three days". Reaching for `endsAt - 3d` as "three days left" reported day 12
 * and the arms went red against the owner, which was right.
 */
const middleOfDay = (endsAt: Date, n: number) =>
  new Date(endsAt.getTime() - (TRIAL_DAYS - n + 0.5) * DAY)

/** The implementation that shipped until 2026-11-12, kept verbatim as the comparison fixture. */
function oldTrialDayNumber(trialStartedAt: string, now: Date): number {
  const start = new Date(trialStartedAt).getTime()
  return Math.floor((now.getTime() - start) / DAY) + 1
}

describe('🔴 PARITY — under the OFF policy, the new owner is the old arithmetic exactly', () => {
  it('records which policy is live, without depending on it', () => {
    // 🔴 THIS ARM USED TO ASSERT `TRIAL_STARTS_AT_FIRST_READ === false`, AND THAT WAS THE WRONG
    // SHAPE. Flipping the flag to check the wiring turned this whole file red, so the signal a
    // person needs on that day — "what did I actually break?" — was buried under three arms
    // that were only ever describing the OFF policy. **Every arm below now PASSES the policy**,
    // so the day the flag flips the only reds are `it('is off')` — the founder's gate — and
    // `trialFunnel.test.ts`'s window arm, which is a behaviour that genuinely changes.
    expect(typeof TRIAL_STARTS_AT_FIRST_READ).toBe('boolean')
  })

  it('agrees on every day from before the trial to long after it', () => {
    const mismatches: string[] = []
    for (let d = -3; d <= 60; d++) {
      // Three times of day, because the old function floors and a boundary error would hide at
      // noon and show at 00:01.
      for (const hour of [0.01, 0.5, 0.99]) {
        const now = new Date(START.getTime() + (d + hour) * DAY)
        const w = resolveTrialWindow({ trialStartedAt: START.toISOString() }, now, false)
        const got = trialDayOfWindow(w, now)
        const want = oldTrialDayNumber(START.toISOString(), now)
        if (got !== want) mismatches.push(`day ${d} @${hour}: owner ${got}, old ${want}`)
      }
    }
    expect(mismatches, 'the wiring moved a day number while the flag is off').toEqual([])
  })

  it('agrees for a runner who accepted the seven-day extension', () => {
    // The extension moves `endsAt`, so the effective start moves with it — and that is CORRECT
    // rather than a parity break: "3 days left" must mean three days before the NEW end. The old
    // function could not express that at all, which is the defect, so this arm pins the
    // DIFFERENCE instead of equality and names it.
    const clicked = plus(START, 14)
    const endsAt  = plus(clicked, TRIAL_EXTENSION_DAYS)          // day 21
    const now     = middleOfDay(endsAt, TRIAL_DAYS - 3)          // the nudge day, day 11
    const w = resolveTrialWindow({ trialStartedAt: START.toISOString(), trialExtendedAt: clicked.toISOString() }, now, false)
    expect(w.endsAt!.getTime()).toBe(endsAt.getTime())

    const owner = trialDayOfWindow(w, now)!
    const old   = oldTrialDayNumber(START.toISOString(), now)
    expect(old).toBe(18)
    // Day 11 is the nudge, and with the extension it lands inside the extended window.
    expect(owner).toBe(TRIAL_DAYS - 3)
    expect(owner, 'the extension must move the day number, or the nudge fires at the old end')
      .not.toBe(old)
  })

  it('no window, no day — null is an answer and never a 1', () => {
    const w = resolveTrialWindow({ trialStartedAt: null }, START, false)
    expect(w.endsAt).toBeNull()
    expect(trialDayOfWindow(w, START)).toBeNull()
  })
})

describe('🔑 what the owner does when the flag is ON — the reason it exists', () => {
  const on = (firstReadAt: Date | null, now: Date) =>
    resolveTrialWindow(
      { trialStartedAt: START.toISOString(), firstReadAt: firstReadAt?.toISOString() ?? null },
      now, true,
    )

  it('no read yet: the day number tracks the CAP, so "3 days left" is true', () => {
    // 🔴 THIS IS THE DEFECT THE INTERLOCK EXISTED FOR. The old arithmetic reached day 11 on day
    // 11 and sent "3 days left." to a runner whose access ran to the cap — a false statement to
    // a customer about when they will be charged.
    const nudgeDay = TRIAL_DAYS - 3
    const old11 = plus(START, 10.5)
    expect(oldTrialDayNumber(START.toISOString(), old11)).toBe(11)
    expect(trialDayOfWindow(on(null, old11), old11),
      'the owner still reaches the nudge day on calendar day 11, with no read').not.toBe(nudgeDay)

    // It reaches it three days before the cap instead, which is when it is true.
    const trueNudge = middleOfDay(plus(START, TRIAL_MAX_DAYS_FROM_START), nudgeDay)
    expect(trialDayOfWindow(on(null, trueNudge), trueNudge)).toBe(nudgeDay)
  })

  it('a read on day 5: the nudge lands three days before THAT runner’s end', () => {
    const read = plus(START, 5)
    const end = plus(read, TRIAL_DAYS)          // day 19, inside the cap
    const nudge = middleOfDay(end, TRIAL_DAYS - 3)
    expect(trialDayOfWindow(on(read, nudge), nudge)).toBe(TRIAL_DAYS - 3)
  })

  it('a LATE read is clipped by the cap, and the day number is clipped with it', () => {
    // Nothing may fire after access has ended: on the last day of the cap the owner reports
    // exactly the expiry day, never past it.
    const read = plus(START, TRIAL_MAX_DAYS_FROM_START - 2)
    const lastDay = plus(START, TRIAL_MAX_DAYS_FROM_START - 0.5)
    expect(trialDayOfWindow(on(read, lastDay), lastDay)).toBe(TRIAL_DAYS)
  })
})
