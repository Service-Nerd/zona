import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRICING } from '@/lib/brand'
import { FEATURE_GATES } from '@/lib/plan/featureGates'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'

/**
 * P-09 (a) and (b) — the per-week figure and the trial timeline.
 *
 * ⚠️ THE TIMELINE IS THE RISKY HALF, and the risk is documented rather than
 * imagined: `TIER-TRIAL-CONFIDENCE-01` was a LIVE FALSE CLAIM of exactly this
 * shape. The marketing site said "Two weeks, full access" and `BRAND.signupSub`
 * said "14 days, no limits" while the trial silently did not receive
 * `confidence_score`. It was fixed at the root — `enrich` now asks
 * `isFeatureAllowed` — so the claim became TRUE rather than being softened.
 *
 * This file is what stops it becoming false again. It does not read the
 * sentence; it re-derives the fact the sentence asserts.
 */
const UPGRADE = readFileSync(join(process.cwd(), 'app/dashboard/UpgradeScreen.tsx'), 'utf8')

describe('P-09 — per-week pricing comes from config and matches the arithmetic', () => {
  it('annual per-week equals the annual price over 52 weeks', () => {
    expect(PRICING.annual.perWeekDisplay).toBe(`£${(PRICING.annual.amount / 52).toFixed(2)} / week`)
  })

  it('monthly per-week equals twelve months over 52 weeks', () => {
    expect(PRICING.monthly.perWeekDisplay).toBe(`£${(PRICING.monthly.amount * 12 / 52).toFixed(2)} / week`)
  })

  it('the component renders the constant and does NO arithmetic', () => {
    // ADR-015 / INV-CFG-001: a price derived at the render site is a second
    // source of truth for a number that has exactly one, and pricing.test.ts
    // cannot see it there.
    expect(UPGRADE).toContain('PRICING.annual.perWeekDisplay')
    expect(UPGRADE).toContain('PRICING.monthly.perWeekDisplay')
    expect(UPGRADE).not.toMatch(/amount\s*\/\s*52|\/\s*52\b/)
  })

  it('the annual per-week still beats the figure the teardown compared us to', () => {
    // The brief proposed "~80p per week", which implies £41.60/year and is not
    // our price. The real comparison is the competitor's £1.54, and we are
    // under it with NO price change — a fact to state, not a discount to
    // invent. If a price rise ever crosses this, the claim must go with it.
    expect(PRICING.annual.amount / 52).toBeLessThan(1.54)
  })
})

describe('P-09 — the trial timeline says what the system actually does', () => {
  it('claims full access ONLY while that is literally true', () => {
    // THE GUARD THAT MATTERS. If any gate is ever closed to `trial`, this
    // fails and the sentence must change with it — which is precisely what did
    // not happen when confidence_score was silently excluded.
    const gated = Array.from(new Set(Object.values(FEATURE_GATES).flat() as string[]))
    const denied = gated.filter(f => !isFeatureAllowed(f as never, 'trial'))
    const claimsFull = PRICING.trialTimeline.some(r => /full access/i.test(r.detail))
    expect(gated.length).toBeGreaterThan(10)
    if (claimsFull) {
      expect(denied, `the timeline claims full access but trial is denied: ${denied.join(', ')}`).toEqual([])
    }
  })

  it('the nudge row matches when the email is actually sent', () => {
    // `trialEmailWindow` nudges three days before expiry. A hardcoded "Day 11"
    // that stops tracking `trialDays` is a claim about a thing we do.
    const nudge = PRICING.trialTimeline.find(r => /email you/i.test(r.detail))
    expect(nudge?.day).toBe(PRICING.trialDays - 3)
  })

  it('the last row is the real end of the trial', () => {
    const last = PRICING.trialTimeline[PRICING.trialTimeline.length - 1]
    expect(last.day).toBe(PRICING.trialDays)
    expect(last.detail).toMatch(/free tier/i)
  })

  it('promises the plan is KEPT, which is what graceful downgrade does', () => {
    const last = PRICING.trialTimeline[PRICING.trialTimeline.length - 1]
    expect(last.detail).toMatch(/keep your plan/i)
  })

  it('carries no urgency, no countdown and no strike-through', () => {
    // Hard rule 2. The competitor's exit price undercuts its own headline by
    // £24, which teaches the runner the first two prices were theatre.
    for (const r of PRICING.trialTimeline) {
      expect(r.detail).not.toMatch(/hurry|act now|don.t miss|expires when|limited|only \d+ left/i)
      expect(r.detail).not.toContain('—')   // BRAND-EMDASH-01
    }
  })

  it('the copy lives in config, not in the component', () => {
    expect(UPGRADE).toContain('PRICING.trialTimeline.map')
    for (const r of PRICING.trialTimeline) expect(UPGRADE).not.toContain(r.detail)
  })
})
