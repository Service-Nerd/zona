import { describe, it, expect } from 'vitest'
import { profileInitials } from './profileInitials'

// THE REGRESSION THIS FILE EXISTS FOR (PROFILE-NAME-01).
//
// The Me screen drew an EMPTY moss circle for any runner with no saved name.
// Nothing crashed and nothing logged: `plan.meta.athlete` is an empty string,
// not undefined, so the `?? '?'` guard never fired and the split/map/join chain
// quietly produced ''. There is no symptom to notice next time, which is why
// this is a test and not a note.
describe('profileInitials', () => {
  it('never returns an empty string, whatever is missing', () => {
    const cases = [
      {},
      { firstName: '', lastName: '', planAthlete: '', email: '' },
      { firstName: null, lastName: null, planAthlete: null, email: null },
      { firstName: '   ', lastName: '   ', planAthlete: '   ', email: '   ' },
    ]
    for (const c of cases) {
      expect(profileInitials(c)).not.toBe('')
    }
  })

  it('falls back to the email when the name and the plan are both empty', () => {
    // The exact shape that shipped blank: a password signup with a generated
    // plan. `planAthlete` is '' because ruleEngine stamps `athlete_name ?? ''`.
    expect(profileInitials({ firstName: '', lastName: '', planAthlete: '', email: 'test@test.com' }))
      .toBe('T')
  })

  it('prefers the saved profile name over the plan and the email', () => {
    expect(profileInitials({ firstName: 'Russell', lastName: 'Shear', planAthlete: 'Someone Else', email: 'x@y.com' }))
      .toBe('R')
  })

  // 🔴 THE ARM THE BOARD REQUIRED, AND THE DEFECT IT WOULD HAVE CAUGHT.
  //
  // PROFILE-IDENTITY-01 retired last name from the profile. Left alone, this owner would
  // have returned ONE letter from a saved first name and TWO from the `planAthlete`
  // fallback — so the avatar changed shape depending on WHICH SOURCE HAPPENED TO FIRE,
  // which no runner would report and everyone would feel. Sources are enumerated here so
  // adding a fourth cannot quietly return two.
  it('returns exactly ONE letter from every source', () => {
    const fromEverySource = [
      { firstName: 'Russell', lastName: 'Shear' },
      { planAthlete: 'Ada Lovelace' },
      { planAthlete: 'Anne Bonny Cormac Dubh' },
      { email: 'test@test.com' },
      {},
    ]
    for (const c of fromEverySource) {
      expect(profileInitials(c), JSON.stringify(c)).toHaveLength(1)
    }
  })

  // ⚠️ `lastName` is still ACCEPTED and deliberately ignored. Sign in with Apple hands
  // us a surname on the very first authorization and never again, so we keep storing it
  // while no longer asking for or showing it. This asserts it cannot leak back into the
  // circle.
  it('ignores a stored last name', () => {
    expect(profileInitials({ firstName: 'Russell', lastName: 'Shear' }))
      .toBe(profileInitials({ firstName: 'Russell' }))
  })

  it('works from a first name alone — what an email signup now captures', () => {
    expect(profileInitials({ firstName: 'Russell', lastName: '', email: 'x@y.com' })).toBe('R')
  })

  it('reads the plan name when no profile name is saved', () => {
    expect(profileInitials({ planAthlete: 'Ada Lovelace', email: 'x@y.com' })).toBe('A')
  })

  it('tolerates a plan name with stray whitespace', () => {
    expect(profileInitials({ planAthlete: '  Ada   Lovelace  ', email: 'x@y.com' })).toBe('A')
  })

  it('takes the first letter only, however many names there are', () => {
    expect(profileInitials({ planAthlete: 'Anne Bonny Cormac Dubh' })).toBe('A')
  })

  it('uppercases whatever it finds', () => {
    expect(profileInitials({ firstName: 'russell', lastName: 'shear' })).toBe('R')
    expect(profileInitials({ email: 'test@test.com' })).toBe('T')
  })
})
