import { describe, it, expect } from 'vitest'
import { buildTrendSparkline, sparklinePath, SPARKLINE_MIN_POINTS, type SparkBucket } from './trendSparkline'

const b = (monthKey: string, avgHr: number | null, shortLabel = monthKey.slice(5)): SparkBucket =>
  ({ monthKey, shortLabel, avgHr })

describe('buildTrendSparkline — when a line is earned', () => {
  it('draws three or more usable points', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-05', 149), b('2026-06', 144)])!
    expect(s.points).toHaveLength(3)
  })

  it('REFUSES two points — that is a segment between two numbers already on the card', () => {
    expect(buildTrendSparkline([b('2026-04', 152), b('2026-06', 144)])).toBeNull()
  })

  it('refuses an empty or absent series rather than throwing', () => {
    expect(buildTrendSparkline([])).toBeNull()
    expect(buildTrendSparkline(null)).toBeNull()
    expect(buildTrendSparkline(undefined)).toBeNull()
  })

  it('the minimum is the stated constant, not a literal buried in the function', () => {
    const justUnder = Array.from({ length: SPARKLINE_MIN_POINTS - 1 }, (_, i) => b(`2026-0${i + 1}`, 150 - i))
    const justOn    = Array.from({ length: SPARKLINE_MIN_POINTS },     (_, i) => b(`2026-0${i + 1}`, 150 - i))
    expect(buildTrendSparkline(justUnder)).toBeNull()
    expect(buildTrendSparkline(justOn)).not.toBeNull()
  })
})

describe('buildTrendSparkline — x is elapsed time, not array position', () => {
  it('a gap month makes a WIDER segment', () => {
    // Apr, May, then nothing until Sep. Apr→May must be one short step and
    // May→Sep a long one; equal spacing would claim runs that do not exist.
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-05', 150), b('2026-09', 144)])!
    const [apr, may, sep] = s.points
    expect(apr.x).toBe(0)
    expect(sep.x).toBe(1)
    expect(may.x).toBeCloseTo(1 / 5, 5)      // 1 month of a 5-month span
    expect(may.x - apr.x).toBeLessThan(sep.x - may.x)
  })

  it('evenly spaced months are evenly spaced', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-05', 150), b('2026-06', 144)])!
    expect(s.points.map(p => p.x)).toEqual([0, 0.5, 1])
  })

  it('spans a year boundary correctly', () => {
    const s = buildTrendSparkline([b('2025-11', 152), b('2025-12', 150), b('2026-01', 144)])!
    expect(s.points.map(p => p.x)).toEqual([0, 0.5, 1])
  })

  it('orders by month, not by the order it was handed', () => {
    const s = buildTrendSparkline([b('2026-06', 144), b('2026-04', 152), b('2026-05', 150)])!
    expect(s.points.map(p => p.value)).toEqual([152, 150, 144])
  })
})

describe('buildTrendSparkline — a missing month is dropped, never invented', () => {
  it('skips a null bucket instead of interpolating a midpoint', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-05', null), b('2026-06', 150), b('2026-07', 144)])!
    expect(s.points.map(p => p.value)).toEqual([152, 150, 144])
    // And the dropped month still occupies its share of the x axis.
    expect(s.points[1].x).toBeCloseTo(2 / 3, 5)
  })

  it('falls below the minimum once nulls are removed', () => {
    expect(buildTrendSparkline([b('2026-04', 152), b('2026-05', null), b('2026-06', 144)])).toBeNull()
  })

  it('ignores a malformed month key rather than placing it at zero', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('not-a-month', 100), b('2026-05', 150), b('2026-06', 144)])!
    expect(s.points.map(p => p.value)).toEqual([152, 150, 144])
  })

  it('ignores a month number outside 1-12', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-13', 100), b('2026-05', 150), b('2026-06', 144)])!
    expect(s.points).toHaveLength(3)
  })
})

describe('buildTrendSparkline — y, and direction', () => {
  it('the HIGHEST value sits at the TOP, so a falling heart rate falls', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-05', 148), b('2026-06', 144)])!
    expect(s.points[0].y).toBe(0)   // 152, the max, at the top
    expect(s.points[2].y).toBe(1)   // 144, the min, at the bottom
    expect(s.delta).toBe(-8)
  })

  it('a RISING series rises, and the delta is positive', () => {
    const s = buildTrendSparkline([b('2026-04', 144), b('2026-05', 148), b('2026-06', 152)])!
    expect(s.points[0].y).toBe(1)
    expect(s.points[2].y).toBe(0)
    expect(s.delta).toBe(8)
  })

  it('a FLAT series sits on the centre line, not on an edge', () => {
    // span === 0. Pinning to 0 or 1 would draw "all-time high" or "all-time
    // low" out of a series that did nothing.
    const s = buildTrendSparkline([b('2026-04', 150), b('2026-05', 150), b('2026-06', 150)])!
    expect(s.points.every(p => p.y === 0.5)).toBe(true)
    expect(s.delta).toBe(0)
  })

  it('exposes the last point for the emphasis dot', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-05', 148), b('2026-06', 144)])!
    expect(s.last).toBe(s.points[2])
  })

  it('refuses when every usable point is in one month — they would stack at x=0', () => {
    expect(buildTrendSparkline([b('2026-04', 152), b('2026-04', 148), b('2026-04', 144)])).toBeNull()
  })
})

describe('sparklinePath', () => {
  it('scales into the given box, starting with a move', () => {
    const s = buildTrendSparkline([b('2026-04', 152), b('2026-05', 148), b('2026-06', 144)])!
    expect(sparklinePath(s, 100, 30)).toBe('M 0.00 0.00 L 50.00 15.00 L 100.00 30.00')
  })
})
