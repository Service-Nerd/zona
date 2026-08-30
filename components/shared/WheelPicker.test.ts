import { describe, it, expect } from 'vitest'
import { buildRange, clampIndex, valueToIndex, nearestIndexForScroll, scrollTopForIndex } from './WheelPicker.logic'

describe('WheelPicker · buildRange', () => {
  it('builds an inclusive range', () => {
    expect(buildRange(0, 5)).toEqual([0, 1, 2, 3, 4, 5])
    expect(buildRange(0, 59)).toHaveLength(60)
  })
  it('honours step', () => {
    expect(buildRange(0, 10, 5)).toEqual([0, 5, 10])
  })
  it('degrades safely on a non-positive step', () => {
    expect(buildRange(3, 9, 0)).toEqual([3])
  })
})

describe('WheelPicker · clampIndex', () => {
  it('clamps into range', () => {
    expect(clampIndex(-2, 10)).toBe(0)
    expect(clampIndex(99, 10)).toBe(9)
    expect(clampIndex(4, 10)).toBe(4)
  })
  it('handles an empty list', () => {
    expect(clampIndex(3, 0)).toBe(0)
  })
})

describe('WheelPicker · valueToIndex', () => {
  const mins = buildRange(0, 59)
  it('finds an exact value', () => {
    expect(valueToIndex(mins, 30)).toBe(30)
  })
  it('falls back to the nearest when absent', () => {
    // wheel of hours in steps of 1 asked for a value not on the grid
    expect(valueToIndex([0, 5, 10, 15], 8)).toBe(2)   // 10 is nearest
    expect(valueToIndex([0, 5, 10, 15], 7)).toBe(1)   // 5 is nearest (tie-break low)
  })
})

describe('WheelPicker · nearestIndexForScroll', () => {
  it('rounds scrollTop to the nearest row', () => {
    expect(nearestIndexForScroll(0, 40, 60)).toBe(0)
    expect(nearestIndexForScroll(59, 40, 60)).toBe(1)   // 59/40 = 1.475 → 1
    expect(nearestIndexForScroll(61, 40, 60)).toBe(2)   // 61/40 = 1.525 → 2
  })
  it('clamps to the list bounds', () => {
    expect(nearestIndexForScroll(9999, 40, 60)).toBe(59)
    expect(nearestIndexForScroll(-40, 40, 60)).toBe(0)
  })
  it('is safe with a zero row height', () => {
    expect(nearestIndexForScroll(100, 0, 60)).toBe(0)
  })
})

describe('WheelPicker · scrollTopForIndex', () => {
  it('is the inverse of nearestIndexForScroll on-grid', () => {
    for (let i = 0; i < 60; i++) {
      expect(nearestIndexForScroll(scrollTopForIndex(i, 40), 40, 60)).toBe(i)
    }
  })
})
