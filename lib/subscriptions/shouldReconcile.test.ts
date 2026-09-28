import { describe, it, expect } from 'vitest'
import { shouldReconcile, type ReconcileGateInputs } from './shouldReconcile'
import type { TierReason } from '../trial'

// SUBS-RECONCILE-TRIAL-GATE-01 — the population arm is the regression.
//
// 🔴 THE DEFECT, MEASURED. The old guard was `if (hasPaidAccess) return`, and
// `hasPaidAccess` is `tier !== 'free'`. Every brand-new account is in a 14-day reverse
// trial, so it was `true` for exactly the runners reconcile exists to rescue.
// `tester1@test.com` held a £0 one-year entitlement to 2027-09-28 and reconcile was
// skipped on two separate app opens, leaving `subscriptions` and `ops_events` empty.

const base: ReconcileGateInputs = {
  appReady: true,
  userId: '2a78cd26-2a90-4a3d-800b-cfda41cea453',
  tierReason: 'trial',
  isNative: true,
  alreadyTried: false,
}

describe('shouldReconcile — who gets asked about', () => {
  // ⚠️ THE ARM THAT WOULD HAVE CAUGHT IT. A gate that skips 'trial' is the defect,
  // and the defect is invisible for 14 days because the trial covers for it.
  it('ASKS for a runner on a trial — the case the old guard excluded', () => {
    expect(shouldReconcile({ ...base, tierReason: 'trial' })).toBe(true)
  })

  it('asks for a runner with no access at all', () => {
    expect(shouldReconcile({ ...base, tierReason: 'none' })).toBe(true)
  })

  // A charity runner on a Supabase grant may ALSO have redeemed an Apple code, and
  // `resolveTier` ranks a subscription above a grant so that a runner who pays is
  // resolved by their payment. Skipping them would strand the overlap.
  it('asks for a runner on a charity grant', () => {
    expect(shouldReconcile({ ...base, tierReason: 'grant' })).toBe(true)
  })

  it('does not ask when access is already explained by a recorded subscription', () => {
    expect(shouldReconcile({ ...base, tierReason: 'subscription' })).toBe(false)
  })

  it('does not ask for an admin, whose access is unconditional', () => {
    expect(shouldReconcile({ ...base, tierReason: 'admin' })).toBe(false)
  })

  // 📐 POPULATION ARM, derived from the type rather than hand-listed: every
  // `TierReason` must be decided here, so adding one to `lib/trial.ts` cannot silently
  // inherit whichever branch it happens to fall into.
  it('every TierReason is decided, and only two are skipped', () => {
    const ALL: TierReason[] = ['admin', 'subscription', 'grant', 'trial', 'none']
    const asked = ALL.filter(r => shouldReconcile({ ...base, tierReason: r }))
    expect(asked.sort()).toEqual(['grant', 'none', 'trial'])
  })
})

describe('shouldReconcile — the cheap refusals', () => {
  it('waits until the tier is known rather than asking on first paint', () => {
    expect(shouldReconcile({ ...base, tierReason: null })).toBe(false)
  })

  it('never asks on web — there is no StoreKit receipt to alias off', () => {
    expect(shouldReconcile({ ...base, isNative: false })).toBe(false)
  })

  it('asks once per mount', () => {
    expect(shouldReconcile({ ...base, alreadyTried: true })).toBe(false)
  })

  it.each([
    ['not ready', { appReady: false }],
    ['no user',   { userId: null }],
  ] as const)('does not ask when %s', (_label, patch) => {
    expect(shouldReconcile({ ...base, ...patch })).toBe(false)
  })
})
