// ACT-PAYWALL-01 — the annual option leads. Design Board 2026-11-12, SHIP.
//
// ⚠️ SOURCE-SHAPED AND DECLARED. `UpgradeScreen` is a client component that calls RevenueCat and
// Supabase on mount, and `vitest.config.ts` is `environment: 'node'`, so it cannot be rendered
// here. What a source arm can still prove is the only thing that changed: **which option comes
// first in the DOM.** That is the whole ruling — the two cards are otherwise identical.
//
// 🔴 AND IT IS WORTH A GATE PRECISELY BECAUSE IT LOOKS LIKE NOTHING. A reorder of two sibling
// JSX blocks is invisible in a diff summary, carries no new string and no new token, and the next
// person to touch this row has no way to know the order was a decision rather than an accident.
// This repo's recorded failure is the opposite shape — a ruled number nobody deleted — and the
// remedy is the same either way: put the decision where a build can read it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { PRICING } from '@/lib/brand'

const SRC = readFileSync('app/dashboard/UpgradeScreen.tsx', 'utf8')

/** The pricing row only: from its comment to the legal disclosure that follows it.
 *  ⚠️ Bounded by its own syntax, never grepped file-wide — `handleSubscribe` is also called by
 *  the primary CTA further down, and a file-wide index would read that instead. */
function pricingRow(): string {
  const from = SRC.indexOf('{/* Pricing — metric pair pattern')
  const to   = SRC.indexOf('Legal disclosure', from)
  expect(from, 'the pricing row comment is gone — unverified is not a pass').toBeGreaterThan(-1)
  expect(to).toBeGreaterThan(from)
  return SRC.slice(from, to)
}

describe('ACT-PAYWALL-01 — annual leads', () => {
  it('there is a pricing row with exactly two options', () => {
    expect((pricingRow().match(/<button/g) ?? []).length).toBe(2)
  })

  it('🔴 the ANNUAL option comes first in the DOM, so it is read first', () => {
    const row = pricingRow()
    const annual  = row.indexOf('handleSubscribe(true)')
    const monthly = row.indexOf('handleSubscribe(false)')
    expect(annual, 'no annual option in the pricing row').toBeGreaterThan(-1)
    expect(monthly, 'no monthly option in the pricing row').toBeGreaterThan(-1)
    expect(annual,
      'monthly is first again. Design Board 2026-11-12 ruled annual leads: the left card is read ' +
      'first and the badge should confirm the choice, not carry the hierarchy on its own.')
      .toBeLessThan(monthly)
  })

  it('and the saving badge stays on the annual card', () => {
    // The ruling kept the badge. Removing it while reordering would be a second change dressed
    // up as the first.
    const row = pricingRow()
    const annual = row.indexOf('handleSubscribe(true)')
    const monthly = row.indexOf('handleSubscribe(false)')
    const badge = row.indexOf('PRICING.annual.savingLabel')
    expect(badge).toBeGreaterThan(annual)
    expect(badge).toBeLessThan(monthly)
  })

  it('every price string still comes from BRAND.PRICING, not the render site', () => {
    // ADR-015 / INV-CFG-001. A reorder is exactly when a hand-typed number gets introduced.
    const row = pricingRow()
    for (const token of ['PRICING.annual.display', 'PRICING.annual.perMonthDisplay',
                         'PRICING.annual.perWeekDisplay', 'PRICING.monthly.display',
                         'PRICING.monthly.perWeekDisplay']) {
      expect(row, `${token} should be read from the owner`).toContain(token)
    }
    // No literal currency amount typed into the row.
    //
    // ⚠️ COMMENTS STRIPPED FIRST, AND THIS ARM CAUGHT ITSELF ON ITS FIRST RUN. Matching the whole
    // slice went red on FOUR prices, all of them in prose: two in the ruling comment above the
    // row, and two in P-09's own note explaining why the per-week figure exists. That is
    // `HOOK-RGBA-COMMENTS-01` with a price in place of a colour — *"a colour inside a comment is
    // prose and passes"*. A check that fires on the RECORD of a decision rather than on the
    // decision is a check that gets switched off, which this repo has recorded four times.
    const code = row
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ')
    const literals = code.match(/£\s?\d/g) ?? []
    expect(literals, 'a price was typed into the component').toEqual([])
  })

  it('🔑 and the monthly equivalent the ruling asks for is on the annual card, from the owner', () => {
    // *"Lead with the annual price shown alongside its monthly equivalent."* The equivalent was
    // already there; this asserts the reorder did not lose it.
    expect(PRICING.annual.perMonthDisplay).toBeTruthy()
    expect(pricingRow()).toContain('per year · ')
  })
})
