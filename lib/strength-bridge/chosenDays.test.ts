import { describe, it, expect } from 'vitest'
import { prefillChosenDays } from './chosenDays'
import type { StrengthPlan, StrengthProfile } from '@/packages/strength'

const P: StrengthProfile = { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['bodyweight'], experience: 'some' }
const week = (phase: string, days: string[]) => ({ n: 1, phase, sessions: days.map(day => ({ day })) })
const plan = (weeks: ReturnType<typeof week>[]) => ({ weeks } as unknown as StrengthPlan)

describe('prefillChosenDays (PINNED-DAYS-01)', () => {
  it('no profile: nothing chosen, the runner picks', () => {
    expect(prefillChosenDays(null, null)).toEqual([])
  })
  it('chosen days come back as chosen, in week order', () => {
    expect(prefillChosenDays({ ...P, available_days: ['thu', 'mon'] }, null)).toEqual(['mon', 'thu'])
  })
  it('an older profile starts on the days its plan used most, ignoring taper and race week', () => {
    // The founder's case, measured: Mon/Wed in five weeks, Mon/Tue in one.
    const p = plan([...Array(5)].map(() => week('build', ['mon', 'wed'])).concat([week('build', ['mon', 'tue']), week('taper', ['tue']), week('race_week', ['tue'])]))
    expect(prefillChosenDays(P, p)).toEqual(['mon', 'wed'])
  })
  it('taper and race week do not vote: they are short on purpose', () => {
    const p = plan([week('build', ['mon', 'wed']), week('build', ['mon', 'wed']), week('build', ['mon', 'tue']), week('taper', ['tue']), week('race_week', ['tue'])])
    expect(prefillChosenDays(P, p)).toEqual(['mon', 'wed'])
  })
  it('an older profile with no plan yet starts empty', () => {
    expect(prefillChosenDays(P, null)).toEqual([])
  })
})
