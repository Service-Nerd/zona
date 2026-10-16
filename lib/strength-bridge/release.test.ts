import { describe, it, expect } from 'vitest'
import { canUseStrength, STRENGTH_RELEASE } from './release'

/** 🔒 STRENGTH-ENGINE-01 — admin-only while the founder tests it. Admins resolve as 'paid', so tier alone cannot gate this. */
describe('canUseStrength', () => {
  it('the release switch is admin-only today', () => { expect(STRENGTH_RELEASE).toBe('admin') })
  it('🔴 admin release: a paying non-admin is refused', () => {
    expect(canUseStrength({ isAdmin: false, tier: 'paid' })).toBe(false)
    expect(canUseStrength({ isAdmin: false, tier: 'trial' })).toBe(false)
    expect(canUseStrength({ isAdmin: true, tier: 'paid' })).toBe(true)
  })
  it('paid release: paid and trial pass, free does not', () => {
    expect(canUseStrength({ isAdmin: false, tier: 'paid' }, 'paid')).toBe(true)
    expect(canUseStrength({ isAdmin: false, tier: 'trial' }, 'paid')).toBe(true)
    expect(canUseStrength({ isAdmin: false, tier: 'free' }, 'paid')).toBe(false)
  })
})
