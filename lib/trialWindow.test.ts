import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  resolveTrialWindow, isTrialActive, resolveTier,
  TRIAL_DAYS, TRIAL_MAX_DAYS_FROM_START, TRIAL_STARTS_AT_FIRST_READ,
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
    expect(isTrialActive(START, plus(START, TRIAL_DAYS))).toBe(false)
    expect(isTrialActive(START, plus(START, TRIAL_DAYS - 0.5))).toBe(true)
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

  it('no read yet: access runs to the 30-day cap and the clock has NOT started', () => {
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

  it('a read on day 25: the CAP wins, because 25 + 14 is past 30', () => {
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

  it('a FAILED read resolves to the CAP, because the alternative REVOKES an entitled runner', () => {
    // 🔴 BOTH EARLIER ATTEMPTS AT THIS WERE WRONG. Discarding the error made a failure
    // indistinguishable from "no read". Falling back to the SIGNUP window was worse: a runner
    // who read on day 2 has a window to day 16, so a failed query on day 15 resolved them
    // `free` and took the product off them mid-trial because of our outage. The cap is bounded
    // at 30 days and can never revoke.
    const w = on(null, plus(START, 20), true)
    expect(w.basis).toBe('cap')
    expect(w.endsAt!.getTime()).toBe(START.getTime() + TRIAL_MAX_DAYS_FROM_START * DAY)

    // The direction that matters: an entitled runner keeps access through a failure.
    const entitled = on(plus(START, 2), plus(START, 15), true)
    expect(entitled.active, 'a failed read revoked a trial the runner had earned').toBe(true)
  })
})

describe('ACT-TRIAL-AT-FIRST-READ-01 — the clock is MONOTONIC', () => {
  it('a superseded read still counts, so a race change cannot resurrect an expired trial', () => {
    // 🔴 The first cut keyed the clock to LIVE reads only (`superseded_at IS NULL`). A race
    // change supersedes every `run_analysis` row a runner has — so their first read would
    // vanish, the window would jump to the 30-day cap, and **an already-expired trial would
    // come back between day 15 and day 30**. The emails count what a runner can open; this
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
  const signupRelative = FILES.filter(f => {
    if (f === 'lib/trial.ts') return false            // the owner itself
    const src = readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
    return /trialDayNumber\s*\(/.test(src)
        || /new Date\((trialStartedAt|settings\.trial_started_at)\)[^\n]*TRIAL_DAYS/.test(src)
        || /TRIAL_DAYS\s*-\s*trialDaysLeft/.test(src)
        || /trialWindow\s*\(\s*trialStartedAt/.test(src)
  })

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

  it('while ANY consumer still counts from the signup stamp, the flag must be off', () => {
    // With the flag on and no read yet, a runner's trial runs to the 30-day cap while
    // `trialDayNumber` still reaches 11 on day 11 — so "3 days left." goes to someone with
    // nineteen. That is a false statement to a customer about when they will be charged.
    if (signupRelative.length > 0) {
      expect(TRIAL_STARTS_AT_FIRST_READ,
        `these still count the trial from trial_started_at: ${signupRelative.join(', ')} — move `
        + 'them onto resolveTrialWindow() before enabling the flag').toBe(false)
    }
  })

  it('while ANY resolveTier caller is unwired, the flag must be off', () => {
    // One owner is only an owner if every caller supplies the same inputs (TIER-OWNER-01).
    // An unwired caller resolves every trialist on the 30-day cap path.
    if (unwiredCallers.length > 0) {
      expect(TRIAL_STARTS_AT_FIRST_READ,
        `these call resolveTier without firstReadAt: ${unwiredCallers.join(', ')}`).toBe(false)
    }
  })

  it('the interlock is not vacuous — both populations are non-empty TODAY', () => {
    // An `if` that never fires is not a guard. If either of these goes to zero the wiring is
    // done and the arms above become live; re-read them rather than deleting them.
    expect(signupRelative.length, 'no signup-relative consumer found; re-read the interlock')
      .toBeGreaterThan(0)
    expect(unwiredCallers.length, 'every resolveTier caller is wired; re-read the interlock')
      .toBeGreaterThan(0)
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
