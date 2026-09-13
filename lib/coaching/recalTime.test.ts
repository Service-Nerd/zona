import { describe, it, expect } from 'vitest'
import {
  RECAL_MIN_SECONDS, RECAL_MAX_SECONDS,
  recalSecondsFromParts, isRecalTimeInRange, formatRecalTime, defaultRecalMins,
} from './recalTime'

describe('recalSecondsFromParts', () => {
  it('combines minutes and seconds', () => {
    expect(recalSecondsFromParts(22, 41)).toBe(22 * 60 + 41)
    expect(recalSecondsFromParts(0, 0)).toBe(0)
  })
})

describe('isRecalTimeInRange', () => {
  it('accepts the boundaries', () => {
    expect(isRecalTimeInRange(RECAL_MIN_SECONDS)).toBe(true)   // 12:00
    expect(isRecalTimeInRange(RECAL_MAX_SECONDS)).toBe(true)   // 60:00
  })
  it('rejects too fast and too slow (the old parseTime window)', () => {
    expect(isRecalTimeInRange(RECAL_MIN_SECONDS - 1)).toBe(false)
    expect(isRecalTimeInRange(RECAL_MAX_SECONDS + 1)).toBe(false)
    expect(isRecalTimeInRange(recalSecondsFromParts(5, 0))).toBe(false)
    expect(isRecalTimeInRange(recalSecondsFromParts(22, 41))).toBe(true)
  })
})

describe('formatRecalTime', () => {
  it('pads seconds, not minutes', () => {
    expect(formatRecalTime(22, 41)).toBe('22:41')
    expect(formatRecalTime(9, 5)).toBe('9:05')
    expect(formatRecalTime(50, 0)).toBe('50:00')
  })
})

describe('defaultRecalMins', () => {
  it('starts near ~5 min/km for common distances', () => {
    expect(defaultRecalMins(5)).toBe(25)
    expect(defaultRecalMins(10)).toBe(50)
  })
  it('clamps into the valid window', () => {
    expect(defaultRecalMins(1)).toBe(12)    // est 5 → floor to 12
    expect(defaultRecalMins(20)).toBe(60)   // est 100 → cap at 60
  })
  it('never returns a value that is itself out of range', () => {
    for (const km of [3, 5, 8, 10, 15, 21]) {
      expect(isRecalTimeInRange(recalSecondsFromParts(defaultRecalMins(km), 0))).toBe(true)
    }
  })
})
