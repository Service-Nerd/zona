import { describe, it, expect } from 'vitest'
import {
  vdotFromAerobicSpeedMs, z2Band, qualifyAerobicRuns, weightedMeanSpeed,
  estimateRaceSeconds, formatRaceTime, estimateBenchmarkFromRuns, type AerobicRun,
} from './aerobicEstimate'

describe('aerobicEstimate · z2Band', () => {
  it('is Karvonen 60–70% of HR reserve', () => {
    // reserve = 140; floor = 50 + 84 = 134, ceiling = 50 + 98 = 148
    expect(z2Band(50, 190)).toEqual({ floor: 134, ceiling: 148 })
  })
})

describe('aerobicEstimate · qualifyAerobicRuns', () => {
  const band = { floor: 134, ceiling: 148 }
  const run = (avg_hr: number, distance_m: number, avg_speed = 3): AerobicRun => ({ avg_hr, distance_m, avg_speed })
  it('keeps in-band, long-enough runs', () => {
    expect(qualifyAerobicRuns([run(140, 8000)], band)).toHaveLength(1)
  })
  it('drops runs above the ceiling (ran too hard)', () => {
    expect(qualifyAerobicRuns([run(160, 8000)], band)).toHaveLength(0)
  })
  it('drops runs below the floor and runs under 3km', () => {
    expect(qualifyAerobicRuns([run(120, 8000), run(140, 2000)], band)).toHaveLength(0)
  })
})

describe('aerobicEstimate · weightedMeanSpeed', () => {
  it('weights by distance', () => {
    const runs: AerobicRun[] = [
      { avg_speed: 3.0, distance_m: 10000, avg_hr: 140 },
      { avg_speed: 4.0, distance_m: 0,     avg_hr: 140 },
    ]
    expect(weightedMeanSpeed(runs)).toBeCloseTo(3.0)
  })
  it('is safe with zero total distance', () => {
    expect(weightedMeanSpeed([])).toBe(0)
  })
})

describe('aerobicEstimate · estimateRaceSeconds', () => {
  it('is monotonic — a faster runner gets a lower race time', () => {
    const slow = estimateRaceSeconds(vdotFromAerobicSpeedMs(2.6), 10)
    const fast = estimateRaceSeconds(vdotFromAerobicSpeedMs(3.4), 10)
    expect(fast).toBeLessThan(slow)
  })
  it('lands a mid-fitness 10K in a sane range (30–70 min)', () => {
    const secs = estimateRaceSeconds(50, 10)
    expect(secs).toBeGreaterThan(30 * 60)
    expect(secs).toBeLessThan(70 * 60)
  })
})

describe('aerobicEstimate · formatRaceTime', () => {
  it('formats under and over an hour', () => {
    expect(formatRaceTime(55 * 60 + 52)).toBe('55:52')
    expect(formatRaceTime(3 * 3600 + 45 * 60)).toBe('3:45:00')
  })
})

describe('aerobicEstimate · estimateBenchmarkFromRuns', () => {
  const runs: AerobicRun[] = Array.from({ length: 4 }, () => ({ avg_speed: 3.0, avg_hr: 140, distance_m: 8000 }))

  it('returns unavailable when HR is missing (never throws)', () => {
    expect(estimateBenchmarkFromRuns({ runs, restingHr: null, maxHr: 190, raceDistanceKm: 10 }))
      .toEqual({ available: false, reason: 'no_hr' })
  })
  it('returns unavailable when no runs qualify', () => {
    const hot = runs.map(r => ({ ...r, avg_hr: 175 }))
    expect(estimateBenchmarkFromRuns({ runs: hot, restingHr: 50, maxHr: 190, raceDistanceKm: 10 }).available).toBe(false)
  })
  it('produces a benchmark-shaped estimate with moderate confidence at ≥4 runs', () => {
    const est = estimateBenchmarkFromRuns({ runs, restingHr: 50, maxHr: 190, raceDistanceKm: 10 })
    expect(est.available).toBe(true)
    if (est.available) {
      expect(est.distanceKm).toBe(10)
      expect(est.confidence).toBe('moderate')
      expect(est.runCount).toBe(4)
      expect(est.formattedTime).toMatch(/^\d{1,2}:\d{2}(:\d{2})?$/)
      expect(est.label).not.toMatch(/✦/) // provenance: rule-derived, no AIMark glyph
    }
  })
  it('drops to low confidence with 1–3 runs', () => {
    const est = estimateBenchmarkFromRuns({ runs: runs.slice(0, 2), restingHr: 50, maxHr: 190, raceDistanceKm: 10 })
    expect(est.available && est.confidence).toBe('low')
  })
})
