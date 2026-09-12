import { describe, it, expect } from 'vitest'
import { formatClockTime, formatElapsedDelta } from '@/lib/format'

describe('formatClockTime', () => {
  it('renders a marathon with hours', () => expect(formatClockTime(3 * 3600 + 53 * 60 + 36)).toBe('3:53:36'))
  it('drops the hour segment below an hour', () => expect(formatClockTime(23 * 60 + 42)).toBe('23:42'))
  it('zero-pads minutes and seconds', () => expect(formatClockTime(3600 + 5 * 60 + 3)).toBe('1:05:03'))
  it('handles the hour boundary', () => expect(formatClockTime(3599)).toBe('59:59'))
  it('rounds rather than truncating fractional seconds', () => expect(formatClockTime(59.6)).toBe('1:00'))
  it.each([null, undefined, NaN, -1])('returns null for %p rather than a fake time', (v) => {
    expect(formatClockTime(v as number)).toBeNull()
  })
})

describe('formatElapsedDelta', () => {
  it('renders minutes and seconds', () => expect(formatElapsedDelta(324)).toBe('5m 24s'))
  it('drops a zero seconds part', () => expect(formatElapsedDelta(300)).toBe('5m'))
  it('renders seconds alone', () => expect(formatElapsedDelta(24)).toBe('24s'))
  it('is UNSIGNED — the caller owns direction', () => expect(formatElapsedDelta(-324)).toBe('5m 24s'))
  it('renders zero as 0s, not null', () => expect(formatElapsedDelta(0)).toBe('0s'))
  it.each([null, undefined, NaN])('returns null for %p', (v) => expect(formatElapsedDelta(v as number)).toBeNull())
})
