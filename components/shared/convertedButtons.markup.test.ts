// BUTTON-REGRESSION-01 (call sites) — the CONVERTED screens still render a
// working control, not just the right class name.
//
// 🔴 `buttonOwnership.test.ts` reads source text. `button.markup.test.ts` renders
// the component in isolation. Neither proves that a SCREEN whose button was
// rewritten still produces one — and 90 controls were rewritten by a script.
//
// ⚠️ SCOPE, STATED SO THE GREEN TICK IS NOT READ AS MORE THAN IT IS. This covers
// the converted components that render standalone. `DashboardClient`,
// `GeneratePlanScreen`, `UpgradeScreen` and the auth pages need Supabase, a
// plan, router context or a live session, so they are NOT covered here and
// their conversions rest on `tsc`, the ownership gate and the build. That is a
// real gap, named rather than papered over.

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import RefusalView from './RefusalView'

/**
 * 🔴 THE FIRST VERSION OF THIS FILE WAS HOLLOW IN TWO INDEPENDENT WAYS, and both
 * were found by mutation rather than by reading it back.
 *
 * 1. THE FIXTURE NEVER REACHED THE BUTTON. `showOffer = isRefusal && !!offer`,
 *    and every case passed `offer: null`, so the `showOffer` branch — which
 *    holds one of the two converted controls — never rendered. Reverting that
 *    button to a hand-rolled style left the suite green.
 * 2. THE INLINE-STYLE CHECK SKIPPED EXACTLY THE REGRESSION IT GUARDS. It looped
 *    over buttons that still carried `btn` — so a button that reverted
 *    COMPLETELY, losing the class, was excluded by the filter.
 *
 * Both arms are now exercised, and the style check reads EVERY button.
 */
const OFFER = {
  title: 'Build a base first',
  line: 'Eight weeks of easy running, then we look at the race again.',
  why: 'Your longest run is 6 km and the race is 42.',
}

const refusal = (over: Partial<React.ComponentProps<typeof RefusalView>> = {}) =>
  html(React.createElement(RefusalView, {
    isRefusal: true,
    message: 'Not yet. Eight weeks is not enough runway for a first marathon.',
    alternatives: ['A half in the same window', 'The same race next spring'],
    offer: null,
    offerFailed: false,
    onAccept: () => {},
    onAdjust: () => {},
    ...over,
  }))

const classesOf = (markup: string): string[][] =>
  Array.from(markup.matchAll(/class="([^"]*)"/g)).map(m => m[1]!.split(/\s+/).filter(Boolean))

/** Both branches of `showOffer`. A fixture that only reaches one is half a test. */
const BRANCHES: [string, Partial<React.ComponentProps<typeof RefusalView>>][] = [
  ['offer branch', { isRefusal: true, offer: OFFER }],
  ['no-offer branch', { isRefusal: true, offer: null }],
  ['fault branch', { isRefusal: false, offer: null }],
]

describe('RefusalView after the button conversion', () => {
  it('still renders real <button> elements with their labels', () => {
    const m = refusal()
    expect(m.match(/<button\b/g)?.length ?? 0).toBeGreaterThanOrEqual(1)
    expect(m).toContain('</button>')
  })

  it.each(BRANCHES)('%s: its buttons come from the shared system', (_name, props) => {
    const btnClassSets = classesOf(refusal(props)).filter(cs => cs.includes('btn'))
    expect(btnClassSets.length, 'no .btn control rendered — the conversion was lost').toBeGreaterThanOrEqual(1)
    for (const cs of btnClassSets) {
      expect(cs.some(c => /^btn--(primary|secondary|quiet|ghost|soft|destructive)$/.test(c)),
        `a .btn with no variant: ${cs.join(' ')}`).toBe(true)
      expect(cs.some(c => /^btn--(regular|compact)$/.test(c)),
        `a .btn with no size, so no 44px floor: ${cs.join(' ')}`).toBe(true)
    }
  })

  it.each(BRANCHES)('%s: 🔴 EVERY button is on the system and carries no inline visuals', (_name, props) => {
    // ⚠️ NO `btn`-ONLY FILTER. The first cut skipped any button that had lost
    // the class, which is precisely the regression — a button that reverts
    // completely was excused by the check meant to catch it.
    const m = refusal(props)
    const tags = Array.from(m.matchAll(/<button[^>]*>/g)).map(x => x[0])
    expect(tags.length, 'this branch rendered no control at all').toBeGreaterThanOrEqual(1)
    for (const tag of tags) {
      expect(/class="[^"]*\bbtn\b/.test(tag), `a button outside the shared system: ${tag}`).toBe(true)
      expect(tag, `button re-grew inline visuals: ${tag}`)
        .not.toMatch(/style="[^"]*(background|border-radius|font-size|color|padding)/)
    }
  })

  it('the refusal and the fault path both still render a control', () => {
    // REFUSAL-SCREEN-01: a 422 is a coaching decision, a 500 is us failing, and
    // conflating them was the original defect. Both must still be actionable.
    for (const isRefusal of [true, false]) {
      const m = refusal({ isRefusal })
      expect(m.match(/<button\b/g)?.length ?? 0,
        `${isRefusal ? 'refusal' : 'fault'} path lost its control`).toBeGreaterThanOrEqual(1)
    }
  })
})
