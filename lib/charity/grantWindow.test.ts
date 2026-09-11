// GTM-CHARITY-04 — the grant-window rules.
//
// These decide when a comped charity runner loses access, so getting them wrong
// either cuts someone off mid training block (the failure Wood named as worse
// than never granting access) or hands out a perpetual free subscription.

import { describe, it, expect } from 'vitest'
import {
  initialGrantExpiry,
  reanchorGrantExpiry,
  isGrantActive,
  INITIAL_GRANT_DAYS,
  GRANT_CEILING_DAYS,
  POST_RACE_GRACE_DAYS,
} from './grantWindow'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-11T10:00:00.000Z')
const days = (n: number) => n * DAY
const from = (base: Date, n: number) => new Date(base.getTime() + days(n))

describe('initialGrantExpiry', () => {
  it('grants 90 days at redemption', () => {
    expect(initialGrantExpiry(NOW).toISOString()).toBe(from(NOW, 90).toISOString())
  })

  // The provisional window MUST be shorter than a typical block. If it were
  // longer, it would always win the max() in reanchor and the race+7d rule the
  // founder chose would never actually fire.
  it('is shorter than the longest plan we ship, so the race date is what binds', () => {
    expect(INITIAL_GRANT_DAYS).toBeLessThan(18 * 7)
  })
})

describe('reanchorGrantExpiry', () => {
  const grantedAt = NOW
  const provisional = initialGrantExpiry(NOW)   // +90d

  it('extends to race day plus 7 for a race beyond the provisional window', () => {
    const raceDate = from(NOW, 160)             // a marathon block
    const out = reanchorGrantExpiry({ grantedAt, currentExpiry: provisional, raceDate })
    expect(out.toISOString()).toBe(from(NOW, 160 + POST_RACE_GRACE_DAYS).toISOString())
  })

  // The whole point of the rule: an expiry may never land mid-block.
  it('never expires before race day', () => {
    for (const raceIn of [10, 45, 89, 90, 91, 200, 400]) {
      const out = reanchorGrantExpiry({ grantedAt, currentExpiry: provisional, raceDate: from(NOW, raceIn) })
      expect(out.getTime()).toBeGreaterThan(from(NOW, raceIn).getTime())
    }
  })

  it('keeps the longer provisional window for a race inside 90 days', () => {
    // A 10K five weeks out: race+7d is sooner than the provisional 90 days, and
    // extend-only means the runner keeps the longer window.
    const out = reanchorGrantExpiry({ grantedAt, currentExpiry: provisional, raceDate: from(NOW, 35) })
    expect(out.toISOString()).toBe(provisional.toISOString())
  })

  // Extend-only. Switching marathon -> 10K must not claw access back: "your
  // access just shrank" is a support ticket and a broken promise.
  it('does not shrink when a later race is nearer than the current expiry', () => {
    const afterMarathon = reanchorGrantExpiry({ grantedAt, currentExpiry: provisional, raceDate: from(NOW, 160) })
    const afterSwitchTo10k = reanchorGrantExpiry({
      grantedAt, currentExpiry: afterMarathon, raceDate: from(NOW, 30),
    })
    expect(afterSwitchTo10k.toISOString()).toBe(afterMarathon.toISOString())
  })

  it('a deferred race extends the grant again', () => {
    const first = reanchorGrantExpiry({ grantedAt, currentExpiry: provisional, raceDate: from(NOW, 120) })
    const deferred = reanchorGrantExpiry({ grantedAt, currentExpiry: first, raceDate: from(NOW, 300) })
    expect(deferred.getTime()).toBeGreaterThan(first.getTime())
    expect(deferred.toISOString()).toBe(from(NOW, 300 + POST_RACE_GRACE_DAYS).toISOString())
  })

  // Without a ceiling, extend-only plus a new race each season is a perpetual
  // free subscription.
  it('caps at the ceiling measured from redemption', () => {
    const out = reanchorGrantExpiry({ grantedAt, currentExpiry: provisional, raceDate: from(NOW, 900) })
    expect(out.toISOString()).toBe(from(NOW, GRANT_CEILING_DAYS).toISOString())
  })

  it('the ceiling outlasts the longest block plus a deferral', () => {
    expect(GRANT_CEILING_DAYS).toBeGreaterThan(18 * 7 * 2)
  })

  it('is idempotent — re-saving the same plan changes nothing', () => {
    const raceDate = from(NOW, 160)
    const once = reanchorGrantExpiry({ grantedAt, currentExpiry: provisional, raceDate })
    const twice = reanchorGrantExpiry({ grantedAt, currentExpiry: once, raceDate })
    expect(twice.toISOString()).toBe(once.toISOString())
  })
})

describe('isGrantActive', () => {
  it('is false for a missing expiry', () => {
    expect(isGrantActive(null, NOW)).toBe(false)
    expect(isGrantActive(undefined, NOW)).toBe(false)
  })

  it('is true before the expiry and false after', () => {
    expect(isGrantActive(from(NOW, 1), NOW)).toBe(true)
    expect(isGrantActive(from(NOW, -1), NOW)).toBe(false)
  })

  // Fail closed on the boundary: an expired grant must not linger a moment.
  it('is false exactly at the expiry instant', () => {
    expect(isGrantActive(NOW, NOW)).toBe(false)
  })
})
