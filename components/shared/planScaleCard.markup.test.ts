import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PlanScaleCard from './PlanScaleCard'

// FIRSTRUN-MOMENTS-01d + 01e — assertions on rendered HTML, not on the comment
// above it. This repo's recurring failure is a design decision that lives in a
// comment while the markup says something else (UX-COACH-01).

const html = (props: React.ComponentProps<typeof PlanScaleCard>) =>
  renderToStaticMarkup(React.createElement(PlanScaleCard, props))

const FULL = { totalDistance: '780km', raceDistance: '42.2km', hardestRun: '3h 28', hardestMonth: 'March' }

describe('PlanScaleCard markup', () => {
  it('leads with the total, and the NUMBER dominates', () => {
    const out = html(FULL)
    expect(out).toContain('About')
    expect(out).toContain('780km')
    // ui-patterns: bold metrics, quiet context — value always dominates. The
    // first cut rendered both at one weight; RunwayRevealCard's 32px/800 is the
    // established treatment for the reveal family.
    expect(out).toMatch(/font-size:32px[^"]*font-weight:800/)
  })

  it('states the race SEPARATELY from the total — §121', () => {
    // 🔴 THIS TEST ASSERTED THE OPPOSITE UNTIL 2026-09-22, and it was right to:
    // "The race itself is 42.2km of it" only works while the race is inside the
    // total. §121 took it out (the race is the test, not the training), which
    // made that sentence false on a card nobody had reason to open.
    //
    // ⚠️ The change is a SUBTRACTION, NOT A DELETION (Sims, binding). The race
    // must still be named, so this asserts both halves: the total is training,
    // and the race is stated on its own.
    const out = html(FULL)
    expect(out).toContain('of training between now and race day')
    expect(out).toContain('42.2km on the day')
    // And it must not read as a fraction of a total it is no longer in.
    // ⚠️ BOUNDED TO THE RACE PHRASE, not a bare `not.toContain('of it')` — the
    // card's own eyebrow is "The shape of it", so the loose form fails on
    // correct markup. Fourth substring-bias miss this week; bound the region.
    expect(out).not.toContain('42.2km of it')
  })

  it('names the longest run and its month', () => {
    const out = html(FULL)
    expect(out).toContain('3h 28')
    expect(out).toContain('in March')
  })

  it('drops the month cleanly rather than rendering a half-sentence', () => {
    const out = html({ ...FULL, hardestMonth: null })
    expect(out).toContain('3h 28, once.')
    expect(out).not.toContain('in null')
    expect(out).not.toContain('undefined')
  })

  it('omits the whole longest-run line when there is no long run', () => {
    const out = html({ ...FULL, hardestRun: null, hardestMonth: null })
    expect(out).not.toContain('longest single run')
    // The reframe still stands on its own.
    expect(out).toContain('780km')
  })

  it('never cheerleads', () => {
    const out = html(FULL).toLowerCase()
    for (const banned of ['you\'ve got this', 'amazing', 'crush', 'conquer', 'smash']) {
      expect(out, `cheerleading: "${banned}"`).not.toContain(banned)
    }
  })

  it('uses design tokens, never a hardcoded colour', () => {
    const out = html(FULL)
    expect(out).toMatch(/var\(--moss\)/)
    expect(out).toMatch(/var\(--ink\)/)
    // The pre-commit hook blocks hex in components; this fails the build too.
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('carries NO AIMark — this is rule-engine arithmetic, not model output', () => {
    // AI-PROVENANCE-01: never mark hand-authored or rule-engine copy as AI.
    const out = html(FULL).toLowerCase()
    expect(out).not.toContain('aimark')
    expect(out).not.toContain('sparkle')
  })
})
