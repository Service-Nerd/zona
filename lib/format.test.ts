import { describe, it, expect } from 'vitest'
import {
  formatDistance,
  formatDuration,
  formatSessionMetric,
  resolveSessionMetric,
  apportionRoundedDistance,
} from './format'

describe('formatDuration — the ≥60→hours rule (ADR-015 / INV-FMT-002)', () => {
  it('reads in minutes below 60', () => {
    expect(formatDuration(1)).toBe('1 min')
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(59)).toBe('59 min')
  })

  it('switches to hours at exactly 60 and drops minutes on whole hours', () => {
    expect(formatDuration(60)).toBe('1h')
    expect(formatDuration(120)).toBe('2h')
    expect(formatDuration(180)).toBe('3h')
  })

  it('zero-pads the remainder minutes and carries no unit after the hour', () => {
    expect(formatDuration(65)).toBe('1h 05')
    expect(formatDuration(78)).toBe('1h 18')
    expect(formatDuration(90)).toBe('1h 30')
    expect(formatDuration(150)).toBe('2h 30')
    expect(formatDuration(125)).toBe('2h 05')
  })

  it('never emits a bare "m" glyph (the ambiguity this retires)', () => {
    for (const mins of [1, 45, 59, 60, 65, 78, 90, 120, 150]) {
      const out = formatDuration(mins)!
      expect(out).not.toMatch(/\dm\b/) // no "78m" style
    }
  })

  it('rounds fractional minutes before formatting', () => {
    expect(formatDuration(44.4)).toBe('44 min')
    expect(formatDuration(59.6)).toBe('1h')
    expect(formatDuration(89.5)).toBe('1h 30')
  })

  it('returns null for absent or invalid input', () => {
    expect(formatDuration(null)).toBeNull()
    expect(formatDuration(undefined)).toBeNull()
    expect(formatDuration(NaN)).toBeNull()
    expect(formatDuration(-5)).toBeNull()
  })

  it('handles zero as a real minute value', () => {
    expect(formatDuration(0)).toBe('0 min')
  })
})

describe('formatSessionMetric — one summary, either unit', () => {
  const distOnly = { distance_km: 8 }
  const durOnly = { duration_mins: 78 }
  const both = { distance_km: 8.4, duration_mins: 78 }
  const neither = {}

  it('shows the resolved metric when present', () => {
    expect(formatSessionMetric(both, 'distance', 'km')).toBe('8km')
    expect(formatSessionMetric(both, 'duration', 'km')).toBe('1h 18')
  })

  it('honours the units preference for distance', () => {
    expect(formatSessionMetric(distOnly, 'distance', 'km')).toBe('8km')
    expect(formatSessionMetric(distOnly, 'distance', 'mi')).toBe('5mi')
  })

  it('falls back to the other metric when the preferred one is absent', () => {
    // duration-preferred but only distance exists
    expect(formatSessionMetric(distOnly, 'duration', 'km')).toBe('8km')
    // distance-preferred but only duration exists (the 78m user's case)
    expect(formatSessionMetric(durOnly, 'distance', 'km')).toBe('1h 18')
  })

  it('returns null only when the session carries neither', () => {
    expect(formatSessionMetric(neither, 'distance', 'km')).toBeNull()
    expect(formatSessionMetric(neither, 'duration', 'km')).toBeNull()
  })
})

describe('resolveSessionMetric — resolution order is unchanged', () => {
  it('per-session override wins over plan and global', () => {
    expect(
      resolveSessionMetric(1, 'mon', 'distance', { '1_mon': 'duration' }, 'distance'),
    ).toBe('duration')
  })

  it('plan primary_metric beats global preference', () => {
    expect(resolveSessionMetric(1, 'mon', 'duration', {}, 'distance')).toBe('duration')
  })

  it('falls through global then to distance', () => {
    expect(resolveSessionMetric(1, 'mon', undefined, {}, 'duration')).toBe('duration')
    expect(resolveSessionMetric(1, 'mon', undefined, {}, undefined)).toBe('distance')
  })
})

describe('apportionRoundedDistance — parts sum to the displayed total (SESSION-RECONCILE-01)', () => {
  it('the real MP long-run case: parts sum to the header, not to (total − segment)', () => {
    // 21.5 km / 151 min, segment 40%. Independent rounding showed 2 + 9 + 2 = 13
    // against a 22 km header; the segment carried the missing ~9 as a bare "40%".
    const parts = [2.14, 8.71, 8.58, 2.14] // warm-up, easy body, MP segment, cool-down
    const out = apportionRoundedDistance(parts, 21.5)
    expect(out.reduce((a, b) => a + b, 0)).toBe(Math.round(21.5)) // 22
    // every part within 1 of its natural round
    parts.forEach((p, i) => expect(Math.abs(out[i] - Math.round(p))).toBeLessThanOrEqual(1))
  })

  it('the plain-run rounding case: 1.4 + 7.1 + 1.4 shows parts summing to 10, not 9', () => {
    const out = apportionRoundedDistance([1.42, 7.14, 1.42], 10)
    expect(out.reduce((a, b) => a + b, 0)).toBe(10)
  })

  it('always sums to round(total), across a range', () => {
    for (const total of [5, 8.4, 10, 16.5, 21.5, 29, 32.7, 42.2]) {
      // split into thirds as a stand-in for arbitrary parts
      const parts = [total * 0.15, total * 0.55, total * 0.3]
      const out = apportionRoundedDistance(parts, total)
      expect(out.reduce((a, b) => a + b, 0), `total ${total}`).toBe(Math.round(total))
    }
  })

  it('converts to miles before apportioning, and sums to the mile total', () => {
    const out = apportionRoundedDistance([3, 12, 3], 18, 'mi') // 18 km ≈ 11.2 mi
    expect(out.reduce((a, b) => a + b, 0)).toBe(Math.round(18 / 1.609344)) // 11
  })

  it('reclaims a unit when the target sits below the sum of floors', () => {
    // parts floor to 1+1+1 = 3 but the total rounds to 2 — one unit is reclaimed.
    const out = apportionRoundedDistance([1.1, 1.1, 0.2], 2.4)
    expect(out.reduce((a, b) => a + b, 0)).toBe(2)
    expect(out.every(v => v >= 0)).toBe(true)
  })

  it('treats null / non-finite parts as zero', () => {
    const out = apportionRoundedDistance([2, null, undefined, 3], 5)
    expect(out.reduce((a, b) => a + b, 0)).toBe(5)
    expect(out[1]).toBe(0)
    expect(out[2]).toBe(0)
  })
})
