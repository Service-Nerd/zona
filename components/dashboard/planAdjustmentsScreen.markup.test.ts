import { describe, it, expect } from 'vitest'
import { watchedSignals, WATCHED_SIGNAL_COUNT } from '@/lib/coaching/watchedSignals'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import PlanAdjustmentsScreen from './PlanAdjustmentsScreen'
import { PLAN_ADJUSTMENTS_TITLE } from '@/components/shared/meDoors'

// ME-ADJUSTMENTS-EXTRACT-01 (2026-10-02) — the door the item was filed to make testable.
//
// 🔴 THE ITEM'S STATED REASON FOR EXISTING HAD ALREADY EXPIRED. It read: *"`Preferences` has
// a markup test because it is a component under `components/`; this door has none, because
// vitest does not collect `app/`."* True while `MeScreen` lived in `DashboardClient.tsx`;
// `DASHBOARD-SCREEN-EXTRACT-03` moved `MeScreen` under `components/`, so the door became
// testable **in place** and the item kept naming an impossibility. It was extracted anyway,
// because every other substantial door off Me is a component and this was the last outlier —
// the pattern is the argument, and this file is a by-product.

const screen = (p: Partial<React.ComponentProps<typeof PlanAdjustmentsScreen>> = {}) =>
  html(React.createElement(PlanAdjustmentsScreen, {
    dynamicAdjustmentsEnabled: true,
    onDynamicAdjustmentsChange: () => {},
    lastCheckedLabel: null,
    preferredUnits: 'km',
    ...p,
  }))

describe('ME-ADJUSTMENTS-EXTRACT-01 — the Plan adjustments door renders', () => {
  // 🔴 THIS ARM IS REAL, BUT NOT FOR THE REASON I FIRST WROTE DOWN — AND THE CORRECTION IS
  // THE MORE USEFUL RECORD.
  //
  // The dismissal `Set` is lazily initialised from `localStorage`. My first extraction dropped
  // the original's `if (typeof window === 'undefined') return new Set()`; I restored it and
  // claimed this arm held it shut. **Then I ran the mutation and it stayed green.** `window` is
  // undefined here (`environment: 'node'`, no jsdom) and reaching it DOES throw, but the
  // `try/catch` inside the initialiser absorbs the `ReferenceError` and returns an empty Set.
  // The guard is defence-in-depth; the `try/catch` is what carries server render.
  //
  // ✅ WHAT THIS ARM ACTUALLY CATCHES, measured: an **unprotected browser-global read** in the
  // initialiser. Moving the `localStorage` call outside the try turns **8 of these 9 arms
  // red**. That is a live class — any future `window`/`localStorage` read added outside a guard
  // breaks the whole screen's server render — so the arm stays, described correctly.
  //
  // ⚠️ THE LESSON IS MINE, NOT THE CODE'S: I asserted a falsification outcome before running
  // it. A mutation you predict is not a mutation you performed, and this file's own history is
  // full of green ticks with nothing behind them.
  it('🔴 server-renders with no `window`, and no unguarded browser global', () => {
    expect(() => screen()).not.toThrow()
    expect(screen()).toContain('Auto-adjust')
  })

  // The three honest states PROFILE-ADJ-01 defines. Each is a different sentence and the
  // engine's visibility is the whole point of the screen, so a wrong one is a silent lie
  // about whether anything ran.
  it('never checked → says so, and names the control that would run it', () => {
    expect(screen({ lastCheckedLabel: null })).toContain('Not yet. Tap Check now to run.')
  })

  it('checked and tweaked → "Plan tweaked", not tappable', () => {
    const m = screen({ lastCheckedLabel: 'yesterday', lastAdjustmentCheckFoundChange: true })
    expect(m).toContain('Plan tweaked')
    expect(m).not.toContain('No changes needed')
  })

  it('checked and found nothing → "No changes needed"', () => {
    const m = screen({ lastCheckedLabel: 'yesterday', lastAdjustmentCheckFoundChange: false })
    expect(m).toContain('No changes needed')
    expect(m).not.toContain('Plan tweaked')
  })

  // ⚠️ `hasPendingAdjustment` REPLACES the Last checked block with a tappable row — the two
  // are mutually exclusive by design, and rendering both would offer two different answers
  // to "did anything happen?".
  it('a pending change replaces the status line with a tappable row', () => {
    const m = screen({ hasPendingAdjustment: true, lastCheckedLabel: 'yesterday' })
    expect(m).toContain('1 change pending')
    expect(m).toContain('Tap to review and accept.')
    expect(m).not.toContain('Last checked')
  })

  // 🔴 ASK 5 OF THE RELOCATION CHECKS, AS A TEST RATHER THAN AS CARE. Two of ME-DOORS-01's
  // three doors said their own name TWICE, because a card header that "parallels the row
  // above" becomes a second title once the card becomes the screen. This component is
  // deliberately headerless — `ScreenHeader` stays at the call site in `MeScreen`, as it does
  // for `PreferencesScreen` — and this holds that shut from the inside.
  it('🔴 carries no title of its own', () => {
    expect(screen()).not.toContain(PLAN_ADJUSTMENTS_TITLE)
  })

  // ⚠️ EMPTY MEANS CALM, NOT BROKEN (UI Principles). A heading with nothing under it is the
  // shape that reads as a bug, so the audit surface must be absent rather than empty.
  it('the "Changed this week" surface is absent with no changes, present with one', () => {
    expect(screen({ recentChanges: [] })).not.toContain('Changed this week')
    const m = screen({ recentChanges: [{ id: 'a1', week_n: 3, summary: 'Eased Tuesday', sessions_before: [], sessions_after: [], created_at: '2026-10-01' }] })
    expect(m).toContain('Changed this week')
  })

  // The disclosure is shut on arrival: its body is a long taxonomy and opening by default
  // would bury the two controls the screen exists for.
  // 🧭 REVERSED BY RESHAPE-MOMENT-01 (Design Board, 2026-10-08), and the old assertion is
  // kept in the comment because it was RIGHT until the ruling. It read:
  //
  //     expect(m).toContain('aria-expanded="false"')          // collapsed on arrival
  //     expect(m).not.toContain('Recovery signals before hard sessions')
  //
  // That encoded "the eight signals start hidden". The board ruled the opposite: ✋ Silvanto,
  // **density not disclosure** (twice on his record), because the eight were flattened into
  // one truncated 12px sentence and the runner did the sorting. 📱 Wroblewski: un-collapsing
  // REMOVES a tap. 💼 It is not merchandising, so the SLT's settings-merchandising kill does
  // not reach it.
  //
  // ⚠️ THE ARM IS REPLACED, NOT DELETED. A guard that encoded a reversed decision still has
  // a job: assert the NEW decision, so the next change has to argue with something.
  it('the eight watched signals are ON the screen, not behind a disclosure', () => {
    const m = screen()
    expect(m).toContain('What we watch for')
    // No toggle, so no expanded state to be in.
    expect(m).not.toContain('aria-expanded')
    // The replaced run-on paragraph must not come back.
    expect(m).not.toContain('Recovery signals before hard sessions')
    // And the real thing renders: every signal, from the owner.
    for (const sig of watchedSignals()) {
      expect(m, `${sig.type} is missing from the rendered screen`).toContain(sig.label)
    }
  })

  it('…and all eight are present, counted from the engine', () => {
    // 🔴 The count is DERIVED. If a new detector ships, this fails until the runner is told
    // about it — which is the whole mechanism the old SYNC-RULE comment could not provide.
    const m = screen()
    const shown = watchedSignals().filter(s => m.includes(s.label))
    expect(shown).toHaveLength(WATCHED_SIGNAL_COUNT)
  })

  // ⚠️ THE DISMISSAL MECHANISM MOVED WHOLESALE AND MUST NOT COME BACK IN TWO PLACES. All
  // three uses were inside this door; a copy left behind in `MeScreen` is the duplicate-owner
  // shape D-08 forbids, and both would read correctly on their own.
  //
  // 🔴 AND THIS ARM FIRED ON ITS OWN PROSE THE FIRST TIME IT RAN. `MeScreen` keeps a comment
  // *naming* the three identifiers to say where they went, and a whole-file `toContain` read
  // that as the code still being there. **That is the exact class `HOOK-RGBA-COMMENTS-01`
  // fixed in the pre-commit hook the day before** — a colour inside a comment is prose — and
  // the repo's own record says a guard that fires on correct work gets switched off. Comments
  // are stripped before the check, line structure preserved.
  it('MeScreen no longer owns the dismissal state', () => {
    const code = readFileSync('components/dashboard/MeScreen.tsx', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))
    for (const id of ['dismissedChanges', 'dismissChange', 'visibleChanges', 'zonna_dismissed_changes']) {
      expect(code, `${id} is still live code in MeScreen — it moved to PlanAdjustmentsScreen`)
        .not.toContain(id)
    }
    // ⚠️ AND IT MUST STILL BE REACHING REAL CODE. An over-eager stripper that blanked the
    // whole file would pass every assertion above, which is the empty-population failure.
    expect(code, 'the comment stripper blanked the file — this arm is now vacuous')
      .toContain('export default function MeScreen')
  })
})
