import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RunwayRevealCard from './RunwayRevealCard'

// FIRSTRUN-MOMENTS-01a — assertions on the rendered card, not the comment above it.
// The runway note was stamped on meta and rendered NOWHERE; this surfaces it at
// the reveal, led by the number (SLT: the sentence that lands is "you are eleven
// weeks early"). The card must lead with the number and carry the ratified note.

const NOTE = 'You have 11 weeks before this plan starts, and we are not going to pretend they are training.'
const html = (weeks: number, note = NOTE) =>
  renderToStaticMarkup(React.createElement(RunwayRevealCard, { weeks, note }))

describe('RunwayRevealCard markup', () => {
  it('leads with the number, and the number is the largest thing on the card', () => {
    const out = html(11)
    expect(out).toContain('>11<')
    // The number is the bold metric (design system: bold metrics, quiet context).
    expect(out).toMatch(/font-size:32px[^>]*font-weight:800|font-weight:800[^>]*font-size:32px/)
  })

  it('renders the ratified note verbatim', () => {
    expect(html(11)).toContain(NOTE)
  })

  it('the number appears BEFORE the note (the reveal reads number-first)', () => {
    const out = html(11)
    expect(out.indexOf('>11<')).toBeLessThan(out.indexOf(NOTE))
  })

  it('agrees in number: "week early" for 1, "weeks early" for many', () => {
    expect(html(1)).toContain('week early')
    expect(html(1)).not.toContain('weeks early')
    expect(html(11)).toContain('weeks early')
  })

  it('uses tokens, never a hardcoded colour (and no AI provenance mark)', () => {
    const out = html(11)
    expect(out).toMatch(/var\(--ink\)/)
    expect(out).toMatch(/var\(--card\)/)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}/)
    // Rule-engine copy — must NOT carry an AIMark / coach byline (AI-PROVENANCE-01).
    expect(out.toLowerCase()).not.toContain('aimark')
    expect(out).not.toContain('YOUR COACH')
  })

  it('has no em dash (brand rule)', () => {
    expect(html(11)).not.toContain('—')
  })
})
