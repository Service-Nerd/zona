import { describe, it, expect } from 'vitest'
import {
  formatDistance,
  formatDuration,
  formatSessionMetric,
  resolveSessionMetric,
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
