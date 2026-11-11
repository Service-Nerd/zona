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

  it('a FAILED read falls back to the signup window — an outage must not extend access', () => {
    // 🔴 "No read" grants the 30-day cap, so swallowing a failed query as "no read" would hand
    // out two extra weeks on our own error. The first cut discarded the error entirely.
    const w = on(null, plus(START, 20), true)
    expect(w.basis).toBe('signup')
    expect(w.endsAt!.getTime()).toBe(START.getTime() + TRIAL_DAYS * DAY)
    expect(w.active, 'a failed read extended a trial that should have ended').toBe(false)
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
    for (const src of [TRIAL_TS, CLIENT_TSX]) {
      const at = src.indexOf("from('run_analysis')")
      expect(at, 'the first-read query is gone').toBeGreaterThan(-1)
      const q = src.slice(at, at + 320)
      expect(q, 'the first-read clock filters superseded rows again — that is non-monotonic')
        .not.toMatch(/\.is\('superseded_at',\s*null\)/)
      expect(q, 'the earliest read is no longer the one taken').toMatch(/ascending:\s*true/)
    }
  })
})

const TRIAL_TS   = readFileSync('lib/trial.ts', 'utf8')
const CLIENT_TSX = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

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

  /** Consumers that still compute the trial from the signup stamp rather than the owner. */
  const signupRelative = FILES.filter(f => {
    if (f === 'lib/trial.ts') return false            // the owner itself
    const src = readFileSync(f, 'utf8').replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
    return /trialDayNumber\s*\(/.test(src)
        || /new Date\((trialStartedAt|settings\.trial_started_at)\)[^\n]*TRIAL_DAYS/.test(src)
  })

  /** `resolveTier` callers that do not hand it the first read. */
  const unwiredCallers = FILES.filter(f => {
    if (f === 'lib/trial.ts') return false            // getUserTier is wired in-file
    const src = readFileSync(f, 'utf8')
    const at = src.indexOf('resolveTier(')
    if (at === -1) return false                       // not a caller
    return !/firstReadAt/.test(src.slice(at, at + 700))
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
    expect(TRIAL_TS, 'getUserTier no longer passes firstReadAt').toMatch(/firstReadAt,\s*\n\s*firstReadUnavailable,/)
    expect(CLIENT_TSX, 'the client mirror no longer passes firstReadAt').toMatch(/firstReadAt,\s*\n\s*firstReadUnavailable,/)
  })

  it('neither wired caller pays for the read while the flag is off', () => {
    for (const [name, src] of [['getUserTier', TRIAL_TS], ['DashboardClient', CLIENT_TSX]] as const) {
      const at = src.indexOf("from('run_analysis')")
      const before = src.slice(Math.max(0, at - 400), at)
      expect(before, `${name} fetches run_analysis outside the flag — the OFF path must cost nothing`)
        .toMatch(/if\s*\(TRIAL_STARTS_AT_FIRST_READ\)/)
    }
  })

  it('the in-app countdown reads the owner, not its own arithmetic', () => {
    // On the cap path, `trial_started_at + TRIAL_DAYS` would show "0 days left" to a runner
    // with ten — the tier and the number on screen disagreeing.
    expect(CLIENT_TSX).toMatch(/resolveTrialWindow\(\{\s*trialStartedAt,\s*firstReadAt,\s*firstReadUnavailable\s*\}/)
  })
})
