/**
 * `startVolume` — the single owner of "what weekly volume does the engine
 * actually START this runner at?".
 *
 * Written 2026-09-19 during the regression pass: this module had TWO callers
 * and ZERO tests, and one of them is §111's refusal gate. An error here does
 * not produce a wrong plan — it produces a runner who is turned away, or one
 * who is admitted to a build they cannot take.
 */
import { describe, it, expect } from 'vitest'
import { isFreshReturn, effectiveStartKm } from './startVolume'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const mk = (o: Partial<GeneratorInput>) => ({
  current_weekly_km: 30, longest_recent_run_km: 12, training_age: '1-2yr',
  ...o,
} as unknown as GeneratorInput)

describe('isFreshReturn — §29', () => {
  it('EXPLICIT: weeks_at_current_volume under the threshold', () => {
    const t = G.FRESH_RETURN_WEEKS_THRESHOLD
    expect(isFreshReturn(mk({ weeks_at_current_volume: t - 1 }))).toBe(true)
    expect(isFreshReturn(mk({ weeks_at_current_volume: t }))).toBe(false)
  })

  it('the explicit path is OFF when the field is absent — undefined is not zero', () => {
    // `weeks_at_current_volume === undefined` must not read as "0 weeks", which
    // would make every runner who skipped the question a fresh returner.
    expect(isFreshReturn(mk({}))).toBe(false)
  })

  it('HEURISTIC: an experienced training age contradicted by low volume AND a short longest run', () => {
    const lowKm = G.HEURISTIC_FRESH_RETURN_WEEKLY_KM - 1
    const shortLr = G.HEURISTIC_FRESH_RETURN_LONG_RUN_KM - 1
    for (const age of ['2-5yr', '5yr+'] as const) {
      expect(isFreshReturn(mk({ training_age: age, current_weekly_km: lowKm, longest_recent_run_km: shortLr })))
        .toBe(true)
    }
    // BOTH signals are required — either alone is an ordinary runner.
    expect(isFreshReturn(mk({ training_age: '5yr+', current_weekly_km: lowKm, longest_recent_run_km: shortLr + 50 }))).toBe(false)
    expect(isFreshReturn(mk({ training_age: '5yr+', current_weekly_km: lowKm + 50, longest_recent_run_km: shortLr }))).toBe(false)
  })

  it('the heuristic does NOT fire for a genuine newer runner at the same volumes', () => {
    // A '<6mo' runner at 10 km/week is not returning from anywhere — they are
    // simply new, and §10 governs them instead.
    expect(isFreshReturn(mk({
      training_age: '<6mo',
      current_weekly_km: G.HEURISTIC_FRESH_RETURN_WEEKLY_KM - 1,
      longest_recent_run_km: G.HEURISTIC_FRESH_RETURN_LONG_RUN_KM - 1,
    }))).toBe(false)
  })
})

describe('effectiveStartKm — the number §111 divides by', () => {
  it('an ordinary runner starts where they say they are', () => {
    expect(effectiveStartKm(mk({ current_weekly_km: 40 }))).toBe(40)
  })

  it('§29 scales a fresh returner DOWN', () => {
    const km = 40
    const got = effectiveStartKm(mk({ current_weekly_km: km, weeks_at_current_volume: 1 }))
    expect(got).toBeCloseTo(km * G.FRESH_RETURN_START_FRACTION, 6)
    expect(got).toBeLessThan(km)
  })

  it('§10 caps a `<6mo` runner however much they claim', () => {
    const cap = G.BEGINNER_WEEK1_VOLUME_CAP_KM
    expect(effectiveStartKm(mk({ training_age: '<6mo', current_weekly_km: 80 }))).toBe(cap)
    // and does NOT raise someone who is below it
    expect(effectiveStartKm(mk({ training_age: '<6mo', current_weekly_km: cap - 10 }))).toBe(cap - 10)
  })

  it('BOTH rules compose — the scale happens first, then the cap', () => {
    // The order matters: capping first then scaling would start a fresh-return
    // beginner materially lower than either rule intends.
    const km = 80
    const scaled = km * G.FRESH_RETURN_START_FRACTION
    const expected = Math.min(scaled, G.BEGINNER_WEEK1_VOLUME_CAP_KM)
    expect(effectiveStartKm(mk({ training_age: '<6mo', current_weekly_km: km, weeks_at_current_volume: 1 })))
      .toBeCloseTo(expected, 6)
  })

  it('is never negative and never NaN, whatever the input', () => {
    // It is a DENOMINATOR in §111 — a NaN here silently admits everyone and a
    // zero refuses everyone.
    for (const km of [0, 1, 200]) {
      const v = effectiveStartKm(mk({ current_weekly_km: km }))
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })
})
