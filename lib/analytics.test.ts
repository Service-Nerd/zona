import { describe, it, expect } from 'vitest'
import { isUserCancelled, purchaseOutcome } from './analytics'

// OPS-FUNNEL-01. The reason this is tested at all: `cancelled` and `failed` lead to
// OPPOSITE conclusions about whether the purchase path works, and the rule deciding
// between them previously existed twice in UpgradeScreen with two different
// predicates. `app/**` is not collected by vitest (see vitest.config.ts), so the
// rule has to live in lib/ to be testable at all.

describe('isUserCancelled — strict, on purpose', () => {
  it('is true only for the literal boolean true', () => {
    expect(isUserCancelled({ userCancelled: true })).toBe(true)
  })

  it('is false for a real failure', () => {
    expect(isUserCancelled(new Error('No offering available.'))).toBe(false)
    expect(isUserCancelled({ userCancelled: false })).toBe(false)
  })

  it('survives null, undefined and non-objects without throwing', () => {
    expect(isUserCancelled(null)).toBe(false)
    expect(isUserCancelled(undefined)).toBe(false)
    expect(isUserCancelled('userCancelled')).toBe(false)
    expect(isUserCancelled(0)).toBe(false)
  })

  // THE DRIFT THIS OWNER EXISTS TO CLOSE. `handleRestore` used a truthy test, which
  // would call these cancellations. A truthy value that is not `true` is far more
  // likely to be a malformed error than a deliberate dismissal, and classifying it
  // as "the user changed their mind" hides a broken purchase path completely.
  it('does NOT treat a truthy non-boolean as a cancellation', () => {
    expect(isUserCancelled({ userCancelled: 'yes' })).toBe(false)
    expect(isUserCancelled({ userCancelled: 1 })).toBe(false)
    expect(isUserCancelled({ userCancelled: {} })).toBe(false)
  })
})

describe('purchaseOutcome', () => {
  it('maps a dismissal to cancelled and everything else to failed', () => {
    expect(purchaseOutcome({ userCancelled: true })).toBe('cancelled')
    expect(purchaseOutcome(new Error('network'))).toBe('failed')
    expect(purchaseOutcome(undefined)).toBe('failed')
  })

  it('never returns success — that path does not throw', () => {
    const outcomes = [{ userCancelled: true }, new Error('x'), null, 'str'].map(purchaseOutcome)
    expect(outcomes).not.toContain('success')
  })
})
