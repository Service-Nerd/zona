import { describe, it, expect } from 'vitest'
import { isDateWithinWeek, isDatePastWeek, isPlanComplete } from './plan'
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

// §73 — the canonical "past week N" predicate. The post-race prompt bug was that
// an index compare (currentWeekIndex > raceWeekIdx) can never fire when the race
// is the final week; this predicate answers the question by date instead.
describe('isDatePastWeek', () => {
  it('is false inside the window (incl. the last day)', () => {
    expect(isDatePastWeek(week25, new Date(2026, 6, 6))).toBe(false)  // Mon
    expect(isDatePastWeek(week25, new Date(2026, 6, 12))).toBe(false) // Sun (last day)
  })

  it('is true the day after the window ends', () => {
    expect(isDatePastWeek(week25, new Date(2026, 6, 13))).toBe(true)  // Mon +7
  })

  it('is false before the week starts', () => {
    expect(isDatePastWeek(week25, new Date(2026, 6, 5))).toBe(false)
  })

  it('fires for a race in the FINAL week once its window ends (the bug this fixes)', () => {
    const raceWeek = weeks[weeks.length - 1] // race lives in the last week
    expect(isDatePastWeek(raceWeek, new Date(2026, 6, 11))).toBe(false) // race day — not yet
    expect(isDatePastWeek(raceWeek, new Date(2026, 6, 13))).toBe(true)  // Mon after — post-race
  })
})

describe('isPlanComplete', () => {
  it('is false during the final week', () => {
    expect(isPlanComplete(weeks, new Date(2026, 6, 11))).toBe(false) // Sat of last week
  })

  it('is true once past the final week window', () => {
    expect(isPlanComplete(weeks, new Date(2026, 6, 13))).toBe(true)  // Mon after
  })

  it('matches isDatePastWeek on the last week (delegate parity)', () => {
    const last = weeks[weeks.length - 1]
    for (const d of [new Date(2026, 6, 11), new Date(2026, 6, 12), new Date(2026, 6, 13)]) {
      expect(isPlanComplete(weeks, d)).toBe(isDatePastWeek(last, d))
    }
  })
})
