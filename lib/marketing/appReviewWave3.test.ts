// App review wave 3 — S5, A1, A2, A3 (Design Board sitting three, § 6g).
//
// Four rulings, four properties that can silently come back. Each of these is a
// STRUCTURAL assertion on the source, because three of the four are about where
// something sits rather than what it says, and nothing else in the suite can
// see an ordering.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { daysUntilRace, formatRaceCountdown } from '@/lib/format'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const SHELL = strip(read('app/dashboard/DashboardClient.tsx'))
const PHONE = strip(read('components/marketing/PhoneFrame.tsx'))

describe('S5 — one time-to-race vocabulary, one owner', () => {
  it('the formatter picks the unit by proximity', () => {
    expect(formatRaceCountdown(1)).toBe('1 day')
    expect(formatRaceCountdown(5)).toBe('5 days')
    expect(formatRaceCountdown(7)).toBe('1 week')
    expect(formatRaceCountdown(8)).toBe('1 week, 1 day')
    expect(formatRaceCountdown(214)).toBe('30 weeks, 4 days')
    // The board's three vocabularies collapse to one: this is the ONLY
    // permitted variation, and it varies placement, not the number or unit.
    expect(formatRaceCountdown(214, { suffix: 'out' })).toBe('30 weeks, 4 days out')
    expect(formatRaceCountdown(0)).toBe('')
  })

  it('🔴 the arithmetic has ONE owner — it was written four times, two ways', () => {
    // Three `Math.ceil` and one `Math.round` against the same race date, so two
    // surfaces could legitimately disagree by a day either side of midnight.
    // ⚠️ BOUNDED TO THE RACE. The first cut matched any `getTime()` difference
    // over a day and caught `daysToPlanStart`, which is a different quantity
    // with its own meaning — the denominator error this repo keeps recording.
    // The subject has to be the race date, not "something measured in days".
    const handRolled = Array.from(
      SHELL.matchAll(/(?:raceDate|race_date)[^\n]*getTime\(\)[^\n]*86_?400_?000/g),
    ).map(m => m[0])
    expect(handRolled, 'days-to-race arithmetic outside lib/format.ts').toEqual([])
    expect(SHELL).toContain('daysUntilRace(')
  })

  it('ceil, so race-eve morning is "1 day" and not a rounded-down zero', () => {
    const race = new Date('2027-04-24T00:00:00')
    const eveMorning = new Date('2027-04-23T08:00:00')
    expect(daysUntilRace(race, eveMorning)).toBe(1)
    // Never negative, and never a silent 0 for a plan with no race at all.
    expect(daysUntilRace(race, new Date('2027-05-01T08:00:00'))).toBe(0)
    expect(daysUntilRace(null)).toBeNull()
    expect(daysUntilRace('not-a-date')).toBeNull()
  })

  it('no surface hand-builds a countdown string any more', () => {
    // The three the board measured: "N days to go", "N days until then",
    // and a bare "Race in N days".
    expect(SHELL).not.toMatch(/days to go/)
    expect(SHELL).not.toMatch(/days until/)
    expect(SHELL).not.toMatch(/day\$\{daysToRace === 1/)
  })

  it('🔴 THE WEBSITE USES THE OWNER — it used to mirror it by hand', () => {
    // PhoneFrame's own comment promised it "mirrors formatRaceCountdown()".
    // A format copied by hand with a comment promising it matches is drift
    // waiting to happen, and the consumer check is what found it.
    expect(PHONE).toContain("from '@/lib/format'")
    expect(PHONE).toContain('formatRaceCountdown(')
    expect(PHONE).not.toMatch(/`\$\{totalWeeks - weekN\} weeks out`/)
  })
})

describe('A1 — Today is one day; Plan owns weeks', () => {
  it('DateStrip has no week navigation', () => {
    expect(SHELL).not.toMatch(/Week \{weekIndex \+ 1\} of \{totalWeeks\}/)
    expect(SHELL).not.toMatch(/onWeekChange/)
  })

  it('and the screen-wide swipe went with the arrows', () => {
    // Removing the visible control while leaving the gesture would be worse
    // than either: an undiscoverable route to a week Today cannot explain.
    expect(SHELL).not.toMatch(/onTouchStart=\{onTouchStart\}/)
  })

  it('the mirrored week state is gone — one owner for "which week is it"', () => {
    expect(SHELL).not.toMatch(/setViewWeekIndex/)
    expect(SHELL).toContain('<TodayScreen plan={plan} weekIndex={currentWeekIndex}')
  })
})

describe('A2 — Plan leads with the plan', () => {
  it('🔴 the weeks come BEFORE the cards that explain them', () => {
    const cal   = SHELL.indexOf('<PlanCalendar')
    const zone  = SHELL.indexOf('<ZoneWeekBlock')
    const intro = SHELL.indexOf('<PlanIntroCard')
    expect(cal).toBeGreaterThan(-1)
    expect(cal, 'PlanCalendar must precede ZoneWeekBlock').toBeLessThan(zone)
    expect(cal, 'PlanCalendar must precede PlanIntroCard').toBeLessThan(intro)
  })

  it('nothing was cut — all five blocks still render', () => {
    // The ruling is an ordering, not a deletion. If a later change drops one
    // of these while "tidying the order", this says so.
    // ⚠️ 'Adjust your plan' was 'Change your plan' until PLANVERB-01, which
    // split two identically-titled rows that went to different places. A2's
    // claim is about ORDER and PRESENCE, not about which verb the row uses —
    // anchoring on incidental copy is the class recorded as "never match a
    // designed refusal by its MESSAGE", and this is its third appearance.
    for (const marker of ['<ZoneWeekBlock', '<PlanIntroCard', 'Adjust your plan', 'Why this plan']) {
      expect(SHELL, `missing after the reorder: ${marker}`).toContain(marker)
    }
  })

  it('the screen’s one ACTION is the first thing after the calendar', () => {
    const cal = SHELL.indexOf('<PlanCalendar')
    // Anchored on the row's HANDLER, which is what makes it the action, rather
    // than on its label, which PLANVERB-01 has already changed once.
    const change = SHELL.indexOf('onClick={onOpenModify}', cal)
    const zone = SHELL.indexOf('<ZoneWeekBlock', cal)
    expect(change, 'the adjust row is missing below the calendar').toBeGreaterThan(-1)
    expect(change, 'the adjust row must lead the blocks below the weeks').toBeLessThan(zone)
  })
})

describe('A3 — the race is stated once on Plan', () => {
  it('the countdown is not repeated under the arc', () => {
    // It read `{raceName} · {N} days to go` there while the heading above
    // already carried the name.
    expect(SHELL).not.toMatch(/\{raceName \? `\$\{raceName\} · ` : ''\}/)
  })

  it('the one race block carries name, date and countdown together', () => {
    const i = SHELL.indexOf('{(raceName || raceDateStr) && (')
    expect(i, 'the single race block').toBeGreaterThan(-1)
    const block = SHELL.slice(i, i + 1400)
    expect(block).toContain('{raceName}')
    expect(block).toContain('{raceDateStr}')
    expect(block).toContain('formatRaceCountdown(daysToRace')
  })

  it('and it sits above the arc, not attached to it', () => {
    // The arc is the shape of the TRAINING; the countdown is a property of the
    // RACE. Attaching it to the arc is what made the race read twice.
    const race = SHELL.indexOf('{(raceName || raceDateStr) && (')
    const arc  = SHELL.indexOf('<PlanArc')
    expect(race).toBeLessThan(arc)
  })
})
