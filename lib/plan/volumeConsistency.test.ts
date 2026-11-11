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
import { formatDistance } from '@/lib/format'

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
  const m = volumePairMessage(10, 20, 'km')
  it('states both numbers back, so the runner can see the contradiction', () => {
    expect(m).toContain(formatDistance(20, 'km', { exact: true }) as string)
    expect(m).toContain(formatDistance(10, 'km', { exact: true }) as string)
  })
  it('tells the runner they may change EITHER, because we do not know which is wrong', () => {
    expect(m).toMatch(/Adjust either number/)
  })
  it('does not tell the runner they are wrong, and carries no em dash', () => {
    expect(m).not.toMatch(/invalid|error|cannot continue|you must/i)
    expect(m).not.toContain('—')
  })

  // 🔴 THE UNITS ARM, AND IT IS HERE BECAUSE THE FIRST CUT FAILED. The message welded
  // `km` to the interpolated values, `lib/hardcodedUnits.test.ts` (PREF-SWEEP-01) caught
  // it and THE SUITE WENT RED — a miles-preferring runner would have read kilometres on
  // the one step that exists to make two numbers agree. ADR-015 / INV-PREF-001:
  // `lib/format.ts` is the sole owner of every distance string.
  it('honours the runner’s units, and says nothing in km to a miles runner', () => {
    const mi = volumePairMessage(10, 20, 'mi')
    expect(mi).not.toMatch(/\bkm\b/)
    expect(mi).toMatch(/mi\b/)
    // The NUMBERS must convert, not just the suffix: 20 km is 12.4 mi, 10 km is 6.2.
    expect(mi).toContain('12.4')
    expect(mi).toContain('6.2')
  })

  it('routes through lib/format, so it cannot hold its own conversion', () => {
    expect(volumePairMessage(10, 20, 'mi'))
      .toContain(formatDistance(20, 'mi', { exact: true }) as string)
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

  it('the SUBMIT path gates too, because canProceed is not the only exit', () => {
    // 🔴 Found by code review. A restored draft sets `appStep` from sessionStorage so a
    // runner resuming past `longest-run` never re-evaluates the step, and
    // `handleGenerate` substitutes RULER ANCHORS for nulls, so the posted pair is not
    // always the pair the step saw. `inputs.ts` only range-checks each field, so the
    // server does not refuse the combination either.
    // 🔴 ANCHORED ON THE WHOLE CONDITION, because the first cut of THIS ARM was hollow:
    // it grepped for the call, and `if (false && volumePairProblem(...))` left the call
    // text intact and the arm green. A source assertion must pin the condition, not its
    // substring. (It still cannot prove the branch RUNS — declared limit.)
    // ⚠️ Updated by the code-review round: the gate now judges the RAW pair, so this arm
    // pins `weeklyKm, longestRun`. It went red on that change, which is what it is for.
    expect(WIZ).toMatch(/\n\s*if \(volumePairProblem\(weeklyKm, longestRun\)\) \{/)
    expect(WIZ).toMatch(/setAppStep\('longest-run'\)/)
  })

  it('the submit gate judges the RAW pair, never the anchor-substituted one', () => {
    // 🔴 The first cut gated on `weeklyKmVal`/`longestRunVal`, which fall back to the
    // ruler ANCHORS when the state is null. With `weeklyKm` null the substituted pair
    // could violate while the step saw nothing to fix: no reason rendered, `canProceed`
    // true, and the runner loops submit → longest-run → submit. Found by code review.
    expect(WIZ).toMatch(/\n\s*if \(volumePairProblem\(weeklyKm, longestRun\)\) \{/)
    expect(WIZ).not.toMatch(/volumePairProblem\(weeklyKmVal, longestRunVal\)/)
  })

  it('bounces to the step that owns the MISSING number, not always to longest-run', () => {
    expect(WIZ).toMatch(/if \(weeklyKm == null\) \{ setAppStep\('weekly-volume'\); return \}/)
    expect(WIZ).toMatch(/if \(longestRun == null\) \{ setAppStep\('longest-run'\); return \}/)
  })

  it('neither consumer re-implements the comparison', () => {
    // A second copy of `longest > weekly` is the DELOAD-OWNER-01 shape this extraction
    // removed, and it is exactly what the invariant held before.
    expect(INV).not.toMatch(/statedLongest\s*>\s*statedWeekly/)
    expect(WIZ).not.toMatch(/longestRun\s*>\s*weeklyKm/)
  })
})
