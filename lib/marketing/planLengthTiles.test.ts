import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLAN_SIGNATURES } from '@/lib/plan/planSignatures'
import { raceDistanceKey } from '@/lib/plan/generationConfig'

/**
 * P-05(a) — the plan-length range on the distance tiles.
 *
 * The tiles carried a label, a value and a paid flag, and said nothing about
 * how long the plan runs. We offer SIX distances to the competitor's four —
 * including 50K and 100K, which they cannot offer at all — and told the runner
 * nothing about any of them.
 */
const WIZ = readFileSync(join(process.cwd(), 'app/dashboard/GeneratePlanScreen.tsx'), 'utf8')
const DISTANCES = [5, 10, 21.1, 42.2, 50, 100]

describe('P-05(a) — the range is read from config, never typed', () => {
  it('reads the real wizard', () => {
    expect(WIZ).toContain('function planLengthRange')
    expect(WIZ).toContain('planLengthRange(d.value)')
  })

  it('resolves for EVERY distance the wizard offers', () => {
    // A tile that silently shows no range is the failure this would ship with:
    // `raceDistanceKey` must map all six, including the two ultras.
    const missing = DISTANCES.filter(d => !PLAN_SIGNATURES[raceDistanceKey(d)])
    expect(missing, 'a distance tile would render no range').toEqual([])
  })

  it('takes the numbers from PLAN_SIGNATURES', () => {
    expect(WIZ).toContain('PLAN_SIGNATURES[raceDistanceKey(distanceKm)]')
    expect(WIZ).toContain('sig.min_weeks')
    expect(WIZ).toContain('sig.max_weeks')
  })

  it('no week range is hardcoded in the component', () => {
    // INV-CFG-001. Prose about a rule drifts from the rule — the homepage once
    // claimed "four answers" against a ~15-question wizard and survived five
    // wizard changes.
    for (const d of DISTANCES) {
      const sig = PLAN_SIGNATURES[raceDistanceKey(d)]
      expect(WIZ, `${sig.min_weeks}-${sig.max_weeks} is typed into the wizard`)
        .not.toContain(`${sig.min_weeks}–${sig.max_weeks} week`)
    }
  })

  it('uses an EN dash in the range, never an em dash', () => {
    // BRAND-EMDASH-01 bans em dashes and explicitly keeps en dashes in ranges.
    const fn = WIZ.slice(WIZ.indexOf('function planLengthRange'), WIZ.indexOf('function planLengthRange') + 500)
    expect(fn).toContain('\\u2013')
    expect(fn).not.toContain('—')
  })

  it('reads as a RANGE, not a promise (hard rule 7)', () => {
    // The length a runner gets is runner-dependent: §97 lets a long runway
    // earn a longer plan and §44 refuses below a minimum. Before a race date
    // exists, the honest claim is what the signature PERMITS.
    const fn = WIZ.slice(WIZ.indexOf('function planLengthRange'), WIZ.indexOf('function planLengthRange') + 900)
    expect(fn).toContain('week plan')
    expect(fn).not.toMatch(/your \d|you will get|guaranteed/i)
  })

  it('collapses to a single figure if a signature ever has min === max', () => {
    // Otherwise it would read "16–16 week plan".
    expect(WIZ).toContain('sig.min_weeks === sig.max_weeks')
  })
})
