import { describe, it, expect } from 'vitest'
import { toggleDay, DAY_GRID, type DayKey } from './DayGridSelector.logic'

// Pure-logic tests for the day-grid toggle. The render is trivial (matches the
// prior bespoke buttons byte-for-byte); the selection logic is the part worth
// guarding — a regression here silently changes which days the wizard blocks.

describe('DayGridSelector · toggleDay (multiple)', () => {
  it('adds an absent day', () => {
    expect(toggleDay([], 'wed', true)).toEqual(['wed'])
  })

  it('removes a present day', () => {
    expect(toggleDay(['wed', 'sat'], 'wed', true)).toEqual(['sat'])
  })

  it('always returns canonical Mon–Sun order regardless of tap order', () => {
    // tap sun, then mon, then wed → stored order is Mon, Wed, Sun
    let v: DayKey[] = []
    v = toggleDay(v, 'sun', true)
    v = toggleDay(v, 'mon', true)
    v = toggleDay(v, 'wed', true)
    expect(v).toEqual(['mon', 'wed', 'sun'])
  })

  it('does not mutate the input array', () => {
    const input: DayKey[] = ['tue']
    const out = toggleDay(input, 'fri', true)
    expect(input).toEqual(['tue'])
    expect(out).not.toBe(input)
  })
})

describe('DayGridSelector · toggleDay (single)', () => {
  it('selects a day, replacing any prior selection', () => {
    expect(toggleDay(['mon'], 'thu', false)).toEqual(['thu'])
  })

  it('clears when the sole selected day is tapped again', () => {
    expect(toggleDay(['thu'], 'thu', false)).toEqual([])
  })

  it('selects (not clears) when tapping a different day', () => {
    expect(toggleDay(['thu'], 'mon', false)).toEqual(['mon'])
  })
})

describe('DAY_GRID', () => {
  it('is exactly Mon–Sun in order', () => {
    expect(DAY_GRID.map(d => d.key)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'])
  })
})
