import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AttributionRow from './AttributionRow'
import { ATTRIBUTION_SOURCES } from '@/lib/analytics'

// OPS-ATTRIB-01 — the Design Board's conditions, asserted against RENDERED MARKUP
// rather than trusted to a comment.
//
// ⚠️ THIS IS THE POINT OF THE FILE. This repo's recurring failure is a design
// decision that lives in a comment while the markup says something else — the zone
// rings were "declared paired with Kit's read" and shipped with both card borders
// intact. A comment cannot be asserted on; rendered HTML can.
//
// Every assertion below is a ruling from the 2026-09-28 sitting, not a preference.

const render = () => renderToStaticMarkup(
  React.createElement(AttributionRow, {
    supabase: {} as never,
    userId: 'u1',
    onResolved: () => {},
  }),
)

describe('AttributionRow — Silvanto: visually inert', () => {
  // The condition in his own words: Moss "would give it a weight it hasn't got".
  it('takes no Moss accent anywhere', () => {
    expect(render()).not.toMatch(/--moss/)
  })

  it('uses the muted and secondary ink tokens, never a raw colour', () => {
    const html = render()
    expect(html).toMatch(/var\(--mute\)/)
    expect(html).toMatch(/var\(--ink-2\)/)
    // ADR-007: nothing hardcoded. A six-digit hex in this markup is a regression.
    expect(html).not.toMatch(/#[0-9a-fA-F]{6}/)
  })

  it('carries no icon or glyph', () => {
    const html = render()
    expect(html).not.toMatch(/<svg/)
    // ICON-RULE-01 — a row icon must earn its place by meaning or by location on a
    // list of >= 8 rows. This is one row.
    expect(html).not.toMatch(/<img/)
  })
})

describe('AttributionRow — Wroblewski: one tap, zero typing', () => {
  it('offers every source as a button and nothing as a text field', () => {
    const html = render()
    for (const s of ATTRIBUTION_SOURCES) expect(html).toContain(s.label)
    // The condition: a free-text field is a keyboard outdoors.
    expect(html).not.toMatch(/<input/)
    expect(html).not.toMatch(/<textarea/)
  })

  it('gives a dismissal that is one tap and not hidden', () => {
    expect(render()).toContain('Skip')
  })

  it('meets the 44px minimum tap target on every control', () => {
    const html = render()
    const controls = html.match(/<button/g) ?? []
    // seven sources plus Skip
    expect(controls.length).toBe(ATTRIBUTION_SOURCES.length + 1)
    const targets = html.match(/min-height:44px/g) ?? []
    expect(targets.length).toBe(controls.length)
  })
})

describe('AttributionRow — Sierra: the copy is honest about who it serves', () => {
  it('says what it is for, and does not invent a benefit for the runner', () => {
    const html = render()
    expect(html).toContain('where to put our effort')
    // It must not pretend this improves their training.
    expect(html.toLowerCase()).not.toMatch(/personalis|improve your|better plan|tailor/)
  })

  it('carries no em dash — runner-facing copy', () => {
    // BRAND-EMDASH-APP-01: sentences the runner reads carry no em dash.
    expect(render()).not.toContain('—')
  })
})

describe('AttributionRow — it is not a progress surface', () => {
  // design-rulings.md:208 — an aggregating number is forbidden. The cheapest way
  // to stay on the right side of that is to display no number at all.
  it('displays no number', () => {
    const text = render().replace(/<[^>]+>/g, ' ')
    expect(text).not.toMatch(/\d/)
  })
})
