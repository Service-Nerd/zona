import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BEHIND_VERDICT_MIN_SESSIONS } from './constants'

/**
 * COACH-BEHIND-DAY-TWO-01 / §65 Amendment — the verdict, not just the window.
 *
 * 🔴 THE DEFECT WAS A REACHABILITY HOLE, so this test is EXHAUSTIVE rather
 * than example-based. The old softener fired at `done / dueRef >= 0.7`, which
 * cannot be satisfied below four sessions due:
 *
 *     dueRef=1 NEVER · 2 NEVER · 3 NEVER · 4 at done=3 · 5 at 4 · 6 at 5 · 7 at 5,6
 *
 * `dueRef` never exceeds the week's planned sessions, so a THREE-DAY-A-WEEK
 * runner could never see it — in any week, at any point in any plan. 29.0% of
 * the cohort grid. §65's date arithmetic was correct throughout; its PURPOSE
 * ("the product can't accuse the runner of falling behind before lunch") was
 * not met for nearly a third of runners.
 *
 * ⚠️ AN EXAMPLE-BASED TEST WOULD HAVE PASSED THE WHOLE TIME. Pick dueRef=5,
 * done=4 and the softener works beautifully. The hole is only visible by
 * enumerating the domain, which is why this does.
 */

/** The verdict, mirrored from `sessionsContext` in DashboardClient. */
function verdict(done: number, dueRef: number): { label: string; judged: boolean } {
  if (dueRef === 0) return { label: 'on track', judged: false }
  const behind = dueRef - done
  if (behind <= 0) return { label: 'on track', judged: false }
  if (done / dueRef >= 0.7) return { label: 'on track', judged: false }
  if (behind < BEHIND_VERDICT_MIN_SESSIONS) return { label: `${behind} still to do`, judged: false }
  return { label: `${behind} behind`, judged: true }
}

describe('§65 Amendment — a single outstanding session is never a judgement', () => {
  it('mirrors the shipped implementation, not a copy that can drift', () => {
    // ⚠️ `tierResolution.test.ts` once asserted its own private copy of the
    // rule and so could not catch either producer drifting. This cannot import
    // `sessionsContext` (it is defined inside a component), so instead it
    // asserts the SHIPPED SOURCE still has the shape this mirror encodes.
    const shell = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    expect(shell).toContain('if (behind < BEHIND_VERDICT_MIN_SESSIONS) {')
    expect(shell).toMatch(/\$\{behind\} still to do/)
    expect(shell).toMatch(/if \(done \/ dueRef >= 0\.7\)/)
  })

  it('is reachable at EVERY session count from 1 to 7', () => {
    // The whole finding: the old softener was unreachable below 4.
    for (let dueRef = 1; dueRef <= 7; dueRef++) {
      const softened = []
      for (let done = 0; done < dueRef; done++) if (!verdict(done, dueRef).judged) softened.push(done)
      expect(softened.length, `dueRef=${dueRef}: no un-judged outcome exists`).toBeGreaterThan(0)
    }
  })

  it('the three-day runner can miss one session without being judged', () => {
    // 29.0% of the grid. This is the case that could never happen before.
    for (const dueRef of [1, 2, 3]) {
      const v = verdict(dueRef - 1, dueRef)
      expect(v.judged, `dueRef=${dueRef}, one outstanding, must not be judged`).toBe(false)
      expect(v.label).toBe('1 still to do')
    }
  })

  it('still judges a runner who has done NONE of three', () => {
    // Additive, not a blanket softener. A real signal stays a real signal.
    expect(verdict(0, 3)).toEqual({ label: '3 behind', judged: true })
    expect(verdict(0, 2)).toEqual({ label: '2 behind', judged: true })
  })

  it('does not regress the existing 0.7 softener', () => {
    // A runner 2 of 7 behind was softened before and must still be.
    expect(verdict(5, 7).judged).toBe(false)
    expect(verdict(3, 4).judged).toBe(false)
    expect(verdict(4, 5).judged).toBe(false)
  })

  it('the bound is the named constant, substituted rather than read past', () => {
    expect(BEHIND_VERDICT_MIN_SESSIONS).toBe(2)
    // Falsifier: at 1 the rule is inert (behind < 1 is impossible when
    // behind > 0), which is how a "fix" ships and does nothing.
    expect(BEHIND_VERDICT_MIN_SESSIONS).toBeGreaterThan(1)
  })
})
