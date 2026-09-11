// GTM-CHARITY-04 — the tier-resolution contract.
//
// `getUserTier` needs a live service-role client, so it is not unit-testable.
// What carries the risk is the ORDER and the PREDICATES, and those now live in
// the pure `resolveTier`, which this file tests DIRECTLY.
//
// ⚠️ IT DID NOT USED TO. This file previously carried its own private
// `resolve()` — a hand-copied third implementation of the order, alongside
// `getUserTier` and the OR-chain in `DashboardClient`. So it asserted that its
// OWN COPY was correct and could not catch either real producer drifting. That
// is the exact flaw CLAUDE.md records for `deloadCadence.test.ts`: a checker
// that shares the producer's predicate cannot catch the producer being wrong.
// D-16 (no parallel semantics) had a warning comment and no mechanism, and the
// split was nearly shipped once — the server order changed while the client
// mirror sat two commits behind, which would have made a comped runner `paid`
// on the server and `free` in the UI. One owner now; the copies are gone.

import { describe, it, expect } from 'vitest'
import { resolveTier } from '@/lib/trial'
import { isGrantActive, initialGrantExpiry } from './grantWindow'

const NOW = new Date('2026-09-11T10:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const at = (n: number) => new Date(NOW.getTime() + n * DAY)

/** Thin adapter so the existing assertions read unchanged. Calls the REAL
 *  owner — it is not a reimplementation of it. */
const resolve = (input: Parameters<typeof resolveTier>[0], now: Date) =>
  resolveTier(input, now).tier

describe('tier resolution with a charity grant', () => {
  it('a live grant resolves as paid', () => {
    expect(resolve({ grantExpiresAt: at(30) }, NOW)).toBe('paid')
  })

  // The whole point of the feature. Without this, a comped charity runner
  // hits the marathon paywall the grant was meant to remove.
  it('a live grant beats an expired trial', () => {
    expect(resolve({ grantExpiresAt: at(30), trialStartedAt: at(-40) }, NOW)).toBe('paid')
  })

  it('an expired grant does not', () => {
    expect(resolve({ grantExpiresAt: at(-1), trialStartedAt: at(-40) }, NOW)).toBe('free')
  })

  it('no grant is unaffected — every other user takes the old path', () => {
    expect(resolve({ trialStartedAt: at(-2) }, NOW)).toBe('trial')
    expect(resolve({ trialStartedAt: at(-40) }, NOW)).toBe('free')
    expect(resolve({ subStatus: 'active', subPeriodEnd: at(30) }, NOW)).toBe('paid')
    expect(resolve({ isAdmin: true }, NOW)).toBe('paid')
  })

  // Order matters: a runner who later PAYS should be resolved by their payment,
  // not by an expiring gift. If the grant were checked first, their tier would
  // flip back to free the day the grant lapsed despite an active subscription.
  it('an active subscription is checked before the grant', () => {
    const bothLive = resolve({
      subStatus: 'active', subPeriodEnd: at(365), grantExpiresAt: at(30),
    }, NOW)
    expect(bothLive).toBe('paid')

    // And the subscription alone still carries them once the grant lapses.
    expect(resolve({
      subStatus: 'active', subPeriodEnd: at(365), grantExpiresAt: at(-1),
    }, NOW)).toBe('paid')
  })

  // THE RISK THE BOARD FLAGGED, as a test. The RevenueCat webhook upserts
  // `subscriptions` onConflict user_id. If a grant had been stored there (the
  // spec's original proposal), an EXPIRATION event would overwrite it and
  // silently revoke a comped runner's access mid-block. Because the grant lives
  // in its own table, an unrelated subscription event cannot touch it.
  it('a cancelled or expired subscription does not revoke a live grant', () => {
    for (const status of ['cancelled', 'expired']) {
      expect(resolve({
        subStatus: status, subPeriodEnd: at(-1), grantExpiresAt: at(30),
      }, NOW)).toBe('paid')
    }
  })

  // THE DAY-ONE CHARITY RUNNER, and a gap this suite had.
  //
  // They install, get the standard 14-day trial, and redeem their code on day
  // one — so trial and grant are BOTH live. Found by falsification: moving the
  // grant check below the trial check did NOT fail this file, because every
  // other case pairs a live grant with an EXPIRED trial. The two orders only
  // diverge when both are live, and that is the most likely real arrival.
  //
  // It has to resolve `paid`, not `trial`. `hasPaidAccess` is true either way,
  // so the app would look fine — but the trial lifecycle keys off the trial
  // state, and a runner holding a 90-day gift would be told their trial is
  // ending. Same wrong-words defect as the lapsed-grant framing, in email.
  it('a live grant beats a LIVE trial, not just an expired one', () => {
    const r = resolveTier({ grantExpiresAt: at(80), trialStartedAt: at(-1) }, NOW)
    expect(r.tier).toBe('paid')
    expect(r.reason).toBe('grant')
  })

  it('the grant granted at redemption is live immediately', () => {
    expect(isGrantActive(initialGrantExpiry(NOW), NOW)).toBe(true)
  })
})

// ── The REASON, which is what the lapsed framing is built on ────────────────
//
// A lapsed trial and a lapsed grant both resolve to `free`. The tier alone
// therefore cannot answer "what do we say to this person?", and the UI said
// "14 days done" to a runner who was given the app months earlier.
describe('why access resolved the way it did', () => {
  it('names the source of paid access', () => {
    expect(resolveTier({ isAdmin: true }, NOW).reason).toBe('admin')
    expect(resolveTier({ subStatus: 'active', subPeriodEnd: at(30) }, NOW).reason).toBe('subscription')
    expect(resolveTier({ grantExpiresAt: at(30) }, NOW).reason).toBe('grant')
    expect(resolveTier({ trialStartedAt: at(-2) }, NOW).reason).toBe('trial')
    expect(resolveTier({}, NOW).reason).toBe('none')
  })

  // The distinction the framing depends on. Both are `free`; only the reason
  // differs, and it differs in the direction that changes the words.
  it('a lapsed grant and a lapsed trial are both free, and both report none', () => {
    const lapsedGrant = resolveTier({ grantExpiresAt: at(-1), trialStartedAt: at(-200) }, NOW)
    const lapsedTrial = resolveTier({ trialStartedAt: at(-40) }, NOW)
    expect(lapsedGrant.tier).toBe('free')
    expect(lapsedTrial.tier).toBe('free')
    expect(lapsedGrant.reason).toBe('none')
    expect(lapsedTrial.reason).toBe('none')
  })

  // So the UI cannot use `reason` to tell them apart AFTER the fact — it has to
  // know a grant existed at all. That is why DashboardClient keeps
  // `charityGrantEndsAt` (the row, present whether live or lapsed) and passes
  // it to UpgradeScreen, rather than trying to infer it from the tier.
  it('paid-by-grant is distinguishable from paid-by-subscription while live', () => {
    expect(resolveTier({ grantExpiresAt: at(30) }, NOW).reason).toBe('grant')
    expect(
      resolveTier({ subStatus: 'active', subPeriodEnd: at(30), grantExpiresAt: at(30) }, NOW).reason,
    ).toBe('subscription')
  })
})
