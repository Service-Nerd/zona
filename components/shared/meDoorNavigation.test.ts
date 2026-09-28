import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ME-DOORS-01 — 🔴 A DOOR CHANGES WHERE "BACK" MEANS, AND NOTHING WAS WATCHING.
//
// Found by asking "what did this break downstream?", not by a failing test. Three real
// breaks, all silent, all from moving a block that itself was never edited:
//
//   1. 🔴 DEAD CONTROL. The Training Zones provenance row (`ZONES-INPUTS-01`, shipped the
//      day before) did `setScreen('me')` then `getElementById(HR_CARD_ANCHOR_ID)
//      .scrollIntoView(...)`. The HR card is now behind the `heart-rate` door, so
//      `getElementById` returned NULL and the chevron did NOTHING. Its own markup test
//      asserts the chevron RENDERS; no test could assert it GOES anywhere.
//   2. Back from `reshape` returned to the Me INDEX, though its only entry is the
//      `plan-adjustments` door — the runner loses their place.
//   3. The zones screen gained a SECOND entry point (the door, beside the index row) and a
//      single hardcoded back is correct for one and wrong for the other.
//
// ⚠️ NONE OF THIS CODE WAS TOUCHED BY THE MOVE. A relocation makes correct code wrong at a
// distance, which is why "the suite is green" says nothing about it.

const SRC = () => readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')

describe('ME-DOORS-01 — navigation survives the move', () => {
  // 🔴 THE ARM FOR THE DEAD CONTROL.
  it('the zones edit opens the door, it does not scroll to an anchor behind one', () => {
    const src = SRC()
    const i = src.indexOf('onEditHr={')
    expect(i, 'onEditHr moved — re-anchor this gate').toBeGreaterThan(-1)
    const handler = src.slice(i, i + 400)
    expect(handler, 'it opens the heart-rate door').toContain("setMeOpenSection('heart-rate')")
    expect(handler, 'scrollIntoView cannot reach an element behind a door')
      .not.toContain('scrollIntoView')
  })

  // ⚠️ AND THE ARM THAT CATCHES THE GENERAL CASE: an anchor scroll aimed at anything that
  // now lives behind a door. `getElementById` on a hidden subtree returns null and throws
  // nothing — it is the quietest failure in the browser.
  it('nothing scrolls to the HR card anchor any more', () => {
    const src = SRC()
    const hits = src.split('\n').filter(l => l.includes('HR_CARD_ANCHOR_ID') && l.includes('getElementById'))
    expect(hits, 'an anchor scroll targets an element behind a door:\n' + hits.join('\n')).toEqual([])
  })

  it('back from reshape returns to the door it was opened from', () => {
    const src = SRC()
    const i = src.indexOf("{screen === 'reshape'")
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 300)).toContain("setMeOpenSection('plan-adjustments')")
  })

  // ⚠️ TWO ENTRY POINTS, TWO CORRECT ANSWERS. Modelled on `redeemReturnTo`, which already
  // existed in this file for exactly this problem — reuse, not a second mechanism.
  it('the zones screen remembers which entry it was opened from', () => {
    const src = SRC()
    expect(src, 'the return-to state is missing').toContain('zonesReturnSection')
    const i = src.indexOf('onOpenZones={(returnTo')
    expect(i, 'the open handler does not take an origin').toBeGreaterThan(-1)
    expect(src.slice(i, i + 200)).toContain('setZonesReturnSection')
    // the HR door supplies its origin; the index row supplies none and lands on the index
    expect(src).toContain("onOpenZones?.('heart-rate')")
  })

  // 🔴 THE HOOK MUST SIT ABOVE EVERY EARLY RETURN. MeScreen returns early for each door, so
  // a hook below one is conditional — React error 310, which this repo has already shipped.
  it('the openSection effect is above the first early return', () => {
    const src = SRC()
    const fn = src.indexOf('function MeScreen({')
    const effect = src.indexOf('if (!openSection) return', fn)
    const firstReturn = src.indexOf('if (activeSection ===', fn)
    expect(effect, 'the openSection effect is missing').toBeGreaterThan(-1)
    expect(firstReturn).toBeGreaterThan(-1)
    expect(effect, 'the effect sits below an early return — conditional hook')
      .toBeLessThan(firstReturn)
  })
})
