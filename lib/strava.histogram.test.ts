import { describe, it, expect } from 'vitest'
import { bucketHRSamples, bucketHRHistogram, bpmHistogramFromSamples } from './strava'

// N7 — the histogram must be a lossless substitute for the raw stream, because
// /api/recalibrate-hr now re-buckets HealthKit runs from it. If these two paths
// ever diverge, an HR correction silently produces different numbers depending
// on the run's source.

const ZONES = { zone2Ceiling: 146, maxHR: 178 }

function stream(spec: Array<[number, number]>): number[] {
  return spec.flatMap(([bpm, n]) => Array<number>(n).fill(bpm))
}

describe('bpm histogram bucketing (N7)', () => {
  it('produces identical results to raw-sample bucketing', () => {
    const raw = stream([[100, 40], [120, 300], [140, 500], [150, 120], [160, 30], [172, 10]])
    expect(bucketHRHistogram(bpmHistogramFromSamples(raw), ZONES)).toEqual(bucketHRSamples(raw, ZONES))
  })

  it('is order-independent — bucketing depends only on counts', () => {
    const raw = stream([[110, 50], [145, 200], [165, 25]])
    const shuffled = [...raw].reverse()
    expect(bucketHRSamples(shuffled, ZONES)).toEqual(bucketHRSamples(raw, ZONES))
  })

  it('re-buckets against corrected zones — the case this exists for', () => {
    // A runner whose max HR was recorded 28 bpm too low. Same run, same samples,
    // scored against the wrong ceiling and then the right one.
    const raw = stream([[109, 60], [117, 200], [129, 400], [135, 100]])
    const hist = bpmHistogramFromSamples(raw)

    const wrong = bucketHRHistogram(hist, { zone2Ceiling: 118, maxHR: 138 })!
    const right = bucketHRHistogram(hist, { zone2Ceiling: 146, maxHR: 178 })!

    // Against the bad ceiling most of the run reads as too hard...
    expect(wrong.abovePct).toBeGreaterThan(50)
    // ...against the corrected one it is squarely Zone 2.
    expect(right.abovePct).toBe(0)
    expect(right.inZonePct).toBeGreaterThan(50)
  })

  it('returns null for an empty or absent histogram rather than fabricating zeroes', () => {
    expect(bucketHRHistogram(null, ZONES)).toBeNull()
    expect(bucketHRHistogram({}, ZONES)).toBeNull()
    expect(bucketHRSamples([], ZONES)).toBeNull()
  })

  it('ignores non-positive samples', () => {
    expect(bpmHistogramFromSamples([0, -5, 120, 120])).toEqual({ '120': 2 })
  })
})
