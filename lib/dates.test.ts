import { describe, it, expect, afterAll } from 'vitest'
import { calendarDaysBetween, calendarWeeksBetween } from './dates'
import { weeksBetweenLocal } from './plan/length'

/**
 * DATE-DST-01 — the guard for the arithmetic, in the zones where it breaks.
 *
 * Every case here also asserts what the REPLACED implementation returned, so
 * the test carries its own falsification: if someone reinstates the
 * millisecond quotient, `naiveDays`/`naiveWeeks` and the owner agree and the
 * "must disagree" expectations go red. A guard that only asserts the right
 * answer cannot tell a fix from a coincidence.
 */

const ORIGINAL_TZ = process.env.TZ
afterAll(() => { process.env.TZ = ORIGINAL_TZ })

/** The implementation this replaced: two local midnights, differenced in ms. */
const local = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d) }
const naiveDays = (a: string, b: string) => Math.floor((local(b).getTime() - local(a).getTime()) / 86_400_000)
const naiveWeeks = (a: string, b: string) => Math.floor((local(b).getTime() - local(a).getTime()) / (7 * 86_400_000))

function inZone<T>(tz: string, fn: () => T): T {
  const prev = process.env.TZ
  process.env.TZ = tz
  try { return fn() } finally { process.env.TZ = prev }
}

/** Guards the guard: if runtime TZ assignment stops working, these cases would
 *  silently pass in UTC and prove nothing. */
function assertZoneHasDst(tz: string, winterMonth: number, summerMonth: number) {
  inZone(tz, () => {
    const winter = new Date(2027, winterMonth, 15, 12).getTimezoneOffset()
    const summer = new Date(2027, summerMonth, 15, 12).getTimezoneOffset()
    expect(winter, `${tz}: runtime TZ switching is not taking effect, so these cases test nothing`).not.toBe(summer)
  })
}

describe('calendarDaysBetween — spans that cross a DST boundary', () => {
  // Europe/London springs forward 2027-03-28; falls back 2026-10-25 / 2027-10-31.
  it('Europe/London, spring-forward: 84 calendar days, which the ms quotient reported as 83', () => {
    assertZoneHasDst('Europe/London', 0, 6)
    inZone('Europe/London', () => {
      expect(calendarDaysBetween('2027-01-11', '2027-04-05')).toBe(84)
      expect(naiveDays('2027-01-11', '2027-04-05'), 'the replaced implementation must disagree').toBe(83)
    })
  })

  it('Europe/London, spring-forward: the lost day is a lost WEEK on a Monday-to-Monday span', () => {
    inZone('Europe/London', () => {
      expect(calendarWeeksBetween('2027-01-11', '2027-04-05')).toBe(12)
      expect(weeksBetweenLocal('2027-01-11', '2027-04-05')).toBe(12)
      expect(naiveWeeks('2027-01-11', '2027-04-05'), 'the live defect: a 12-week plan generated 11 weeks').toBe(11)
    })
  })

  it('Europe/London, fall-back: the extra hour never inflated the count, and still does not', () => {
    inZone('Europe/London', () => {
      expect(calendarDaysBetween('2026-10-05', '2026-12-28')).toBe(84)
      expect(calendarWeeksBetween('2026-10-05', '2026-12-28')).toBe(12)
    })
  })

  it('America/New_York, spring-forward (a different date from London)', () => {
    assertZoneHasDst('America/New_York', 0, 6)
    inZone('America/New_York', () => {
      expect(calendarDaysBetween('2027-02-01', '2027-04-26')).toBe(84)
      expect(naiveDays('2027-02-01', '2027-04-26')).toBe(83)
      expect(calendarWeeksBetween('2027-02-01', '2027-04-26')).toBe(12)
    })
  })

  it('Australia/Sydney, southern-hemisphere spring-forward (October)', () => {
    assertZoneHasDst('Australia/Sydney', 6, 0)
    inZone('Australia/Sydney', () => {
      expect(calendarDaysBetween('2027-09-06', '2027-11-29')).toBe(84)
      expect(naiveDays('2027-09-06', '2027-11-29')).toBe(83)
      expect(calendarWeeksBetween('2027-09-06', '2027-11-29')).toBe(12)
    })
  })
})

describe('calendarDaysBetween — the ordinary cases it must not break', () => {
  it('same day is zero, and the sign follows the argument order', () => {
    expect(calendarDaysBetween('2026-09-21', '2026-09-21')).toBe(0)
    expect(calendarDaysBetween('2026-09-21', '2026-09-28')).toBe(7)
    expect(calendarDaysBetween('2026-09-28', '2026-09-21')).toBe(-7)
  })

  it('a date-only string is a LOCAL calendar date, never UTC midnight', () => {
    // `new Date('2027-06-01')` is UTC midnight, which in any negative-offset
    // zone reads back as 31 May. The two forms must name the same day.
    inZone('America/Los_Angeles', () => {
      expect(calendarDaysBetween(new Date(2027, 5, 1), '2027-06-01')).toBe(0)
    })
  })

  it('a Date carrying a time is read by its calendar date, not rounded by its clock', () => {
    expect(calendarDaysBetween(new Date(2027, 5, 1, 23, 59), new Date(2027, 5, 2, 0, 1))).toBe(1)
    expect(calendarDaysBetween(new Date(2027, 5, 1, 0, 1), new Date(2027, 5, 1, 23, 59))).toBe(0)
  })

  it('calendarWeeksBetween rounds down, it does not round', () => {
    expect(calendarWeeksBetween('2026-09-21', '2026-10-03')).toBe(1)   // 12 days
    expect(calendarWeeksBetween('2026-09-21', '2026-10-05')).toBe(2)   // 14 days
  })
})
