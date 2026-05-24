import { describe, it, expect } from 'vitest'
import { computePaceFadeSummary, type StravaSplitMetric } from './paceAnalysis'

const split = (overrides: Partial<StravaSplitMetric> = {}): StravaSplitMetric => ({
  distance:      1000,
  moving_time:   300,  // 5:00/km
  average_speed: 1000 / 300,
  ...overrides,
})

describe('computePaceFadeSummary', () => {
  it('returns null for empty/missing input', () => {
    expect(computePaceFadeSummary(null)).toBeNull()
    expect(computePaceFadeSummary(undefined)).toBeNull()
    expect(computePaceFadeSummary([])).toBeNull()
  })

  it('returns null when fewer than 6 usable splits', () => {
    const splits = Array(5).fill(null).map(() => split())
    expect(computePaceFadeSummary(splits)).toBeNull()
  })

  it('detects steady run with no fade', () => {
    const splits = Array(10).fill(null).map(() => split({ moving_time: 300 }))
    const r = computePaceFadeSummary(splits)
    expect(r).not.toBeNull()
    expect(r!.paceFadeSecPerKm).toBe(0)
    expect(r!.firstHalfAvgPaceSecPerKm).toBe(300)
    expect(r!.backHalfAvgPaceSecPerKm).toBe(300)
  })

  it('detects clear fade — first half 5:00, back half 5:30', () => {
    const fast = split({ moving_time: 300 })   // 5:00/km
    const slow = split({ moving_time: 330 })   // 5:30/km
    const splits = [fast, fast, fast, fast, fast, slow, slow, slow, slow, slow]
    const r = computePaceFadeSummary(splits)
    expect(r).not.toBeNull()
    expect(r!.firstHalfAvgPaceSecPerKm).toBe(300)
    expect(r!.backHalfAvgPaceSecPerKm).toBe(330)
    expect(r!.paceFadeSecPerKm).toBe(30)
    expect(r!.paceFadePct).toBeCloseTo(0.1, 2)
  })

  it('detects negative split — back half faster', () => {
    const slow = split({ moving_time: 330 })
    const fast = split({ moving_time: 300 })
    const splits = [slow, slow, slow, slow, slow, fast, fast, fast, fast, fast]
    const r = computePaceFadeSummary(splits)
    expect(r!.paceFadeSecPerKm).toBe(-30)
  })

  it('filters out a short tail split', () => {
    // 6 full-km splits + 1 short tail. With tail excluded we have 6 usable.
    const full = split({ moving_time: 300 })
    const tail = split({ distance: 400, moving_time: 120, average_speed: 400/120 })
    const splits = [full, full, full, full, full, full, tail]
    const r = computePaceFadeSummary(splits)
    expect(r).not.toBeNull()
    expect(r!.splitsUsed).toBe(6)
  })

  it('flags sparse when at exactly 6 splits', () => {
    const splits = Array(6).fill(null).map(() => split())
    const r = computePaceFadeSummary(splits)
    expect(r!.sparse).toBe(true)
  })

  it('does NOT flag sparse with 8+ splits', () => {
    const splits = Array(10).fill(null).map(() => split())
    const r = computePaceFadeSummary(splits)
    expect(r!.sparse).toBe(false)
  })

  it('drops splits with zero distance/time gracefully', () => {
    const full   = split({ moving_time: 300 })
    const broken = split({ distance: 0, moving_time: 0, average_speed: 0 })
    const splits = [full, broken, full, full, full, full, full, full]
    const r = computePaceFadeSummary(splits)
    expect(r).not.toBeNull()
    expect(r!.splitsUsed).toBe(7)
  })
})
