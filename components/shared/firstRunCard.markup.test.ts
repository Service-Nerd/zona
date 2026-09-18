import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FirstRunCard from './FirstRunCard'

// FIRSTRUN-MOMENTS-01b — assertions on the rendered card.

const html = (props = { dayLabel: 'Monday', metric: '20 min', effort: 'Easy' }) =>
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
})
