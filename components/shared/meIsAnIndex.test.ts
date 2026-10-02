import { describe, it, expect } from 'vitest'
import { dashboardSource, dashboardEntries } from '@/lib/testing/dashboardSources'
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

// 🔴 DASHBOARD-SCREEN-EXTRACT-03 — `MeScreen` and its helpers left the hub for
// `components/dashboard/`, so a single-file read here watches a file that no longer
// contains the subject. Population from the single owner, which throws on an empty set.
const SRC = () => dashboardSource()

const INDEX_ANCHOR = 'const hasPlan = !!(plan?.meta?.race_name)'

/**
 * The INDEX, not the function.
 *
 * 🔴 THE FIRST VERSION OF THIS BOUNDED THE WHOLE `MeScreen` FUNCTION, AND THAT MADE THE
 * REGISTER UNABLE TO RECORD THE ONE THING IT EXISTS TO RECORD. `activeSection`'s doors are
 * rendered BY `MeScreen` — `if (activeSection === 'preferences') return (…)` sits inside the
 * same function — so moving Display and Notifications behind a door left `toggles` at 2 and
 * `rawButtons` at 6. Measured: identical before and after a move that emptied two sections
 * off the index.
 *
 * That is this repo's most-recorded check failure, in its exact shape: **the value was right
 * and the POPULATION was wrong.** A region that contains both the index and the rooms cannot
 * tell you whether anything is still in the index.
 *
 * So the region is the index render only: everything from the last early return onward.
 */
const ME = () => {
  // 🔴 BOUNDED TO MeScreen's OWN FILE, AND IT WAS NOT (found 2026-10-01, QUIT-TAB-DEAD-01).
  //
  // This read `dashboardSource()` — every dashboard file CONCATENATED — took the index
  // anchor, then ended the region at the next bare `\nfunction [A-Z]`. **MeScreen's own
  // helpers are declared ABOVE it in its file**, so there is no bare top-level function
  // after it, and the region ran off the end of `MeScreen.tsx` and into whatever file git
  // happened to list next.
  //
  // 🔴 MEASURED: the region was **179,745 characters** and ended four files later, in
  // `TodayScreen.tsx`, at its `function AdjustmentBanner`. The boundary that used to stop
  // it was a helper inside `QuitTab.tsx`, and deleting that dead component moved it — so
  // the baselines below (3 raw buttons, 0 toggles) had been measured over an ACCIDENTAL
  // span of three and a bit files, and were only stable while a dead file stayed put.
  //
  // ⚠️ IT STILL GOES THROUGH THE OWNER, which is the point of DASHBOARD-SCREEN-EXTRACT-03:
  // the entry holding MeScreen is FOUND rather than hardcoded, so the next extraction phase
  // moves it without blinding this gate. What changed is that the region now ends where the
  // FILE ends, instead of wherever the concatenation happened to offer a full stop.
  const entry = dashboardEntries().find(e => e.src.includes('function MeScreen({'))
  expect(entry, 'MeScreen moved out of the dashboard population — re-anchor this gate')
    .toBeTruthy()
  const fn = entry!.src.slice(entry!.src.indexOf('function MeScreen({') + 20)
  const at = fn.indexOf(INDEX_ANCHOR)
  expect(at, 'the index anchor moved — re-anchor this gate').toBeGreaterThan(-1)
  return fn.slice(at)
}

/**
 * ⚠️ COMMENTS ARE NOT CONTROLS. The first count said **6** raw buttons and one of them was
 * the word `<button` inside a comment explaining the chevron fix. A register whose number
 * includes prose cannot be reconciled against the screen, and the discrepancy reads as a
 * missing control rather than as a miscount.
 */
const stripComments = (s: string) =>
  s.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

/** Everything BEFORE the anchor: the doors MeScreen renders. Used only to prove the split. */
const DOORS = () => {
  const entry = dashboardEntries().find(e => e.src.includes('function MeScreen({'))
  const fn = entry!.src.slice(entry!.src.indexOf('function MeScreen({') + 20)
  return fn.slice(0, fn.indexOf(INDEX_ANCHOR))
}

/**
 * The inline surface, measured at the sitting. Each number is "controls that should be
 * behind a door and are not yet".
 *
 * ⚠️ LOWER THESE AS BLOCKS BECOME DOORS. Never raise one.
 */
/* ✅ **BOTH NUMBERS SURVIVED THE REGION BEING FIXED, AND THAT IS WORTH STATING RATHER THAN
 *    TREATING AS A NON-EVENT** (2026-10-01). `ME()`'s region was bounded by accident for its
 *    whole life — see its note — and spanned three and a bit files. Re-measured over
 *    MeScreen's own file alone: **3 raw buttons, 0 toggles.** Identical.
 *
 * 🔴 WHICH MEANS THEY WERE RIGHT BY LUCK. The extra files the region used to swallow
 *    (`OrientationScreen`, `PendingAnalysisCard`, the head of `QuitTab`) happened to carry
 *    no raw `<button>`; the ones it reached once that boundary moved (`SupportScreen`,
 *    `TodayScreen`) carry **eight**. A register can be numerically correct and measured
 *    over the wrong thing, and nothing about it reads differently. */
const INLINE_BASELINE = {
  /** `<button>` written by hand rather than reached through a pattern.
   *  4 → 3 (FAQ-01, 2026-09-29): the Support contact row was hand-rolled and became
   *  `ActionRow` when the FAQ row was added beside it. Leaving it would have shipped
   *  two rows doing the same job looking different — `ACTION-ROW-01`'s own recorded
   *  failure, and the twin was in the block being edited. */
  /** 3 → 2 (DESTRUCTIVE-WIRING-01, Design Board 2026-10-02): the `Delete account` ROW was a
   *  raw `<button>` beside a `Sign out` that was already a `<Button variant="ghost">` — two
   *  rows in one Action List Card, doing the same job, built two ways. It is now `ghost` to
   *  match its sibling. ⚠️ It did NOT become `destructive`, which is what the board ruled:
   *  building it showed the ruling pointed at the wrong control. This row is a DOOR; the
   *  destructive variant went to the confirm button inside `DeleteAccountScreen`, which is
   *  the act. **Debt genuinely paid — one fewer hand-rolled control, not one relabelled.** */
  rawButtons: 2,
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
  toggles: 0,
}

describe('ME-PURPOSE-01 — Me is an index, and the inline surface cannot grow', () => {
  it('the region is bounded and non-trivial', () => {
    const me = ME()
    expect(me.length).toBeGreaterThan(5000)
    // ⚠️ THE SANITY ANCHOR MUST BE SOMETHING THAT STAYS. The first version anchored on
    // `HRZonesSection`, which door 2 moved — so the arm guarding the region broke on the
    // very change the register exists to record. `SectionLabel` and the identity card are
    // the index's own furniture: the one declared exception and the screen's header.
    expect(me).toContain('<SectionLabel>')
    expect(me).toContain('What Kit knows about you')
  })

  // ⚠️ ASSERT THE ANCHOR. A check that depends on an anchor and does not assert it fails
  // silently when the anchor moves — recorded 2026-09-27, four guards, one loud.
  // The anchor must sit AFTER every `activeSection` early return, or a door's markup is
  // back inside the measured region and the register stops meaning anything.
  it('the anchor sits after every door', () => {
    const doors = DOORS()
    const me = ME()
    // ⚠️ COUNT THE DOORS, DO NOT NAME ONE. This asserted
    // `activeSection === 'quit'` as its sentinel, and `SMOKE-PLUMBING-01`
    // removed that door — an UNREACHABLE one, with no setter anywhere — so a
    // structural arm went red over a correct deletion. **The claim is "the early
    // returns come before the index anchor", which does not depend on which
    // doors exist**, and coupling it to one arbitrary door's name is the same
    // brittleness as keying a baseline on an ordinal.
    const earlyReturns = (doors.match(/activeSection === '/g) ?? []).length
    expect(earlyReturns, 'the early returns are not before the anchor').toBeGreaterThanOrEqual(5)
    expect(me, 'a door leaked into the index region').not.toContain('activeSection ===')
  })

  // 🔴 AND THE ARM THAT PROVES THE SPLIT IS REAL rather than an empty region passing
  // every other arm. The controls that LEFT the index must be findable in a door.
  it('what left the index is in a door, not deleted', () => {
    // ⚠️ MATCH THE ELEMENT, NOT THE SUBSTRING. `toContain('PreferencesScreen')` passed
    // against `<PreferencesScreenXX` during falsification — the substring survives any
    // rename that EXTENDS the name, which is exactly what a bad refactor does. Third time
    // this repo has recorded the class: bound the match, never grep the name.
    expect(DOORS(), 'the Preferences door does not render the units control')
      .toMatch(/<PreferencesScreen[\s/>]/)
    expect(SRC(), 'the push rows were dropped rather than moved').toContain('PushNotificationsRow')
  })

  it('hand-rolled buttons do not grow', () => {
    const n = (stripComments(ME()).match(/<button/g) ?? []).length
    expect(n, `raw <button> on Me: ${n}, baseline ${INLINE_BASELINE.rawButtons}. ` +
      'A new inline control on the index is exactly what ME-PURPOSE-01 forbids — ' +
      'add a door (ActionRow) and a screen instead.')
      .toBeLessThanOrEqual(INLINE_BASELINE.rawButtons)
  })

  it('inline toggles do not grow', () => {
    const n = (stripComments(ME()).match(/Toggle|role="switch"/g) ?? []).length
    expect(n, `inline toggles on Me: ${n}, baseline ${INLINE_BASELINE.toggles}`)
      .toBeLessThanOrEqual(INLINE_BASELINE.toggles)
  })

  // 🔴 THE ARM THAT STOPS THE REGISTER ROTTING UPWARD.
  it('a baseline that is no longer met must be LOWERED in the same commit', () => {
    const me = ME()
    const actual = {
      rawButtons: (stripComments(me).match(/<button/g) ?? []).length,
      toggles: (stripComments(me).match(/Toggle|role="switch"/g) ?? []).length,
    }
    const stale = Object.entries(INLINE_BASELINE)
      .filter(([k, v]) => actual[k as keyof typeof actual] < v)
      .map(([k, v]) => `${k}: now ${actual[k as keyof typeof actual]}, baseline still ${v} — lower it`)
    expect(stale, 'debt was paid down and the register was not updated').toEqual([])
  })
})
