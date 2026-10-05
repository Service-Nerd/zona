import { describe, it, expect, afterEach, vi } from 'vitest'
import { distanceEnvelope } from './useCaseEnvelope'
import { generateRulePlan } from './ruleEngine'

/**
 * COHORT-REVIEW-CLOCK-01 — the harness must measure the cohort it DECLARES.
 *
 * 🔴 `scripts/cohort-review.ts` called `generateRulePlan(c.input, 'paid')` with no
 * `planStart`, so the engine derived one from `nextMonday(new Date())`. Two consequences,
 * and the second is worse than the first:
 *
 *   1. The table moved on a DATE. Fri 2026-10-02 and Sun 10-04 both derive 2026-10-04, so
 *      `verify` was green; Mon 10-05 derives 2026-10-11, a seven-day jump, and `verify`
 *      went red with no code change at all.
 *   2. `distanceEnvelope` computes each `race_date` as `plan_start + N weeks` from its own
 *      pinned 2026-11-02. Planning from next Monday instead — about four weeks earlier —
 *      made every case's REAL window ~4 weeks longer than declared. **The grid was not
 *      measuring the cohort it described.**
 *
 * ⚠️ AND THE FIRST DIAGNOSIS WAS WRONG. I attributed it to the foundation runway crossing
 * `FOUNDATION_GAP_AUTO_DAYS` (31 → 29 → 28 days, 'choice' → 'auto' overnight). That
 * arithmetic is real and irrelevant: pinning `todayOverride` changed the table by nothing,
 * on four different pin dates. The clock reached generation through `nextMonday`, not the
 * override. A plausible mechanism that matches the dates is not the mechanism.
 *
 * This gate asserts the property directly, so no future caller can quietly go back to a
 * derived start: a plan generated from an envelope case must begin where the case says.
 */
describe('cohort-review envelope — generation must not depend on the wall clock', () => {
  // Every 60th case, not every 25th. At 25 these two arms cost 8.3s and 5.7s and tripped
  // `check:slow`; the property is structural so it does not need a dense sample — it needs
  // ENOUGH cases that the vacuity arms below are meaningful, which they assert directly.
  const SAMPLE = 60
  // The exact shift that broke it: Sunday and Monday derive plan starts a week apart.
  const SUN = new Date('2026-10-04T12:00:00')   // nextMonday -> 2026-10-04
  const MON = new Date('2026-10-05T12:00:00')   // nextMonday -> 2026-10-11

  afterEach(() => { vi.useRealTimers() })

  /**
   * ⚠️ IT TAKES A FAKE SYSTEM CLOCK, AND THAT IS THE FINDING.
   * `todayOverride` does NOT reach this: `nextMonday(new Date())` reads the real clock, so
   * varying the override changed the table by nothing on four different pin dates. Two
   * earlier versions of this gate were vacuous for exactly that reason — one asserted the
   * plan starts where the case declares (it does not; the engine derived 2027-01-18 from a
   * declared 2026-11-02), the other varied `todayOverride` and found zero divergence.
   * Only `vi.setSystemTime` moves the clock this code actually reads.
   */
  const plansFor = (at: Date, passStart: boolean) => {
    vi.useFakeTimers(); vi.setSystemTime(at)
    try {
      const out: string[] = []
      for (const c of distanceEnvelope(42.2).filter((_, i) => i % SAMPLE === 0)) {
        const declared = (c.input as { plan_start?: string }).plan_start
        try {
          const p = generateRulePlan(
            c.input as never, 'paid', passStart ? declared : undefined, undefined, declared)
          out.push(JSON.stringify(p.weeks))
        } catch { out.push('REFUSED') }
      }
      return out
    } finally { vi.useRealTimers() }
  }

  it('🔴 THE DEFECT, REPRODUCED: with NO plan_start, Sunday and Monday generate different plans', () => {
    const a = plansFor(SUN, false)
    const b = plansFor(MON, false)
    expect(a.length).toBeGreaterThan(0)
    expect(a.length).toBe(b.length)
    const diverged = a.filter((x, i) => x !== b[i]).length
    // This is why `verify` went red on a date with no code change. If it ever reads 0 the
    // engine has changed and the arm below is no longer proving anything.
    expect(diverged).toBeGreaterThan(0)
  })

  it('✅ THE FIX: passing the envelope\'s own plan_start makes the two days identical', () => {
    const a = plansFor(SUN, true)
    const b = plansFor(MON, true)
    expect(a.length).toBeGreaterThan(0)
    expect(a.filter((x, i) => x !== b[i]).length).toBe(0)
    // Vacuity arm: all-refused would make the comparison above trivially true.
    expect(a.filter(x => x !== 'REFUSED').length).toBeGreaterThan(0)
  })

  it('the envelope pins plan_start, and its race dates are derived FROM that pin', () => {
    const cases = distanceEnvelope(42.2)
    const starts = new Set(cases.map(c => (c.input as { plan_start?: string }).plan_start))
    // One pinned start for the whole grid — if this ever fans out, the baseline's
    // comparability across rows is gone.
    expect(starts.size).toBe(1)
    const start = Array.from(starts)[0]!
    for (const c of cases.slice(0, 40)) {
      const race = (c.input as { race_date?: string }).race_date!
      // Every race must fall AFTER its declared start, or the window is negative and the
      // case is measuring something the envelope did not intend.
      expect(new Date(race).getTime()).toBeGreaterThan(new Date(start).getTime())
    }
  })
})
