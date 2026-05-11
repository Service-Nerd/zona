import { describe, it, expect } from 'vitest'
import { computeHrStreamSummary, type HrSample } from './streamAnalysis'

/**
 * Each test sets up samples on a continuous wall-clock so the partitioner
 * (first-third / last-third) sees a real time span. The helper constructs
 * an evenly-spaced sample series at a configurable BPM trajectory.
 */
function makeSamples(
  startMs: number,
  durationSec: number,
  count: number,
  bpmAt: (t: number) => number,
): HrSample[] {
  const stepMs = (durationSec * 1000) / Math.max(1, count - 1)
  return Array.from({ length: count }, (_, i) => ({
    valueBpm:  bpmAt(i / Math.max(1, count - 1)),
    timestamp: new Date(startMs + i * stepMs).toISOString(),
  }))
}

const T0 = Date.parse('2026-05-11T08:00:00Z')

describe('computeHrStreamSummary', () => {
  describe('null guards', () => {
    it('returns null on undefined samples', () => {
      expect(computeHrStreamSummary(undefined, 1800)).toBeNull()
    })

    it('returns null on null samples', () => {
      expect(computeHrStreamSummary(null, 1800)).toBeNull()
    })

    it('returns null on empty array', () => {
      expect(computeHrStreamSummary([], 1800)).toBeNull()
    })

    it('returns null when workout duration is below 10 minutes', () => {
      const samples = makeSamples(T0, 540, 30, () => 150) // 9 min
      expect(computeHrStreamSummary(samples, 540)).toBeNull()
    })

    it('returns null when sample window itself is shorter than 10 minutes', () => {
      // Duration arg says 30 min but samples only span 8 min — should bail.
      const samples = makeSamples(T0, 480, 30, () => 150)
      expect(computeHrStreamSummary(samples, 1800)).toBeNull()
    })

    it('returns null when either third has fewer than 3 samples', () => {
      // 5 samples across 30 minutes: first third gets ~2, last third gets ~2 — too sparse.
      const samples = makeSamples(T0, 1800, 5, () => 150)
      expect(computeHrStreamSummary(samples, 1800)).toBeNull()
    })

    it('returns null when all samples have invalid HR readings', () => {
      const samples = makeSamples(T0, 1800, 60, () => 0)
      expect(computeHrStreamSummary(samples, 1800)).toBeNull()
    })
  })

  describe('drift computation', () => {
    it('reports positive drift when HR climbs across the run', () => {
      // 30 min, 60 samples, HR climbs 140 → 170 linearly.
      const samples = makeSamples(T0, 1800, 60, frac => 140 + frac * 30)
      const result = computeHrStreamSummary(samples, 1800)
      expect(result).not.toBeNull()
      expect(result!.firstThirdAvgHr).toBeLessThan(result!.lastThirdAvgHr)
      expect(result!.hrDriftBpm).toBeGreaterThan(0)
      expect(result!.hrDriftPct).toBeGreaterThan(0)
    })

    it('reports negative drift when HR drops across the run (rare but possible)', () => {
      const samples = makeSamples(T0, 1800, 60, frac => 170 - frac * 20)
      const result = computeHrStreamSummary(samples, 1800)
      expect(result).not.toBeNull()
      expect(result!.hrDriftBpm).toBeLessThan(0)
    })

    it('reports ~0 drift when HR is flat', () => {
      const samples = makeSamples(T0, 1800, 60, () => 150)
      const result = computeHrStreamSummary(samples, 1800)
      expect(result).not.toBeNull()
      expect(Math.abs(result!.hrDriftBpm)).toBeLessThanOrEqual(1)
    })

    it('drift pct is computed relative to first-third avg', () => {
      const samples = makeSamples(T0, 1800, 60, frac => 100 + frac * 20)
      const result = computeHrStreamSummary(samples, 1800)
      expect(result).not.toBeNull()
      // First-third avg ~104, last-third ~116 → drift ~12 bpm → ~11-12%.
      expect(result!.hrDriftPct).toBeGreaterThan(0.08)
      expect(result!.hrDriftPct).toBeLessThan(0.15)
    })
  })

  describe('sparse flag', () => {
    it('marks sparse when coverage is below 0.3 samples/min', () => {
      // 30 minutes, 8 samples = ~0.27/min → sparse but enough thirds (3/3 each).
      // Note 9 samples would land exactly at 0.3/min which is NOT below the threshold.
      const samples = makeSamples(T0, 1800, 8, () => 150)
      const result = computeHrStreamSummary(samples, 1800)
      expect(result).not.toBeNull()
      expect(result!.sparse).toBe(true)
    })

    it('does not mark sparse when coverage is dense', () => {
      // 30 minutes, 60 samples = 2/min → dense.
      const samples = makeSamples(T0, 1800, 60, () => 150)
      const result = computeHrStreamSummary(samples, 1800)
      expect(result).not.toBeNull()
      expect(result!.sparse).toBe(false)
    })
  })

  describe('input hardening', () => {
    it('filters NaN and Infinity bpm readings', () => {
      const valid = makeSamples(T0, 1800, 60, () => 150)
      const corrupted: HrSample[] = [
        ...valid.slice(0, 20),
        { valueBpm: NaN, timestamp: new Date(T0 + 500_000).toISOString() },
        { valueBpm: Infinity, timestamp: new Date(T0 + 600_000).toISOString() },
        ...valid.slice(20),
      ]
      const result = computeHrStreamSummary(corrupted, 1800)
      expect(result).not.toBeNull()
      // Only the valid 60 should contribute; NaN/Infinity are dropped.
      expect(result!.samplesCount).toBe(60)
    })

    it('filters zero or negative bpm readings', () => {
      const valid = makeSamples(T0, 1800, 60, () => 150)
      const corrupted: HrSample[] = [
        ...valid,
        { valueBpm: 0,    timestamp: new Date(T0 + 100).toISOString() },
        { valueBpm: -42,  timestamp: new Date(T0 + 200).toISOString() },
      ]
      const result = computeHrStreamSummary(corrupted, 1800)
      expect(result).not.toBeNull()
      expect(result!.samplesCount).toBe(60)
    })

    it('filters samples with malformed timestamps', () => {
      const valid = makeSamples(T0, 1800, 60, () => 150)
      const corrupted: HrSample[] = [
        ...valid,
        { valueBpm: 150, timestamp: 'not-a-date' },
      ]
      const result = computeHrStreamSummary(corrupted, 1800)
      expect(result).not.toBeNull()
      expect(result!.samplesCount).toBe(60)
    })

    it('partitions correctly when input is not pre-sorted', () => {
      const samples = makeSamples(T0, 1800, 60, frac => 140 + frac * 30)
      // Shuffle a copy so order is randomised.
      const shuffled = [...samples].sort(() => Math.random() - 0.5)
      const result = computeHrStreamSummary(shuffled, 1800)
      expect(result).not.toBeNull()
      // Drift should still register as positive because the underlying time-sorted
      // series goes 140 → 170. If the partitioner didn't re-sort, this would fail.
      expect(result!.hrDriftBpm).toBeGreaterThan(0)
    })
  })
})
