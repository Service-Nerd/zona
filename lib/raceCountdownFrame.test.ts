// PLAN-COUNTDOWN-SOURCE-01 — the countdown owner reads the race date in the
// RUNNER'S calendar, not as UTC midnight.
//
// 🔴 WHAT THIS CAUGHT, measured before the fix. `daysUntilRace` was
// `Math.ceil((new Date(raceDate) - now) / 86_400_000)`, and every call site
// hands it `plan.meta.race_date`, a bare `YYYY-MM-DD`. `new Date()` parses a
// date-only string as UTC midnight, so the target was 16:00 the previous
// afternoon in Los Angeles and 11:00 the NEXT day in Sydney:
//
//   America/Los_Angeles  16:00 the day before the race  →  "Race day"
//   America/New_York     20:00 the day before the race  →  "Race day"
//   Australia/Sydney     08:00 ON race day              →  "1 day"
//
// 7 of 20 probes wrong, in both directions. `lib/dates.ts` was written the day
// BEFORE the countdown owner, is declared the single owner (D-08) of
// "how many whole days between these two dates", and its header names this
// exact parsing trap. The countdown owner did not call it.
//
// ⚠️ AND THE EXISTING GATE COULD NOT FAIL: `appReviewWave3.test.ts` asserts the
// ceil contract with `new Date('2027-04-24T00:00:00')` — a Date carrying a TIME,
// which parses LOCAL. The one input shape no caller uses.
import { describe, it, expect, afterAll } from 'vitest'
import { daysUntilRace, weeksUntilRace } from '@/lib/format'
import { calendarDaysBetween } from '@/lib/dates'

const RACE = '2026-12-12'
const ZONES = ['Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney'] as const
/** Local wall-clock instants either side of the boundary the defect lived on. */
const PROBES = [
  '2026-12-11T08:00:00', '2026-12-11T16:00:00', '2026-12-11T20:00:00',
  '2026-12-11T23:30:00', '2026-12-12T08:00:00',
] as const

const ORIGINAL_TZ = process.env.TZ
afterAll(() => { if (ORIGINAL_TZ === undefined) delete process.env.TZ; else process.env.TZ = ORIGINAL_TZ })

/** The implementation as it stood, written out — the mutation this gate must reach. */
const beforeFix = (raceDate: string, now: Date) =>
  Math.max(0, Math.ceil((new Date(raceDate).getTime() - now.getTime()) / 86_400_000))

describe('the race countdown reads the runner\'s calendar', () => {
  // ⚠️ AN EMPTY POPULATION MUST NOT RENDER AS A PASS. If this process ignores a
  // mid-run TZ change, every zone below silently becomes the same zone and the
  // whole file proves nothing. So prove the switch BITES first.
  it('🔑 switching TZ actually moves the clock in this process', () => {
    process.env.TZ = 'Europe/London'
    const london = new Date('2026-12-12T00:00:00Z').getHours()
    process.env.TZ = 'Australia/Sydney'
    const sydney = new Date('2026-12-12T00:00:00Z').getHours()
    expect(london, 'TZ is not being honoured — the zones below are not distinct').not.toBe(sydney)
  })

  it('every zone, every probe: whole calendar days, never a millisecond quotient', () => {
    for (const tz of ZONES) {
      process.env.TZ = tz
      for (const p of PROBES) {
        const now = new Date(p)
        expect(daysUntilRace(RACE, now), `${tz} @ ${p}`).toBe(Math.max(0, calendarDaysBetween(now, RACE)))
      }
    }
  })

  it('🔴 and the gate REACHES the defect — the old expression diverges on 7 of 20', () => {
    let diverged = 0
    const zonesHit = new Set<string>()
    for (const tz of ZONES) {
      process.env.TZ = tz
      for (const p of PROBES) {
        const now = new Date(p)
        if (beforeFix(RACE, now) !== daysUntilRace(RACE, now)) { diverged++; zonesHit.add(tz) }
      }
    }
    // Pinned, not "> 0": a count that drops is the harness losing its reach.
    expect(diverged).toBe(7)
    expect(Array.from(zonesHit).sort())
      .toEqual(['America/Los_Angeles', 'America/New_York', 'Australia/Sydney'])
  })

  it('the three named instances, each at the hour it went wrong', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(daysUntilRace(RACE, new Date('2026-12-11T16:00:00'))).toBe(1)   // was 0: "Race day"
    process.env.TZ = 'America/New_York'
    expect(daysUntilRace(RACE, new Date('2026-12-11T20:00:00'))).toBe(1)   // was 0: "Race day"
    process.env.TZ = 'Australia/Sydney'
    expect(daysUntilRace(RACE, new Date('2026-12-12T08:00:00'))).toBe(0)   // was 1: "1 day", on the day
  })

  it('the documented contract still holds: race-eve morning is 1, never a rounded-down 0', () => {
    process.env.TZ = 'Europe/London'
    expect(daysUntilRace(RACE, new Date('2026-12-11T08:00:00'))).toBe(1)
    expect(daysUntilRace(RACE, new Date('2026-12-20T08:00:00'))).toBe(0)   // never negative
    expect(daysUntilRace(null)).toBeNull()
    expect(daysUntilRace('not-a-date')).toBeNull()
    // A Date carrying a time still reads its LOCAL calendar day.
    expect(daysUntilRace(new Date('2026-12-12T23:00:00'), new Date('2026-12-11T01:00:00'))).toBe(1)
  })
})

describe('weeksUntilRace — one owner for the four prompt sites', () => {
  it('is round, the convention the four copies already used', () => {
    process.env.TZ = 'Europe/London'
    const at = (d: string) => weeksUntilRace(RACE, new Date(`${d}T08:00:00`))
    expect(at('2026-12-08')).toBe(1)   //  4 days → "1 week". Stated, not discovered.
    expect(at('2026-12-02')).toBe(1)   // 10 days → "1 week" as well.
    expect(at('2026-11-28')).toBe(2)   // 14 days
    expect(at('2026-12-12')).toBe(0)
    expect(weeksUntilRace(null)).toBeNull()
  })

  // 🔴 THE DEFECT THIS OWNER REPLACED WAS A TIME-OF-DAY DEPENDENCY, and the four
  // prompt sites branch on `=== 0` to say *"Race week."* — so the coaching FRAME
  // moved with the hour the cron fired. Measured by running the prompt line:
  //   race in  4 days  →  08:00 "1 week to race."   19:00 "Race week."
  //   race in 11 days  →  08:00 "2 weeks to race."  19:00 "1 week to race."
  it('🔴 the same day gives the same answer whatever hour the note is generated', () => {
    process.env.TZ = 'Europe/London'
    for (const race of ['2026-11-19', '2026-11-26', '2026-12-12']) {
      const hours = ['00:30:00', '08:00:00', '13:00:00', '19:00:00', '23:45:00']
      const answers = new Set(hours.map(h => weeksUntilRace(race, new Date(`2026-11-15T${h}`))))
      expect(answers.size, `${race} gave ${Array.from(answers).join('/')} across one day`).toBe(1)
    }
    // And the same for days, which is where it started.
    const days = new Set(['00:30:00', '13:00:00', '23:45:00']
      .map(h => daysUntilRace('2026-12-12', new Date(`2026-11-15T${h}`))))
    expect(days.size).toBe(1)
  })

  it('and it is DST-proof, because it reads the day owner', () => {
    process.env.TZ = 'America/Los_Angeles'
    expect(weeksUntilRace(RACE, new Date('2026-12-11T20:00:00'))).toBe(0)
    process.env.TZ = 'Australia/Sydney'
    expect(weeksUntilRace(RACE, new Date('2026-12-05T08:00:00'))).toBe(1)
  })
})
