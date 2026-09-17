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
      .toBe('RS')
  })

  it('works from a first name alone — what an email signup now captures', () => {
    expect(profileInitials({ firstName: 'Russell', lastName: '', email: 'x@y.com' })).toBe('R')
  })

  it('reads the plan name when no profile name is saved', () => {
    expect(profileInitials({ planAthlete: 'Ada Lovelace', email: 'x@y.com' })).toBe('AL')
  })

  it('tolerates a plan name with stray whitespace', () => {
    expect(profileInitials({ planAthlete: '  Ada   Lovelace  ', email: 'x@y.com' })).toBe('AL')
  })

  it('caps at two letters', () => {
    expect(profileInitials({ planAthlete: 'Anne Bonny Cormac Dubh' })).toBe('AB')
  })

  it('uppercases whatever it finds', () => {
    expect(profileInitials({ firstName: 'russell', lastName: 'shear' })).toBe('RS')
    expect(profileInitials({ email: 'test@test.com' })).toBe('T')
  })
})
