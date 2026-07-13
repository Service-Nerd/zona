import { describe, it, expect } from 'vitest'
import { isDateWithinWeek, isPlanComplete } from './plan'
import type { Plan } from '@/types/plan'

// Week 25 runs Mon 2026-07-06 → Sun 2026-07-12 (window [start, start+7)).
const week25 = { date: '2026-07-06' } as unknown as Plan['weeks'][number]
const weeks = [
  { date: '2026-06-29' },
  { date: '2026-07-06' },
] as unknown as Plan['weeks']

describe('isDateWithinWeek', () => {
  it('is true for a day inside the 7-day window', () => {
    expect(isDateWithinWeek(week25, new Date(2026, 6, 6))).toBe(true)   // Mon
    expect(isDateWithinWeek(week25, new Date(2026, 6, 11))).toBe(true)  // Sat (race day)
    expect(isDateWithinWeek(week25, new Date(2026, 6, 12))).toBe(true)  // Sun
  })

  it('is false the Monday after the week ends (the phantom-shakeout trigger)', () => {
    expect(isDateWithinWeek(week25, new Date(2026, 6, 13))).toBe(false) // Mon +7
  })

  it('is false before the week starts', () => {
    expect(isDateWithinWeek(week25, new Date(2026, 6, 5))).toBe(false)
  })
})

describe('isPlanComplete', () => {
  it('is false during the final week', () => {
    expect(isPlanComplete(weeks, new Date(2026, 6, 11))).toBe(false) // Sat of last week
  })

  it('is true once past the final week window', () => {
    expect(isPlanComplete(weeks, new Date(2026, 6, 13))).toBe(true)  // Mon after
  })
})
