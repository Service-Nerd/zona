import { describe, it, expect } from 'vitest'
import { onRampCurve, onRampWeeksNeeded, assessOnRamp } from './baseBuildOnRamp'
import { GENERATION_CONFIG as C } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', fitness_level: 'beginner', current_weekly_km: 10,
  longest_recent_run_km: 4, age: 30, injuries: [],
  recent_quality_training: 'none',
  // ⚠️ SPREAD LAST. The first cut of this helper omitted `...over` entirely, so
  // every case ran on the default input and ELEVEN TESTS PASSED without
  // exercising what they claimed. Two failed, which is the only reason it was
  // caught. A fixture that silently ignores its own argument is worse than no
  // fixture: it manufactures green.
  ...over,
} as unknown as GeneratorInput)

describe('§116 onRampCurve — §2 rate, §3 cadence', () => {
  it('climbs at §2s rate, not §57s flat ceiling — the defect this closes', () => {
    const c = onRampCurve(10, 3)
    expect(c[0]).toBe(10)
    expect(c[1]).toBeCloseTo(11, 1)
    expect(c[2]).toBeCloseTo(12.1, 1)
    // §57's curve would be 10, 11, 11 — flat from week 2 at any length.
    expect(c[2]).toBeGreaterThan(c[1])
  })

  it('dips on §3s cadence', () => {
    const c = onRampCurve(10, 6)
    const freq = C.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
    expect(c[freq - 1]).toBeLessThan(c[freq - 2])
  })

  // The deload RATCHET is a defect this repo has already recorded once.
  it('resumes the climb from the build line, not from the dip', () => {
    const c = onRampCurve(10, 6)
    const freq = C.BASE_BUILD_ONRAMP_DELOAD_FREQUENCY
    expect(c[freq]).toBeGreaterThan(c[freq - 2])
  })

  it('never hands over on a deload week', () => {
    for (let w = 2; w <= 16; w++) {
      const c = onRampCurve(10, w)
      expect(c[w - 1], `ramp of ${w} weeks ends in a dip`).toBeGreaterThanOrEqual(c[w - 2])
    }
  })
})

describe('§116 onRampWeeksNeeded', () => {
  it('reaches the target and reports the shortest ramp that does', () => {
    const w = onRampWeeksNeeded(8, 18)
    expect(w).toBeGreaterThan(0)
    expect(onRampCurve(8, w).at(-1)!).toBeGreaterThanOrEqual(18)
    expect(onRampCurve(8, w - 1).at(-1)!).toBeLessThan(18)
  })

  it('returns 0 when the runner is already there', () => {
    expect(onRampWeeksNeeded(20, 18)).toBe(0)
  })

  it('terminates rather than looping on an unreachable target', () => {
    expect(onRampWeeksNeeded(1, 9999)).toBe(C.BASE_BUILD_ONRAMP_MAX_WEEKS)
  })
})

describe('§116 assessOnRamp — the board amendments, each as an assertion', () => {
  it('offers a ramp to the runner §111 refuses, when the runway allows', () => {
    const a = assessOnRamp(input({ current_weekly_km: 10 }), 18, 29)
    expect(a.outcome).toBe('offered')
    expect(a.rampWeeks).toBeGreaterThan(0)
    expect(a.remainingWeeks).toBeGreaterThanOrEqual(C.BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS)
  })

  // McMillan, amendment 3 — §44's ratified threshold, not a new number.
  it('refuses when the ramp would leave under 16 weeks of race plan', () => {
    const a = assessOnRamp(input({ current_weekly_km: 10 }), 18, 18)
    expect(a.outcome).toBe('insufficient_runway')
    // ⚠️ and it still reports the numbers, so the runner can be told WHY.
    expect(a.rampWeeks).toBeGreaterThan(0)
    expect(a.remainingWeeks).toBeLessThan(C.BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS)
  })

  // Willy — run-walk is explicitly not scoped, and this is the boundary.
  it('declines below the floor where a RUNNING ramp is the right tool', () => {
    const a = assessOnRamp(input({ current_weekly_km: 3 }), 18, 40)
    expect(a.outcome).toBe('below_floor')
  })

  it('says not_needed rather than offering a ramp to nowhere', () => {
    expect(assessOnRamp(input({ current_weekly_km: 40 }), 18, 30).outcome).toBe('not_needed')
  })

  // §111 Am. 2 — the denominator is the volume the ENGINE starts from.
  it('starts from effectiveStartKm, not the raw wizard figure', () => {
    // ⚠️ `weeks_at_current_volume`, not an invented `fresh_return` flag. The
    // first cut used the latter, which is not a field on GeneratorInput, so the
    // scaling never applied and the test asserted 20 < 20. The product's own
    // spelling, every time — this repo has three injury types that were dead in
    // production for exactly this reason.
    const fresh = assessOnRamp(
      input({ current_weekly_km: 20, weeks_at_current_volume: 1 } as any), 30, 40)
    expect(fresh.startKm).toBeLessThan(20)
  })

  it('never reports offered without a positive ramp length', () => {
    for (const cwk of [6, 8, 10, 12, 15, 18, 25]) {
      const a = assessOnRamp(input({ current_weekly_km: cwk }), 18, 30)
      if (a.outcome === 'offered') expect(a.rampWeeks).toBeGreaterThan(0)
    }
  })
})
