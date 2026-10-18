import { describe, it, expect } from 'vitest'
import { generateStrengthPlan, type StrengthPlan } from '@/packages/strength'
import { applyRecoveryEases, parseRecoveryEases, strengthEaseEligible } from './recoveryEases'

/** STRENGTH-RECOVERY-01 — nothing is eased without an answer; only "eased" eases; the store is never trusted. */
const plan: StrengthPlan = generateStrengthPlan({ focus: 'running', session_minutes: 45, sessions_per_week: 3, equipment: ['dumbbells', 'bench'], experience: 'some' }, null, { standaloneStart: '2026-11-02' })
const all = plan.weeks.flatMap(w => w.sessions)
const lift = all.find(s => s.kind !== 'mobility' && s.date)!

describe('recovery answers', () => {
  it('a stored value of any shape becomes a clean map', () => {
    expect(parseRecoveryEases({ '2026-11-02': 'eased', '2026-11-03': 'declined', 'x': 'eased', '2026-11-04': 'yes' })).toEqual({ '2026-11-02': 'eased', '2026-11-03': 'declined' })
    expect(parseRecoveryEases(null)).toEqual({})
    expect(parseRecoveryEases([1])).toEqual({})
  })
  it('🔴 only an "eased" date is served lighter; "declined" and no answer leave the plan as it was', () => {
    const eased = applyRecoveryEases(plan, { [lift.date!]: 'eased' }).weeks.flatMap(w => w.sessions)
    expect(eased.filter(s => s.eased_for).map(s => s.date)).toEqual([lift.date])
    expect(applyRecoveryEases(plan, { [lift.date!]: 'declined' })).toBe(plan)
    expect(applyRecoveryEases(plan, {})).toBe(plan)
  })
  it('🔴 a declined day stays as planned even when another day was eased', () => {
    const other = all.find(s => s.kind !== 'mobility' && s.date && s.date !== lift.date)!
    const out = applyRecoveryEases(plan, { [lift.date!]: 'declined', [other.date!]: 'eased' }).weeks.flatMap(w => w.sessions)
    expect(out.find(s => s.date === lift.date)!.eased_for).toBeUndefined()
    expect(out.find(s => s.date === other.date)!.eased_for).toBe('recovery')
  })
  it('applying twice does not ease twice (the client re-applies after the server already did)', () => {
    const once = applyRecoveryEases(plan, { [lift.date!]: 'eased' })
    expect(applyRecoveryEases(once, { [lift.date!]: 'eased' })).toEqual(once)
  })
  it('mobility is never offered: it has no load to take away', () => {
    expect(strengthEaseEligible({ ...lift, kind: 'mobility' })).toBe(false)
    expect(strengthEaseEligible(lift)).toBe(true)
    expect(strengthEaseEligible(null)).toBe(false)
  })
})
