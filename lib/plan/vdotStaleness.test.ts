import { describe, it, expect } from 'vitest'
import { applyVdotDiscount } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'

/**
 * §42 — the VDOT staleness ramp.
 *
 * §10 discounts every benchmark by a base 3% so the plan is not built on
 * race-day output. §42 makes that discount GRADUATED with benchmark age:
 * +1% per 4-week block past the fresh window, capped at 7%. It replaced a
 * binary 6-month cliff that jumped 3% → 8%.
 *
 * Nothing asserted the ladder. `raceBaselineHonesty.test.ts` USES the discount
 * (it is why a same-measurement arc reads as decline) but never checks which
 * rung a given age lands on — a test that exercises a function is not a test of
 * the rule the function implements.
 *
 * The worked examples in §42 are the fixture: 0-4 weeks 3%, 5-8 4%, 9-12 5%,
 * 13-16 6%, 17+ 7%.
 */
const BASE = GENERATION_CONFIG.VDOT_CONSERVATIVE_DISCOUNT_PCT
const CAP  = GENERATION_CONFIG.VDOT_STALENESS_MAX_DISCOUNT_PCT
const TODAY = new Date('2026-06-01T00:00:00Z')

const weeksAgo = (w: number) =>
  new Date(TODAY.getTime() - w * 7 * 86_400_000).toISOString().slice(0, 10)

const pctAt = (w: number) =>
  applyVdotDiscount(50, { distance_km: 5, time_seconds: 1500, benchmark_date: weeksAgo(w) } as never, TODAY).discountPct

describe('§42 — the discount grows with benchmark age', () => {
  it('a fresh benchmark gets the §10 base only', () => {
    expect(pctAt(0)).toBe(BASE)
    expect(pctAt(GENERATION_CONFIG.VDOT_STALENESS_FRESH_WEEKS - 0.5)).toBe(BASE)
  })

  it('walks §42\'s own worked examples, one rung per 4-week block', () => {
    expect(pctAt(6)).toBe(BASE + 1)    // 5-8 weeks
    expect(pctAt(10)).toBe(BASE + 2)   // 9-12
    expect(pctAt(14)).toBe(BASE + 3)   // 13-16
  })

  it('caps rather than running away on a very old benchmark', () => {
    // The right answer past the cap is "ask for a re-test", not "discount more".
    expect(pctAt(20)).toBe(CAP)
    expect(pctAt(200)).toBe(CAP)
  })

  it('never falls below the base or above the cap, at any age', () => {
    for (let w = 0; w <= 60; w += 0.5) {
      const p = pctAt(w)
      expect(p, `${w} weeks old`).toBeGreaterThanOrEqual(BASE)
      expect(p, `${w} weeks old`).toBeLessThanOrEqual(CAP)
    }
  })

  it('is monotonic — waiting never makes the engine LESS conservative', () => {
    let prev = -Infinity
    for (let w = 0; w <= 60; w += 0.5) {
      const p = pctAt(w)
      expect(p, `${w} weeks old went backwards`).toBeGreaterThanOrEqual(prev)
      prev = p
    }
  })

  it('an undated benchmark gets the base, not a staleness guess', () => {
    const r = applyVdotDiscount(50, { distance_km: 5, time_seconds: 1500 } as never, TODAY)
    expect(r.discountPct).toBe(BASE)
  })

  it('the discount actually reaches the returned VDOT', () => {
    // FALSIFICATION: a discountPct reported but not applied would pass every
    // assertion above. This is the one that catches it.
    const r = applyVdotDiscount(50, { distance_km: 5, time_seconds: 1500, benchmark_date: weeksAgo(20) } as never, TODAY)
    expect(r.vdot).toBeCloseTo(50 * (1 - CAP / 100), 6)
  })
})
