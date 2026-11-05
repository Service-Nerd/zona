// GTM-SITE-02 — the pricing page cannot quietly stop being true.
//
// A pricing page is prose about a rule that lives somewhere else. This repo has
// already shipped that defect: the homepage claimed "four answers" against a
// ~15-question wizard and survived five wizard changes, because nothing
// connected the claim to the thing it described.
//
// So: every PAID_ONLY_ONGOING gate must either appear on the pricing page or be
// listed as a deliberate omission with a reason. Add a paid feature and forget
// the page, this fails.

import { describe, it, expect } from 'vitest'
import { FEATURE_GATES } from '@/lib/plan/featureGates'
import { FREE_FEATURES, PAID_FEATURES, OMITTED_FROM_PRICING } from './pricing'

describe('pricing page vs the gates it describes', () => {
  it('every paid gate is either sold or deliberately omitted', () => {
    const sold = new Set(PAID_FEATURES.map(f => f.gate).filter(Boolean))
    const omitted = new Set(OMITTED_FROM_PRICING.map(o => o.gate))

    const unaccounted = (FEATURE_GATES.PAID_ONLY_ONGOING as readonly string[])
      .filter(g => !sold.has(g as never) && !omitted.has(g as never))

    expect(
      unaccounted,
      `These PAID gates are not on the pricing page and not listed as omissions:\n` +
      `  ${unaccounted.join('\n  ')}\n` +
      `Add a row to PAID_FEATURES, or an argued entry to OMITTED_FROM_PRICING.`,
    ).toEqual([])
  })

  it('does not sell a gate that is not actually paid', () => {
    const paid = new Set(FEATURE_GATES.PAID_ONLY_ONGOING as readonly string[])
    const oversold = PAID_FEATURES
      .map(f => f.gate)
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .filter(g => !paid.has(g))

    expect(oversold, `Sold as paid but not in PAID_ONLY_ONGOING: ${oversold.join(', ')}`).toEqual([])
  })

  it('does not claim something is free when it is gated', () => {
    const free = new Set([
      ...FEATURE_GATES.FREE_ALWAYS as readonly string[],
      ...FEATURE_GATES.GRANTED_AT_TRIAL_RETAINED_IN_FREE as readonly string[],
    ])
    const overclaimed = FREE_FEATURES
      .map(f => f.gate)
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .filter(g => !free.has(g))

    expect(overclaimed, `Listed as free but not a free gate: ${overclaimed.join(', ')}`).toEqual([])
  })

  /**
   * 🔴 THE ARM THAT DID NOT EXIST — `PRICING-FREE-GATE-02`, Design Board 2026-11-05.
   *
   * This file had FOUR arms in the paid direction and ONE that stops us
   * OVERclaiming free. **Nothing failed when a free feature shipped and the
   * free column did not gain a row.** Falsified before it was written: deleting
   * the whole `plan_difficulty_band` row from `FREE_FEATURES` left this file and
   * `pricingRowTruth.test.ts` both GREEN.
   *
   * The asymmetry matters because of what W-05 found: **the free tier is the
   * most persuasive thing this product does and it was in small print.**
   * Sutherland: *"giving away the whole product is the most persuasive thing
   * you do, and you are whispering it."* We put a check on the whispering and
   * none on the silence.
   *
   * ⚠️ WHAT THIS DOES NOT CATCH, stated because the board's ruling turns on it.
   * This asserts every free GATE reaches the page. It cannot see a free feature
   * that is not a gate — and the product has shipped several since the narrative
   * was set: Kit's receipts on the free Coach screen, run history for free
   * runners, the zone trace on every logged surface, the phase named on Today,
   * the skipped-run make-up. **None of those is in `FEATURE_GATES`, so no
   * mechanical check can ever ask about them.** The free column is gate-complete
   * and product-stale, and only the first half is a test's business.
   */
  it('does not leave a free gate off the page', () => {
    const listed = new Set(FREE_FEATURES.map(f => f.gate).filter(Boolean))
    const omitted = new Set(OMITTED_FROM_PRICING.map(o => o.gate))
    const missing = (FEATURE_GATES.FREE_ALWAYS as readonly string[])
      .filter(g => !listed.has(g as never) && !omitted.has(g as never))

    expect(
      missing,
      `Free gates with no row on /pricing and no declared omission: ${missing.join(', ')}.\n`
      + 'A free feature that nobody is told about is the W-05 defect: the free tier '
      + 'is the most persuasive thing we do. Add a row to FREE_FEATURES, or add it '
      + 'to OMITTED_FROM_PRICING with a reason.',
    ).toEqual([])
  })

  // An omission needs a reason a human can argue with, not an empty string.
  it('every omission carries a real justification', () => {
    for (const o of OMITTED_FROM_PRICING) {
      expect(o.why.length, `${o.gate} omitted with no reason`).toBeGreaterThan(30)
    }
  })

  // Guards the guard: if the gate lists were ever empty or unreadable, every
  // assertion above would pass vacuously and the page could say anything.
  it('is actually comparing non-empty lists', () => {
    expect(FEATURE_GATES.PAID_ONLY_ONGOING.length).toBeGreaterThan(4)
    expect(PAID_FEATURES.length).toBeGreaterThan(4)
    expect(FREE_FEATURES.length).toBeGreaterThan(2)
  })

  it('quotes no price — BRAND.PRICING is the only source', () => {
    const all = [...FREE_FEATURES, ...PAID_FEATURES]
      .map(f => `${f.name} ${f.detail}`).join(' ')
    expect(all).not.toMatch(/£\s?\d/)
  })
})
