import { describe, it, expect } from 'vitest'
import { incompleteOnboardingUserIds } from './onboardingIntegrity'

describe('incompleteOnboardingUserIds', () => {
  it('flags a user with a plan but has_onboarded=false', () => {
    expect(incompleteOnboardingUserIds(['u1'], [{ id: 'u1', has_onboarded: false }])).toEqual(['u1'])
  })

  it('does NOT flag a fully onboarded user', () => {
    expect(incompleteOnboardingUserIds(['u1'], [{ id: 'u1', has_onboarded: true }])).toEqual([])
  })

  it('flags a user with a plan but no settings row at all (defaults not-onboarded)', () => {
    expect(incompleteOnboardingUserIds(['u1'], [])).toEqual(['u1'])
  })

  it('treats null has_onboarded as not onboarded', () => {
    expect(incompleteOnboardingUserIds(['u1'], [{ id: 'u1', has_onboarded: null }])).toEqual(['u1'])
  })

  it('never flags a user with no plan, however their flag reads', () => {
    expect(incompleteOnboardingUserIds([], [{ id: 'u1', has_onboarded: false }])).toEqual([])
  })

  it('separates a mixed cohort correctly', () => {
    const flagged = incompleteOnboardingUserIds(
      ['a', 'b', 'c', 'd'],
      [
        { id: 'a', has_onboarded: true },   // fine
        { id: 'b', has_onboarded: false },  // leak
        { id: 'c', has_onboarded: null },   // leak
        // d: no settings row → leak
      ],
    )
    expect(flagged.sort()).toEqual(['b', 'c', 'd'])
  })

  it('is idempotent on a duplicated plan id', () => {
    expect(incompleteOnboardingUserIds(['u1', 'u1'], [{ id: 'u1', has_onboarded: false }])).toEqual(['u1'])
  })
})
