import { describe, it, expect } from 'vitest'
import { runPlanReadback, strengthPlanReadback } from './planChangeReadback'
import type { Plan } from '@/types/plan'
import type { StrengthPlan } from '@/packages/strength'

const plan = (weeks: Record<string, unknown>[]) => ({ weeks: weeks.map((sessions, i) => ({ n: i + 1, sessions })) } as unknown as Plan)
const easy9 = { type: 'easy', distance_km: 9 }
const long16 = { type: 'easy', role: 'long_run', distance_km: 16 }

describe('runPlanReadback (SAVE-PATTERN-01)', () => {
  it('a move this week names the session and both days (the founder screenshot: Wed easy 9km to Tue)', () => {
    const before = plan([{ wed: easy9, sat: long16 }])
    const after = plan([{ tue: easy9, sat: long16 }])
    expect(runPlanReadback(before, after, 0, 'km')).toBe("Plan updated. Wednesday's easy 9km is now on Tuesday.")
  })
  it('other changes this week name the days', () => {
    expect(runPlanReadback(plan([{ wed: easy9, sat: long16 }]), plan([{ wed: { type: 'easy', distance_km: 7 }, sun: long16 }]), 0, 'km'))
      .toBe('Plan updated. This week changes on Wednesday, Saturday and Sunday.')
  })
  it('a change that starts later says when', () => {
    expect(runPlanReadback(plan([{ wed: easy9 }, { wed: easy9 }]), plan([{ wed: easy9 }, { thu: easy9 }]), 0, 'km'))
      .toBe('Plan updated. The changes start in week 2.')
  })
  it('a different length says the length', () => {
    expect(runPlanReadback(plan([{ wed: easy9 }]), plan([{ wed: easy9 }, { wed: easy9 }]), 0, 'km')).toBe('Plan updated. It is now 2 weeks.')
  })
  it('never says only "Saved", and never carries an em dash', () => {
    const s = runPlanReadback(plan([{ wed: easy9 }]), plan([{ wed: easy9 }]), 0, 'mi')
    expect(s).toBe('Plan updated. No session moved.')
    expect(s).not.toMatch(/—|^Saved/)
  })
  it('reads miles when the runner does', () => {
    expect(runPlanReadback(plan([{ wed: easy9 }]), plan([{ thu: easy9 }]), 0, 'mi')).toBe("Plan updated. Wednesday's easy 6mi is now on Thursday.")
  })
})

const sp = (days: string[], available?: string[]) => ({
  profile: { available_days: available }, weeks: [{ n: 1, phase: 'build', sessions: days.map(day => ({ day })) }],
} as unknown as StrengthPlan)

describe('strengthPlanReadback (SAVE-PATTERN-01)', () => {
  it('a first build names the days', () => {
    expect(strengthPlanReadback(null, sp(['mon', 'thu'], ['mon', 'thu']))).toBe('Strength plan built. You lift on Monday and Thursday.')
  })
  it('new days name the new days', () => {
    expect(strengthPlanReadback(sp(['mon', 'wed']), sp(['tue', 'fri'], ['tue', 'fri']))).toBe('Strength plan updated. You now lift on Tuesday and Friday.')
  })
  it('the same days say so', () => {
    expect(strengthPlanReadback(sp(['mon', 'wed']), sp(['mon', 'wed']))).toBe('Strength plan updated. Same days as before.')
  })
})
