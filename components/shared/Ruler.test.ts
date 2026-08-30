import { describe, it, expect } from 'vitest'
import { clampToRange, snapToStep, thumbPercent, makeTicks, scaleLabels } from './Ruler.logic'

describe('Ruler · clampToRange', () => {
  it('clamps below min and above max, passes through in-range', () => {
    expect(clampToRange(-5, 0, 100)).toBe(0)
    expect(clampToRange(150, 0, 100)).toBe(100)
    expect(clampToRange(37, 0, 100)).toBe(37)
  })
})

describe('Ruler · snapToStep', () => {
  it('snaps to the nearest step from min', () => {
    expect(snapToStep(37, 0, 160, 5)).toBe(35)
    expect(snapToStep(38, 0, 160, 5)).toBe(40)
    expect(snapToStep(2.4, 0, 160, 5)).toBe(0)
    expect(snapToStep(2.5, 0, 160, 5)).toBe(5)
  })

  it('always lands on-grid and in-range (the "stepped, not per-unit" guarantee)', () => {
    for (let raw = -20; raw <= 200; raw += 0.37) {
      const v = snapToStep(raw, 0, 160, 5)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(160)
      expect(v % 5).toBe(0)
    }
  })

  it('respects a non-zero min offset', () => {
    // birth-year-style range: min 1950, step 1
    expect(snapToStep(1987.6, 1950, 2012, 1)).toBe(1988)
  })

  it('handles step 1 without float drift', () => {
    expect(snapToStep(18.0000001, 0, 60, 1)).toBe(18)
  })
})

describe('Ruler · thumbPercent', () => {
  it('maps value to 0–100% across the range', () => {
    expect(thumbPercent(0, 0, 160)).toBe(0)
    expect(thumbPercent(160, 0, 160)).toBe(100)
    expect(thumbPercent(80, 0, 160)).toBe(50)
  })
  it('clamps out-of-range values', () => {
    expect(thumbPercent(-10, 0, 160)).toBe(0)
    expect(thumbPercent(200, 0, 160)).toBe(100)
  })
  it('returns 0 for a degenerate range', () => {
    expect(thumbPercent(5, 10, 10)).toBe(0)
  })
})

describe('Ruler · makeTicks', () => {
  it('produces the h3,h1,h2,h1 rhythm with majorEvery 4', () => {
    expect(makeTicks(5, 4).map(t => t.h)).toEqual([3, 1, 2, 1, 3])
  })
  it('produces the requested count', () => {
    expect(makeTicks(21, 4)).toHaveLength(21)
  })
})

describe('Ruler · scaleLabels', () => {
  it('evenly spaces inclusive labels', () => {
    expect(scaleLabels(0, 160, 5)).toEqual([0, 40, 80, 120, 160])
    expect(scaleLabels(0, 60, 5)).toEqual([0, 15, 30, 45, 60])
  })
})
