import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// ME-PURPOSE-01 (Design Board, 2026-09-28) — Me is an INDEX. Nothing lives on it.
//
// 🔴 THE RULE BINDS NOW; THE MOVES ARE STAGED, AND THIS FILE IS WHAT MAKES THAT REAL.
// The board restated Me's job from *"your identity and configuration"* — which refuses
// nothing — to *"find the thing you want to change, and go there."* Every row is a door.
//
// Moving eight blocks in one change would be a rewrite of the busiest file in the repo.
// Sierra's sequencing, taken over Collins' preference to move everything at once: **land
// the rule first so nothing NEW is added inline**, then stage the moves. That only works
// if the current inline surface is measured and cannot grow — which is this baseline.
//
// ⚠️ IT IS A DEBT REGISTER, NOT A SWEEP. Same pattern as `SWEEP-BASELINE-01`, the liveness
// baseline and `buttonInlineOverride`: it makes the debt visible and stops it growing. It
// does not make it shrink, and nothing here schedules that. As of this commit the numbers
// below are the measurement taken at the sitting.
//
// 🔴 AND THE ARM THAT MATTERS IS THE ONE THAT FAILS ON A *DECREASE*. A baseline that only
// catches growth rots upward invisibly: someone converts a block to a door, the number
// stays, and the register silently permits re-adding one. This repo has recorded that
// exact failure in `buttonInlineOverride`.

const ME = () => {
  const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  const start = src.indexOf('function MeScreen({')
  expect(start, 'MeScreen moved — re-anchor this gate').toBeGreaterThan(-1)
  // Bound the region: MeScreen only, not the 12,000-line file. Ends at the next
  // top-level function declaration.
  const after = src.slice(start + 20)
  const end = after.search(/\nfunction [A-Z]/)
  expect(end, 'could not bound MeScreen').toBeGreaterThan(-1)
  return after.slice(0, end)
}

/**
 * The inline surface, measured at the sitting. Each number is "controls that should be
 * behind a door and are not yet".
 *
 * ⚠️ LOWER THESE AS BLOCKS BECOME DOORS. Never raise one.
 */
const INLINE_BASELINE = {
  /** `<button>` written by hand rather than reached through a pattern. */
  rawButtons: 6,
  /** Toggles and switches sitting directly on the index.
   *  🔴 THE SITTING WAS TOLD **5** AND THE REAL FIGURE IS **2**. My evidence used
   *  `grep -cE 'Toggle|Switch|role="switch"'` — a LINE count with a wider pattern, which
   *  caught `Switch` inside unrelated identifiers. This gate counts OCCURRENCES of the
   *  narrow pattern. Both are "right" for their own definition and only one of them is
   *  the thing being governed. The ruling does not rest on it (the diagnosis was 8 blocks
   *  and ZERO ActionRows), but the number reached a board and was wrong.
   *
   *  ⚠️ It was caught by the stale-baseline arm on this file's FIRST RUN — the arm
   *  written to stop the register rotting upward, catching the register being wrong on
   *  the way in. */
  toggles: 2,
}

describe('ME-PURPOSE-01 — Me is an index, and the inline surface cannot grow', () => {
  it('the region is bounded and non-trivial', () => {
    const me = ME()
    expect(me.length).toBeGreaterThan(5000)
    expect(me).toContain('HRZonesSection')
  })

  it('hand-rolled buttons do not grow', () => {
    const n = (ME().match(/<button/g) ?? []).length
    expect(n, `raw <button> on Me: ${n}, baseline ${INLINE_BASELINE.rawButtons}. ` +
      'A new inline control on the index is exactly what ME-PURPOSE-01 forbids — ' +
      'add a door (ActionRow) and a screen instead.')
      .toBeLessThanOrEqual(INLINE_BASELINE.rawButtons)
  })

  it('inline toggles do not grow', () => {
    const n = (ME().match(/Toggle|role="switch"/g) ?? []).length
    expect(n, `inline toggles on Me: ${n}, baseline ${INLINE_BASELINE.toggles}`)
      .toBeLessThanOrEqual(INLINE_BASELINE.toggles)
  })

  // 🔴 THE ARM THAT STOPS THE REGISTER ROTTING UPWARD.
  it('a baseline that is no longer met must be LOWERED in the same commit', () => {
    const me = ME()
    const actual = {
      rawButtons: (me.match(/<button/g) ?? []).length,
      toggles: (me.match(/Toggle|role="switch"/g) ?? []).length,
    }
    const stale = Object.entries(INLINE_BASELINE)
      .filter(([k, v]) => actual[k as keyof typeof actual] < v)
      .map(([k, v]) => `${k}: now ${actual[k as keyof typeof actual]}, baseline still ${v} — lower it`)
    expect(stale, 'debt was paid down and the register was not updated').toEqual([])
  })
})
