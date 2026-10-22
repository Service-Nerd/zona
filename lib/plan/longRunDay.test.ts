// LONGRUN-BLOCKED-DAY-01 (§18 Amendment 2, Coaching Board 2026-10-22).
// The long run never lands on a blocked day and the plan is never refused for it:
// with both weekend days blocked it walks back from Friday.
import { describe, it, expect } from 'vitest'
import { longRunDayFor, DAY_ORDER, type Day } from './days'
import { generateRulePlan } from './ruleEngine'
import { MARKETING_PLANS } from '../marketing/plans'

const marathon = MARKETING_PLANS.find(p => p.distanceKm > 40)!.input('2027-04-25')

function longRunDays(blocked: string[]): Set<string> {
  const plan = generateRulePlan({ ...marathon, days_cannot_train: blocked }, 'paid', '2026-11-02')
  const days = new Set<string>()
  for (const w of plan.weeks) {
    for (const [d, s] of Object.entries(w.sessions)) {
      const list = Array.isArray(s) ? s : [s]
      for (const x of list) if (x && x.role === 'long_run') days.add(d)
    }
  }
  return days
}

describe('longRunDayFor — the single owner of the long-run day', () => {
  it('honours the preferred weekend day, then the other one', () => {
    expect(longRunDayFor('sun', new Set())).toBe('sun')
    expect(longRunDayFor('sat', new Set())).toBe('sat')
    expect(longRunDayFor('sun', new Set<Day>(['sun']))).toBe('sat')
    expect(longRunDayFor(undefined, new Set<Day>(['sun']))).toBe('sat')
  })

  it('walks back from Friday when both weekend days are blocked', () => {
    expect(longRunDayFor('sun', new Set<Day>(['sat', 'sun']))).toBe('fri')
    expect(longRunDayFor('sun', new Set<Day>(['fri', 'sat', 'sun']))).toBe('thu')
    expect(longRunDayFor('sat', new Set<Day>(['thu', 'fri', 'sat', 'sun']))).toBe('wed')
  })

  it('never returns a blocked day; null only when every day is blocked', () => {
    for (let mask = 0; mask < 128; mask++) {
      const blocked = new Set<Day>(DAY_ORDER.filter((_, i) => mask & (1 << i)))
      for (const pref of ['sat', 'sun', undefined] as const) {
        const d = longRunDayFor(pref, blocked)
        if (blocked.size === 7) expect(d).toBeNull()
        else expect(d !== null && !blocked.has(d)).toBe(true)
      }
    }
  })

  it("matches the foundation block's old rule on every one of the 128 week shapes (no foundation plan moves)", () => {
    // foundationBlock.ts before this change: pref list, then the LATEST available day.
    for (let mask = 0; mask < 127; mask++) {
      const blocked = new Set<Day>(DAY_ORDER.filter((_, i) => mask & (1 << i)))
      const available = DAY_ORDER.filter(d => !blocked.has(d))
      for (const pref of ['sat', 'sun', undefined] as const) {
        const list: Day[] = pref === 'sat' ? ['sat', 'sun', 'fri'] : ['sun', 'sat', 'fri']
        const old = list.find(d => !blocked.has(d)) ?? available[available.length - 1]
        expect(longRunDayFor(pref, blocked)).toBe(old)
      }
    }
  })
})

describe('the engine with Friday, Saturday and Sunday blocked', () => {
  it('puts every long run on Thursday, and validatePlan passes (it throws under test on a blocked day)', () => {
    expect(Array.from(longRunDays(['friday', 'saturday', 'sunday']))).toEqual(['thu'])
  })

  it('with only the weekend blocked, Friday carries it, as before', () => {
    expect(Array.from(longRunDays(['saturday', 'sunday']))).toEqual(['fri'])
  })

  it('an unconstrained runner is unchanged: Sunday', () => {
    expect(Array.from(longRunDays([]))).toEqual(['sun'])
  })

  it('a runner blocking Tue, Wed and Thu still gets quality (Monday was picked beside a Sunday long run, then dropped)', () => {
    const plan = generateRulePlan(
      { ...marathon, days_available: 3, days_cannot_train: ['tuesday', 'wednesday', 'thursday'] }, 'paid', '2026-11-02')
    const quality = plan.weeks.flatMap(w => Object.values(w.sessions).flat()).filter(s => s && s.type === 'quality')
    expect(quality.length).toBeGreaterThan(0)
  })
})
