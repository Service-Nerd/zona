import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FirstRunCard from './FirstRunCard'

// FIRSTRUN-MOMENTS-01b — assertions on the rendered card.

const html = (props = { dayLabel: 'Monday', metric: '20 min', effort: 'Easy', reassure: true }) =>
  renderToStaticMarkup(React.createElement(FirstRunCard, props))

describe('FirstRunCard markup', () => {
  it('reads as one concrete line: day, duration, effort', () => {
    expect(html()).toContain('Monday. 20 min. Easy.')
  })

  it('uses tokens, never a hardcoded colour, and no AI provenance mark', () => {
    const out = html()
    expect(out).toMatch(/var\(--ink\)/)
    expect(out).toMatch(/var\(--card\)/)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    // Rule-engine data — no AIMark / coach byline (AI-PROVENANCE-01).
    expect(out.toLowerCase()).not.toContain('aimark')
    expect(out).not.toContain('YOUR COACH')
  })

  it('has no em dash (brand rule)', () => {
    expect(html()).not.toContain('—')
  })

  // FIRSTRUN-GATE-CALL-01 (SLT, 2026-09-18) — the card is ungated, the
  // reassurance is not.
  describe('the reassurance sentence', () => {
    const experienced = { dayLabel: 'Tuesday', metric: '8km', effort: 'Easy', reassure: false }

    it('🔴 is withheld from an experienced runner', () => {
      const out = html(experienced)
      expect(out).not.toContain('This is where it starts')
      expect(out, 'the card itself is NEVER gated — the cue is for everyone').toContain('Tuesday. 8km. Easy.')
    })

    it('appears for a new runner', () => {
      expect(html()).toContain('This is where it starts. It is meant to feel too easy.')
    })

    it('🔴 never asserts what the runner is capable of', () => {
      // Hutchinson's block: "Nothing here you can't do" is a capability claim,
      // and §111/§113 exist because it is false for some of the people most
      // likely to check. Reassure about SIZE, which §12 makes true by design.
      for (const props of [undefined, experienced]) {
        expect(html(props as never)).not.toMatch(/can't do|cannot do|you've got this/i)
      }
    })
  })
})
