// FIRSTRUN-MARATHON-01 — the first missed session (Design Board re-sitting, 2026-10-05).
//
// 🔴 THE RULING THIS HOLDS, AND WHY IT WAS RE-RULED. The first ruling led this
// sheet with the locked line "Happens. Plan's been shifted." Measured in the
// handler, the ordering is the opposite of what that assumed:
//   1. the sheet renders — NOTHING HAS SHIFTED
//   2. the runner picks a reason
//   3. upsertCompletion(status:'skipped', skip_reason)
//   4. /api/adjust-plan fires — and ONLY for 3 of the 4 reasons. 'Too tired' is
//      ABSORBED and never adjusts at all. It is also `void authedFetch`, so the
//      sheet closes before any outcome exists.
// So the sentence is false on render for everyone and false forever on one path.
// Hard rule 7: a line describing a consequence the engine does not produce is a
// claim.
//
// ⚖️ RE-RULED: the sheet ASKS, the adjustment surfaces TELL. Both tell-surfaces
// already exist and already gate on a real adjustment — the pending banner on
// Today and "Changed this week" in Plan adjustments — so no new surface was built.
import { describe, it, expect } from 'vitest'
import { dashboardSource } from '@/lib/testing/dashboardSources'

const SRC = () => dashboardSource()

/**
 * Comment text blanked, line count preserved.
 *
 * 🔴 WITHOUT THIS THE CLAIM ARM FIRES ON ITS OWN EXPLANATION. The sheet carries a
 * comment QUOTING the forbidden sentence to record why it is absent, and the first
 * run of this file went red on it. `HOOK-RGBA-COMMENTS-01` recorded the identical
 * class — *"a colour inside a comment is prose and passes"* — and the remedy there
 * is this exact helper. **A claim inside a comment is prose too.**
 */
const blank = (m: string) => m.replace(/[^\n]/g, ' ')
const strip = (src: string) => src
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

/** The missed-session sheet's own JSX, bounded — never the whole hub. */
function sheet() {
  const src = strip(SRC())
  const at = src.indexOf('ariaLabel="Missed session"')
  expect(at, 'the missed-session sheet moved — re-anchor this gate').toBeGreaterThan(-1)
  const end = src.indexOf('</Sheet>', at)
  expect(end, 'the sheet has no closing tag — the bound is wrong').toBeGreaterThan(at)
  return src.slice(at, end)
}

describe('FIRSTRUN-MARATHON-01 — the sheet asks, it does not claim', () => {
  it('🔴 it makes NO claim that the plan has shifted', () => {
    // The whole point of the re-sitting. Nothing shifts until after the runner
    // answers, and for 'Too tired' nothing shifts ever.
    const s = sheet()
    for (const claim of [/been shifted/i, /plan.{0,12}adjusted/i, /we.{0,6}(moved|shifted)/i]) {
      expect(s, `the sheet claims a shift that has not happened: ${claim}`).not.toMatch(claim)
    }
  })

  it('the reasons stay — they are what CAUSES the adjustment', () => {
    // 📱 Wroblewski withdrew his own "no multi-option chooser" ruling here: the
    // four buttons are the chooser AND the only thing that triggers the shift.
    // Removing them would delete the event the tell-surfaces announce.
    expect(sheet(), 'the skip reasons left the sheet — the adjustment has no trigger')
      .toContain('SKIP_REASONS.map')
  })

  it('the escape stays — one way to disagree', () => {
    expect(sheet()).toContain('I actually ran it')
  })

  it('🔴 the redundant Dismiss button is gone, and stays gone', () => {
    // `Sheet` carries its own close. A second control doing the sheet's default
    // is LOG-ONE-INTENTION-01's class. Six controls -> five.
    const s = sheet()
    expect(s, 'the Dismiss button came back — Sheet already closes itself')
      .not.toMatch(/>\s*Dismiss\s*</)
  })

  it('no recap of what was lost', () => {
    // Ruled: do not list what the session was going to be at the moment someone
    // has just not done it.
    const s = sheet()
    expect(s, 'a session recap appeared on the missed-session sheet')
      .not.toMatch(/sessionKm|distance_km|derived_set|SessionSteps/)
  })
})
