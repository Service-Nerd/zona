import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveTrialWindow, isTrialActive, resolveTier,
  TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START, TRIAL_STARTS_AT_FIRST_READ, TRIAL_EXTENSION_DAYS,
} from './trial'

/**
 * ACT-TRIAL-AT-FIRST-READ-01 — the trial clock starts at the first run read.
 *
 * 📐 WHY. Of 37 trialists, **24 (64.9%) had no trainable plan week inside their trial**, and
 * **exactly 1 of 37 has ever had a run read during one.** The 14 days run from a stamp set on
 * first dashboard load; a distant race defers the plan by weeks; a run is only READ if it
 * matches a planned session.
 *
 * 🔴 THE FLAG IS OFF. It is a PRICING decision — when a runner is asked to pay — and the
 * founder authorised the build, not the enabling.
 */
const DAY = 24 * 60 * 60 * 1000
const plus = (d: Date, days: number) => new Date(d.getTime() + days * DAY)
const START = new Date('2026-09-23T09:00:00.000Z')
/** The ON path, exercised against the SHIPPED function via its injected policy argument. */
const on = (firstReadAt: Date | null, now: Date, unavailable = false) =>
  resolveTrialWindow({ trialStartedAt: START, firstReadAt, firstReadUnavailable: unavailable }, now, true)

describe('ACT-TRIAL-AT-FIRST-READ-01 — the flag is OFF and must stay provably inert', () => {
  it('is off', () => {
    expect(TRIAL_STARTS_AT_FIRST_READ,
      "enabling this is the founder's call and needs every signup-relative consumer moved first")
      .toBe(false)
  })

  it('OFF: the window is exactly TRIAL_DAYS from the stamp, whatever the read says', () => {
    for (const read of [null, plus(START, 1), plus(START, 25), plus(START, -5)]) {
      const w = resolveTrialWindow({ trialStartedAt: START, firstReadAt: read }, plus(START, 1), false)
      expect(w.endsAt!.getTime()).toBe(START.getTime() + TRIAL_DAYS * DAY)
      expect(w.basis).toBe('signup')
    }
  })

  it('OFF: the boundary is the one the old arithmetic had — exclusive at exactly TRIAL_DAYS', () => {
    // ⚠️ THE POLICY IS PASSED, NOT INHERITED FROM THE CONSTANT. This arm asserted
    // `isTrialActive(...)`, which reads the flag internally — so it described the OFF boundary
    // while silently depending on OFF being the current setting, and went red the moment the
    // flag was flipped to see whether the wiring held. **An arm about one policy must name it**,
    // or a future flip reads as this boundary breaking.
    const activeOff = (now: Date) =>
      resolveTrialWindow({ trialStartedAt: START.toISOString() }, now, false).active
    expect(activeOff(plus(START, TRIAL_DAYS))).toBe(false)
    expect(activeOff(plus(START, TRIAL_DAYS - 0.5))).toBe(true)
  })

  it('and `isTrialActive` agrees with the owner under whatever policy is live', () => {
    // The production entry point, kept in the population: one owner is only an owner if the
    // thing callers actually use returns what it returns.
    for (const d of [TRIAL_DAYS - 0.5, TRIAL_DAYS, TRIAL_DAYS + 5]) {
      const now = plus(START, d)
      expect(isTrialActive(START, now))
        .toBe(resolveTrialWindow({ trialStartedAt: START.toISOString() }, now).active)
    }
  })

  it('no stamp means no trial, on either setting', () => {
    for (const policy of [false, true]) {
      expect(resolveTrialWindow({ trialStartedAt: null }, START, policy))
        .toMatchObject({ clockStartedAt: null, endsAt: null, active: false, basis: 'none' })
    }
    expect(resolveTier({ trialStartedAt: null }, START)).toMatchObject({ tier: 'free', reason: 'none' })
  })
})

describe('ACT-TRIAL-AT-FIRST-READ-01 — the ON arithmetic, through the shipped function', () => {
  // ⚠️ The first version of this block asserted against a COPY of the rule written inside the
  // test, and inverting the cap comparison in the shipped code left it green — a checker
  // sharing the producer's predicate cannot catch the producer being wrong. The policy is an
  // injected argument now, so these drive the real branch.

  it('no read yet: access runs to the CAP and the clock has NOT started', () => {
    const w = on(null, plus(START, 20))
    expect(w.endsAt!.getTime()).toBe(START.getTime() + TRIAL_MAX_DAYS_FROM_START * DAY)
    expect(w.clockStartedAt, 'a null clock is what stops a caller computing "day N of 14"').toBeNull()
    expect(w.basis).toBe('cap')
  })

  it('a read on day 5: the 14 days run from the READ, so access ends on day 19', () => {
    const w = on(plus(START, 5), plus(START, 6))
    expect(w.endsAt!.getTime()).toBe(plus(START, 19).getTime())
    expect(w.basis).toBe('first_read')
    expect(w.active).toBe(true)
  })

  it('a read on day 25: the CAP wins, because 25 + 14 is past it', () => {
    const w = on(plus(START, 25), plus(START, 26))
    expect(w.endsAt!.getTime()).toBe(plus(START, TRIAL_MAX_DAYS_FROM_START).getTime())
    expect(w.basis).toBe('cap')
  })

  it('a read dated BEFORE the stamp is clamped, so a trial cannot end before it began', () => {
    const w = on(plus(START, -5), START)
    expect(w.clockStartedAt!.getTime()).toBe(START.getTime())
    expect(w.endsAt!.getTime()).toBe(plus(START, TRIAL_DAYS).getTime())
  })

  it('never shortens a trial the old rule would have allowed', () => {
    for (const d of [0, 1, 5, 13, 16, 25, 29]) {
      expect(on(plus(START, d), START).endsAt!.getTime(),
        `a read on day ${d} produced a shorter trial than the old rule`)
        .toBeGreaterThanOrEqual(START.getTime() + TRIAL_DAYS * DAY)
    }
  })

  it('🔴 the cap TRUNCATES a late starter, and the boundary is cap - TRIAL_DAYS', () => {
    // 🔴 THE ARM ABOVE IS NOT THIS ONE, AND THE DIFFERENCE IS WHAT THE FOUNDER'S 30 → 21 ACTUALLY
    // BOUGHT. "Never shortens a trial the old rule would have allowed" compares against day 14
    // and passes at ANY cap above 14 — so it was green before and after the change and could not
    // see it. The property that moved is: `endsAt = min(firstRead + TRIAL_DAYS, cap)`, so a
    // runner whose first read lands after `cap - TRIAL_DAYS` gets FEWER than TRIAL_DAYS.
    //
    // 📐 Measured 2026-11-12 on the only 4 trialists who have ever had a read: first reads land
    // on day 6.1 and three later, out to 40.2 — **3 of those 4 are truncated at a cap of 21,
    // against 2 of 4 at 30.** n = 4, so that is a direction and not a rate.
    //
    // ⚠️ This arm is written against the CONSTANT, so it follows a future change rather than
    // pinning today's number — but it makes the COST of that change visible, which is the thing
    // nobody was looking at.
    const boundary = TRIAL_MAX_DAYS_FROM_START - TRIAL_DAYS
    expect(boundary, 'a cap at or below TRIAL_DAYS would truncate every runner').toBeGreaterThan(0)

    // On the boundary day the runner still gets the full window, to the hour.
    const exact = on(plus(START, boundary), plus(START, boundary))
    expect(exact.endsAt!.getTime(),
      `a read on day ${boundary} should still be a full ${TRIAL_DAYS} days`)
      .toBe(plus(START, boundary + TRIAL_DAYS).getTime())

    // One day later it is clipped, and clipped to the cap rather than to anything else.
    const late = on(plus(START, boundary + 1), plus(START, boundary + 1))
    expect(late.endsAt!.getTime()).toBe(plus(START, TRIAL_MAX_DAYS_FROM_START).getTime())
    expect(late.basis).toBe('cap')

    // And the clipped runner still gets at least the old rule's 14 days from SIGNUP, which is
    // the floor that makes the cap safe to lower at all.
    expect(late.endsAt!.getTime()).toBeGreaterThanOrEqual(plus(START, TRIAL_DAYS).getTime())
  })

  it('a FAILED read resolves to the CAP, because the alternative REVOKES an entitled runner', () => {
    // 🔴 BOTH EARLIER ATTEMPTS AT THIS WERE WRONG. Discarding the error made a failure
    // indistinguishable from "no read". Falling back to the SIGNUP window was worse: a runner
    // who read on day 2 has a window to day 16, so a failed query on day 15 resolved them
    // `free` and took the product off them mid-trial because of our outage. The cap is bounded
    // (`TRIAL_MAX_DAYS_FROM_START`, 21 since the founder's decision of 2026-11-12) and can never
    // revoke.
    const w = on(null, plus(START, 20), true)
    expect(w.basis).toBe('cap')
    expect(w.endsAt!.getTime()).toBe(START.getTime() + TRIAL_MAX_DAYS_FROM_START * DAY)

    // The direction that matters: an entitled runner keeps access through a failure.
    const entitled = on(plus(START, 2), plus(START, 15), true)
    expect(entitled.active, 'a failed read revoked a trial the runner had earned').toBe(true)
  })
})

describe('ACT-EMAIL-DAY14-01 — the extension, which had NO test at all until code review', () => {
  // 🔴 I shipped `trialExtendedAt` through the owner, the server, the client and the email, and
  // never once called `resolveTrialWindow` with it set. The review ran it and found the grant
  // anchored to the ORIGINAL trial end: accepting on day 15 gave 7 days, day 18 gave 4, day 21
  // gave 1 and **day 23 gave nothing** — while the landing page said "7 more days." and the ops
  // event recorded `granted`. The day-17 email carries that link through day 29.
  const ext = (extendedAt: Date | null, now: Date) =>
    resolveTrialWindow({ trialStartedAt: START, trialExtendedAt: extendedAt }, now, false)

  it('gives seven days FROM THE CLICK, whenever the click happens', () => {
    for (const d of [15, 18, 21, 23, 29]) {
      const clicked = plus(START, d)
      const w = ext(clicked, clicked)
      expect(w.endsAt!.getTime(), `accepting on day ${d} did not give ${TRIAL_EXTENSION_DAYS} days`)
        .toBe(plus(clicked, TRIAL_EXTENSION_DAYS).getTime())
      expect(w.active, `accepting on day ${d} granted nothing`).toBe(true)
    }
  })

  it('accepting EARLY never shortens the trial', () => {
    // A runner who clicks on day 10 keeps the longer window, not `click + 7`.
    const clicked = plus(START, 10)
    expect(ext(clicked, clicked).endsAt!.getTime())
      .toBe(plus(START, TRIAL_DAYS + TRIAL_EXTENSION_DAYS).getTime())
  })

  it('no extension leaves the window exactly where it was', () => {
    expect(ext(null, plus(START, 5)).endsAt!.getTime()).toBe(plus(START, TRIAL_DAYS).getTime())
  })

  it('it reaches the TIER, not just the window', () => {
    // The whole point: an extended runner resolves `trial`, not `free`.
    const clicked = plus(START, 20)
    expect(resolveTier({ trialStartedAt: START, trialExtendedAt: clicked }, plus(START, 25)))
      .toMatchObject({ tier: 'trial', reason: 'trial' })
    expect(resolveTier({ trialStartedAt: START }, plus(START, 25)))
      .toMatchObject({ tier: 'free', reason: 'none' })
  })
})

describe('ACT-TRIAL-AT-FIRST-READ-01 — the clock is MONOTONIC', () => {
  it('a superseded read still counts, so a race change cannot resurrect an expired trial', () => {
    // 🔴 The first cut keyed the clock to LIVE reads only (`superseded_at IS NULL`). A race
    // change supersedes every `run_analysis` row a runner has — so their first read would
    // vanish, the window would jump to the cap, and **an already-expired trial would come
    // back between day 15 and the cap**. The emails count what a runner can open; this
    // answers whether they have ever been shown what the product does, and that cannot
    // un-happen.
    for (const [label, src] of [['getUserTier', TRIAL_TS], ['DashboardClient', CLIENT_TSX]] as const) {
      const q = firstReadQuery(src, label)
      expect(q, `${label}: the first-read clock filters superseded rows again — non-monotonic`)
        .not.toMatch(/\.is\('superseded_at',\s*null\)/)
      expect(q, `${label}: the earliest read is no longer the one taken`).toMatch(/ascending:\s*true/)
    }
  })
})

const TRIAL_TS   = readFileSync('lib/trial.ts', 'utf8')
const CLIENT_TSX = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

/**
 * The first-read query, bounded by the flag block it lives in.
 *
 * 🔴 The arms below used to take the file's FIRST `from('run_analysis')`. `DashboardClient.tsx`
 * is ~8,900 lines with SIX of them, so they were correct by position and would have started
 * asserting about an unrelated query the moment one moved. Anchor on the guard, not the order.
 */
function firstReadQuery(src: string, label: string): string {
  // The read guarded by the flag: the occurrence with `TRIAL_STARTS_AT_FIRST_READ` close above
  // it. Matching the guard rather than a literal `if (...)` survives the server's early-return
  // shape and the client's block shape without either being hard-coded here.
  const re = /from\('run_analysis'\)/g
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    const before = src.slice(Math.max(0, m.index - 900), m.index)
    if (before.includes('TRIAL_STARTS_AT_FIRST_READ')) return src.slice(m.index, m.index + 320)
  }
  throw new Error(`${label}: no run_analysis read guarded by TRIAL_STARTS_AT_FIRST_READ`)
}

/** Every `.ts`/`.tsx` under the given roots, excluding tests and fixtures. */
function sourceFiles(roots: string[]): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const full = join(dir, e)
      if (statSync(full).isDirectory()) { if (e !== 'node_modules' && e !== '__fixtures__') walk(full); continue }
      if (!/\.tsx?$/.test(e) || /\.test\.tsx?$/.test(e)) continue
      out.push(full)
    }
  }
  roots.forEach(walk)
  return out
}

describe('ACT-TRIAL-AT-FIRST-READ-01 — the interlock is DERIVED, not a list', () => {
  // 🔴 THE FIRST INTERLOCK WATCHED ONE FILE AND THE COMMIT CALLED IT MECHANICAL. Code review
  // found **three more signup-relative consumers and two unwired `resolveTier` callers**. A
  // guard over a hand-written list is a guard over the part you remembered, so the population
  // is swept out of the tree each run.
  const FILES = sourceFiles(['app', 'lib', 'components'])

  /**
   * Consumers that still compute the trial from the signup stamp rather than the owner.
   *
   * 🔴 THIS SWEEP IS BEST-EFFORT AND IS **NOT** THE GUARD. The first version matched two shapes
   * and I called it mechanical; review found three more it missed — `TRIAL_DAYS - trialDaysLeft`
   * in `TodayScreen`, `UpgradeScreen`, `runRead.ts`'s own `trialWindow` helper — and the whole
   * SQL side, where `admin_user_tiers.trial_days_left` and its tier CASE are signup-relative
   * across three migrations and no TypeScript sweep can see them.
   *
   * **The guard is the unconditional `it('is off')` arm at the top of this file**: flipping the
   * constant fails the build whatever this sweep happens to recognise. What this produces is a
   * CHECKLIST for the day that changes, and it is honest about being incomplete.
   */
/**
 * 🔴 THE PREDICATE MATCHES THE HAZARD, NOT A FUNCTION NAME, AND THAT CHANGE IS THE WHOLE POINT
 * OF THE 2026-11-12 WIRING. The old version's first clause was `/trialDayNumber\s*\(/` — so
 * **renaming that function would have emptied this sweep without fixing anything.** The wiring
 * did rename it (to `trialDayOfWindow`, in `lib/trial.ts`), which is exactly the move this guard
 * must not reward.
 *
 * The hazard is: computing a trial day, or a day count, from the SIGNUP STAMP rather than from
 * the window the owner returns. Exported and string-shaped so the arms below can plant each
 * shape and prove the predicate still fires — a sweep over an empty population cannot otherwise
 * be told from a sweep that has stopped working.
 */
  function isSignupRelative(src: string): boolean {
    const code = src.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
    return (
      // Day arithmetic on the signup stamp, in either order.
      /(trialStartedAt|trial_started_at)[^\n]{0,90}(MS_PER_DAY|DAY_MS|86_?400_?000|24 \* 60 \* 60)/.test(code)
      || /(MS_PER_DAY|DAY_MS|86_?400_?000)[^\n]{0,90}(trialStartedAt|trial_started_at)/.test(code)
      // The signup stamp plus the trial length, which is the window's job.
      || /new Date\((trialStartedAt|settings\.trial_started_at)\)[^\n]{0,90}TRIAL_DAYS/.test(code)
      // A day number reconstructed from the countdown — `TodayScreen`'s shape, which review found.
      || /TRIAL_DAYS\s*[-+]\s*trialDaysLeft/.test(code)
      // Any locally-declared trial-day helper. One owner, or none.
      || /function\s+\w*[Tt]rialDay\w*\s*\(/.test(code)
    )
  }

  const signupRelative = FILES.filter(f =>
    f !== 'lib/trial.ts' && isSignupRelative(readFileSync(f, 'utf8')))

  /** `resolveTier` callers that do not hand it the first read. */
  const unwiredCallers = FILES.filter(f => {
    if (f === 'lib/trial.ts') return false            // getUserTier is wired in-file
    // ⚠️ COMMENTS STRIPPED, and EVERY occurrence checked. The first version read the file's
    // first `resolveTier(` only and did not strip comments, so `shouldReconcile.ts` — which
    // merely MENTIONS it in a doc comment — counted as an unwired caller, and a second real
    // call site in any file would have been invisible.
    const src = readFileSync(f, 'utf8')
      .replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
    const re = /resolveTier\(/g
    let unwired = false
    for (let m = re.exec(src); m !== null; m = re.exec(src)) {
      const call = src.slice(m.index, m.index + 900)
      // Both inputs, not just the one I happened to add first: a caller that passes the read
      // and not the extension resolves a runner who took the offer as `free`.
      if (!/firstReadAt/.test(call) || !/trialExtendedAt/.test(call)) unwired = true
    }
    return unwired
  })

  it('the population is non-empty, so this guard cannot pass by selecting nothing', () => {
    expect(FILES.length).toBeGreaterThan(100)
  })

  // 🔴 THE WIRING IS DONE (2026-11-12), SO THESE TWO ARE NO LONGER INTERLOCKS — THEY ARE GATES.
  // They were `if (population > 0) expect(flag).toBe(false)`, which is a guard that stands down
  // the moment the work is finished. Both populations reached zero, which is what the old
  // "not vacuous" arm was watching for, and its own comment said to **re-read these rather than
  // delete them** when it happened. Re-read: the conditional is gone and the assertion is now
  // unconditional, so a NEW signup-relative consumer fails the build whether the flag is on or
  // off — which is the state this repo wants, because the next one will be written by someone
  // who never read any of this.

  it('🔴 NOTHING computes a trial day from the signup stamp', () => {
    // With the flag on and no read yet, a runner's trial runs to the CAP while a signup-relative
    // day number still reaches 11 on day 11 — so "3 days left." goes to someone with nineteen.
    // That is a false statement to a customer about when they will be charged.
    expect(signupRelative,
      'move these onto resolveTrialWindow() + trialDayOfWindow(); lib/trial.ts is the only owner')
      .toEqual([])
  })

  it('🔴 EVERY resolveTier caller hands over the same facts', () => {
    // One owner is only an owner if every caller supplies the same inputs (TIER-OWNER-01).
    // An unwired caller resolves every trialist on the cap path.
    expect(unwiredCallers, 'these call resolveTier without firstReadAt / trialExtendedAt')
      .toEqual([])
  })

  it('🔑 the sweep still WORKS, which an empty population cannot show', () => {
    // 🔴 THIS ARM REPLACES "both populations are non-empty TODAY", and it is the better
    // question. That one proved the `if` could fire; it could not survive the wiring being
    // finished, and a sweep over an empty population is indistinguishable from a sweep whose
    // regex has stopped matching anything. **So the shapes are planted rather than counted.**
    const hazards = [
      ['raw day arithmetic',        'const d = Math.floor((now - new Date(trialStartedAt).getTime()) / MS_PER_DAY)'],
      ['the other operand order',   'const d = MS_PER_DAY * 2 + new Date(trial_started_at).getTime()'],
      ['stamp plus trial length',   'const end = new Date(trialStartedAt).getTime() + TRIAL_DAYS * 2'],
      ['rebuilt from the countdown','const daysIn = TRIAL_DAYS - trialDaysLeft'],
      ['a local day helper',        'function myTrialDayNumber(startedAt: string) { return 1 }'],
    ] as const
    for (const [name, src] of hazards) {
      expect(isSignupRelative(src), `the sweep no longer recognises: ${name}`).toBe(true)
    }

    // And the other direction, which is what stops it becoming a blanket refusal: the owner's
    // own shape and an ordinary window read must NOT fire.
    for (const [name, src] of [
      ['reading the owner',  'const day = trialDayOfWindow(resolveTrialWindow(inputs, now), now)'],
      ['an unrelated stamp', 'const d = Math.floor((now - new Date(race_date).getTime()) / MS_PER_DAY)'],
      ['a mention in prose', '// trialStartedAt used to be divided by MS_PER_DAY here'],
    ] as const) {
      expect(isSignupRelative(src), `the sweep now fires on: ${name}`).toBe(false)
    }
  })

  it('the two callers that ARE wired hand over the same facts', () => {
    expect(TRIAL_TS, 'getUserTier no longer passes firstReadAt')
      .toMatch(/firstReadAt:[\s\S]{0,120}firstReadUnavailable:/)
    expect(TRIAL_TS, 'getUserTier no longer passes trialExtendedAt').toMatch(/trialExtendedAt:/)
    expect(CLIENT_TSX, 'the client mirror no longer passes firstReadAt')
      .toMatch(/firstReadAt,\s*\n\s*firstReadUnavailable,/)
    expect(CLIENT_TSX, 'the client mirror no longer passes trialExtendedAt')
      .toMatch(/trialExtendedAt:/)
  })

  it('neither wired caller pays for the read while the flag is off', () => {
    // `firstReadQuery` itself proves the read sits inside the flag block in both files.
    for (const [name, src] of [['getUserTier', TRIAL_TS], ['DashboardClient', CLIENT_TSX]] as const) {
      expect(firstReadQuery(src, name).length).toBeGreaterThan(50)
    }
    // ⚠️ And `getUserTier` must resolve BEFORE asking: an admin, subscriber or grant holder is
    // answered by `resolveTier` long before it looks at a trial, so the query bought for them
    // was a serialised round trip for nothing.
    expect(TRIAL_TS, 'getUserTier queries the read before knowing whether it can matter')
      .toMatch(/first\.reason\s*!==\s*'trial'\s*&&\s*first\.reason\s*!==\s*'none'/)
  })

  it('the in-app countdown reads the owner, not its own arithmetic', () => {
    // On the cap path, `trial_started_at + TRIAL_DAYS` would show "0 days left" to a runner
    // with ten — the tier and the number on screen disagreeing.
    expect(CLIENT_TSX).toMatch(/resolveTrialWindow\([\s\S]{0,40}trialStartedAt,\s*firstReadAt,\s*firstReadUnavailable,/)
  })
})
