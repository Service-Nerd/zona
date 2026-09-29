import { describe, it, expect } from 'vitest'
import { dashboardSource } from '@/lib/testing/dashboardSources'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

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

// 🔴 DASHBOARD-SCREEN-EXTRACT-03 — `MeScreen` and its helpers left the hub for
// `components/dashboard/`, so a single-file read here watches a file that no longer
// contains the subject. Population from the single owner, which throws on an empty set.
const SRC = () => dashboardSource()

describe('ME-DOORS-01 — navigation survives the move', () => {
  // 🔴 THE ARM FOR THE DEAD CONTROL.
  it('the zones edit opens the door, it does not scroll to an anchor behind one', () => {
    const src = SRC()
    const i = src.indexOf('onEditHr={')
    expect(i, 'onEditHr moved — re-anchor this gate').toBeGreaterThan(-1)
    const handler = src.slice(i, i + 400)
    // 🔴 THIRD DESTINATION FOR THIS ONE CONTROL, AND THE FIRST TWO BOTH FAILED THE RUNNER.
    //   1. `getElementById(HR_CARD_ANCHOR_ID).scrollIntoView()` — the target went behind a
    //      door, `getElementById` returned null, the optional chain swallowed it, and the
    //      chevron did NOTHING for a day. No error, no log.
    //   2. `setMeOpenSection('heart-rate'); setScreen('me')` — worked, but cost a two-tap
    //      return and took the runner off the table they were reading.
    //   3. `setHrSheetOpen(true)` — ZONES-HR-SHEET-01. Opens the form over the zones it
    //      changes, which is the only arrangement where cause and effect are both visible.
    // Both earlier failures stay guarded below: this arm now asserts where it GOES, which
    // is the thing none of its predecessors did.
    expect(handler, 'the edit control opens the HR sheet').toContain('setHrSheetOpen(true)')
    expect(handler, 'it must not leave the zones screen').not.toContain('setScreen')
    expect(handler, 'scrollIntoView cannot reach an element behind a door or a sheet')
      .not.toContain('scrollIntoView')
  })

  // ⚠️ AND THE ARM THAT CATCHES THE GENERAL CASE: an anchor scroll aimed at anything that
  // now lives behind a door. `getElementById` on a hidden subtree returns null and throws
  // nothing — it is the quietest failure in the browser.
  it('nothing scrolls to the HR card anchor any more', () => {
    // 🔴 THIS ARM READ ONE FILE, AND THE THING IT WATCHES MOVED OUT OF IT.
    // `HR_CARD_ANCHOR_ID` and the `id=` that uses it left for
    // `components/dashboard/HRZonesSection.tsx` in DASHBOARD-SCREEN-EXTRACT-02. A
    // single-file scan would then have found zero hits FOREVER — a vacuous green,
    // which is the quietest way a guard dies. The population is now derived from the
    // code: every file that names the anchor at all.
    const files = execSync("git ls-files 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'",
      { encoding: 'utf8' }).trim().split('\n')
      .filter(f => f && !f.includes('.test.'))
      .filter(f => readFileSync(f, 'utf8').includes('HR_CARD_ANCHOR_ID'))
    // An empty population passes every assertion below it, so prove the set is real.
    expect(files.length, 'no file names HR_CARD_ANCHOR_ID — the scan lost its subject')
      .toBeGreaterThan(0)
    const hits = files.flatMap(f =>
      readFileSync(f, 'utf8').split('\n')
        .filter(l => l.includes('HR_CARD_ANCHOR_ID') && l.includes('getElementById'))
        .map(l => `${f}: ${l.trim()}`))
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
    // 🔴 THIS ARM ASSERTED `onOpenZones?.('heart-rate')` AND WENT RED ON ZONES-HR-SHEET-01,
    // CORRECTLY. That door is gone: the HR form is now a sheet ON the zones screen, so the
    // second entry point it was written for no longer exists. The mechanism stays, because
    // `zonesReturnSection` is what makes the back arrow land where the runner came from —
    // and a one-valued origin today is not a reason to delete the only thing that would
    // catch a second entry being added without one.
    //
    // ⚠️ A ruling's REGISTER ROW and the CHECK that enforces it are two registers, and only
    // one of them is on anybody's list. This is the second.
    expect(src, 'the retired door must not be routed to').not.toContain("onOpenZones?.('heart-rate')")
    expect(src, 'the index row still opens zones with no origin').toContain('onOpenZones?.()')
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
