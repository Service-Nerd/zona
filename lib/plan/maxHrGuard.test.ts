import { describe, it, expect } from 'vitest'
import { resolveMaxHr, tanakaMaxHR } from './maxHrGuard'

// CoachingPrinciples §50 asymmetry (HR-MAX-01). A recorded max is a lower bound
// on the true max: below the estimate it is a floor (reject), above it is real
// (trust up to the artifact ceiling). Only a user-confirmed max is trusted below.
describe('resolveMaxHr — §50 asymmetric max-HR guard', () => {
  const AGE = 44
  const EST = tanakaMaxHR(AGE) // 208 − 0.7×44 = 177

  it('tanakaMaxHR matches the exempt formula', () => {
    expect(EST).toBe(177)
  })

  // The founder case — the whole reason this exists.
  it('rejects the founder floor (159 observed, below 177 estimate) even though it is only ~10% below', () => {
    const r = resolveMaxHr(159, AGE, 'observed')
    expect(r.outcome).toBe('floored')
    expect(r.effectiveMax).toBe(EST) // 177, not 159
  })

  it('rejects an unattributed sub-estimate max (device-floor laundering via user_settings)', () => {
    const r = resolveMaxHr(159, AGE, undefined)
    expect(r.outcome).toBe('floored')
    expect(r.effectiveMax).toBe(EST)
  })

  it('rejects an observed max just 1 bpm below the estimate — the low-side tolerance is 0', () => {
    const r = resolveMaxHr(EST - 1, AGE, 'observed')
    expect(r.outcome).toBe('floored')
    expect(r.effectiveMax).toBe(EST)
  })

  // The escape hatch — genuine low-max athletes exist.
  it('trusts a user-confirmed max below the estimate', () => {
    const r = resolveMaxHr(159, AGE, 'user_confirmed')
    expect(r.outcome).toBe('trusted')
    expect(r.effectiveMax).toBe(159)
  })

  // Above the estimate — a recorded rate must have physically occurred.
  it('trusts an observed max above the estimate (real hard effort)', () => {
    const r = resolveMaxHr(EST + 8, AGE, 'observed') // 185, true-max territory
    expect(r.outcome).toBe('trusted')
    expect(r.effectiveMax).toBe(EST + 8)
  })

  it('trusts a max exactly at the estimate', () => {
    const r = resolveMaxHr(EST, AGE, 'observed')
    expect(r.outcome).toBe('trusted')
    expect(r.effectiveMax).toBe(EST)
  })

  it('rejects an implausibly high max as a sensor artifact (beyond the upper tolerance)', () => {
    const r = resolveMaxHr(Math.round(EST * 1.16), AGE, 'observed') // >15% above
    expect(r.outcome).toBe('implausibly_high')
    expect(r.effectiveMax).toBe(EST)
  })

  it('trusts a high max within the upper tolerance', () => {
    const r = resolveMaxHr(Math.round(EST * 1.10), AGE, undefined) // ~195, within +15%
    expect(r.outcome).toBe('trusted')
  })

  // No supplied max → estimate.
  it('falls back to the estimate when no max is supplied', () => {
    for (const empty of [null, undefined, 0]) {
      const r = resolveMaxHr(empty as number | null | undefined, AGE, undefined)
      expect(r.outcome).toBe('estimated')
      expect(r.effectiveMax).toBe(EST)
    }
  })
})
