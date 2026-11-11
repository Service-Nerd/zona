// §18 / §10 — WIZARD-CONTRADICTORY-VOLUME-01 (Coaching Board 2026-11-11).
//
// 📐 Measured against stored plans 2026-11-11: **2 of 43** trip
// `INV-INPUT-LONGEST-LE-WEEKLY`, which is what the item said. ⚠️ A third carries
// `longest 5 km > weekly 0 km` and does NOT trip it, because the rule is guarded on
// `weekly > 0` so the meta-empty validation path self-skips. **The raw comparison finds 3
// and the rule finds 2; both are right about different populations**, and the guard is
// mirrored rather than tightened so the screen cannot refuse what the server accepts.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { volumePairProblem, volumePairMessage } from './volumeConsistency'

describe('volumePairProblem — the one owner the screen and the server share', () => {
  it('flags the two shapes measured on live plans', () => {
    expect(volumePairProblem(5, 6)).toBe('longest_exceeds_weekly')     // b96fe13a
    expect(volumePairProblem(10, 20)).toBe('longest_exceeds_weekly')   // 02ed8b4b
  })

  it('is silent when the longest run equals the week, which is a real 1-run week', () => {
    expect(volumePairProblem(20, 20)).toBeNull()
  })

  it('is silent when the longest run is smaller, which is every normal case', () => {
    expect(volumePairProblem(40, 18)).toBeNull()
  })

  it('SKIPS a declared zero week, exactly as the invariant does', () => {
    // 2a1aa04e has longest 5 against weekly 0 and does NOT trip the invariant. Mirrored
    // deliberately: a screen that refuses what the server accepts is a second answer, not
    // a stricter one. The declared zero is §10's own business.
    expect(volumePairProblem(0, 5)).toBeNull()
    expect(volumePairProblem(null, 5)).toBeNull()
    expect(volumePairProblem(undefined, 20)).toBeNull()
  })

  it('treats a missing longest run as nothing to judge, never as zero', () => {
    expect(volumePairProblem(30, null)).toBeNull()
    expect(volumePairProblem(30, undefined)).toBeNull()
  })
})

describe('the message states both numbers and names the lever', () => {
  const m = volumePairMessage(10, 20)
  it('states both numbers back, so the runner can see the contradiction', () => {
    expect(m).toContain('20 km')
    expect(m).toContain('10 km')
  })
  it('tells the runner they may change EITHER, because we do not know which is wrong', () => {
    expect(m).toMatch(/Adjust either number/)
  })
  it('does not tell the runner they are wrong, and carries no em dash', () => {
    expect(m).not.toMatch(/invalid|error|cannot continue|you must/i)
    expect(m).not.toContain('—')
  })
})

describe('both consumers call the owner — not a copy of it', () => {
  const strip = (s: string) => s
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => ' '.repeat(m.length))
  const INV = strip(readFileSync('lib/plan/invariants.ts', 'utf8'))
  const WIZ = strip(readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8'))

  it('the SERVER invariant calls it', () => {
    expect(INV).toMatch(/volumePairProblem\(/)
  })

  it('the WIZARD gates its step on it — GATE-EVERY-EXIT-FROM-A-STEP', () => {
    // The item's own finding: "the invariant exists and fires; the wizard that collects
    // the two numbers never compares them." The gate must be ON the step, not elsewhere.
    expect(WIZ).toMatch(/case 'longest-run':\s*return longestRun !== null && volumePairProblem\(/)
  })

  it('the wizard also SHOWS the reason, so a disabled Next is never silent', () => {
    expect(WIZ).toMatch(/volumePairMessage\(/)
  })

  it('neither consumer re-implements the comparison', () => {
    // A second copy of `longest > weekly` is the DELOAD-OWNER-01 shape this extraction
    // removed, and it is exactly what the invariant held before.
    expect(INV).not.toMatch(/statedLongest\s*>\s*statedWeekly/)
    expect(WIZ).not.toMatch(/longestRun\s*>\s*weeklyKm/)
  })
})
