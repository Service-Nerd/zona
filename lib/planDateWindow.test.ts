import { describe, it, expect } from 'vitest'
import { isDateWithinWeek, isDatePastWeek, isPlanComplete, findWeekByN } from './plan'
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

// ADR-013 — a standalone maintenance plan's array restarts at index 0 while
// week.n continues the race sequence (26+). week_n (the shared key for
// completions/reports/notes) must resolve a week by n, never by array index —
// plan.weeks[week_n - 1] is out of bounds and was the "Week 29 not found" /
// silent AI-note failure on maintenance plans.
describe('findWeekByN', () => {
  const maintenancePlan = [
    { n: 26, phase: 'maintenance_restoration' },
    { n: 27, phase: 'maintenance_restoration' },
    { n: 28, phase: 'maintenance_base' },
  ] as unknown as Plan['weeks']

  it('resolves a maintenance week by its canonical n, not array position', () => {
    expect(findWeekByN(maintenancePlan, 28)).toBe(maintenancePlan[2])
    // The bug: indexing by the key. weeks[28 - 1] is out of bounds here.
    expect(maintenancePlan[28 - 1]).toBeUndefined()
  })

  it('returns undefined when no week carries that n', () => {
    expect(findWeekByN(maintenancePlan, 4)).toBeUndefined()
  })

  it('falls back to array position for legacy plans with no n', () => {
    const legacy = [{ date: 'a' }, { date: 'b' }, { date: 'c' }] as unknown as Plan['weeks']
    expect(findWeekByN(legacy, 2)).toBe(legacy[1]) // 1-indexed position
  })

  it('is identical to position indexing on a race plan where n == position', () => {
    const racePlan = [{ n: 1 }, { n: 2 }, { n: 3 }] as unknown as Plan['weeks']
    for (const n of [1, 2, 3]) {
      expect(findWeekByN(racePlan, n)).toBe(racePlan[n - 1])
    }
  })
})
