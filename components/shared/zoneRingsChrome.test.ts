import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ZoneRings, { ZoneRingsSkeleton } from './ZoneRings'

// UX-COACH-01 — `chromeless` exists so Kit's read and the rings render as ONE
// card (word and image, one eyeful) rather than two stacked bordered boxes.
//
// This asserts on RENDERED MARKUP, not on a prop. The first attempt at that
// change moved the rings under the read, declared the pairing in a comment,
// and left both borders in place; the founder read them as two cards because
// they WERE two cards. A comment cannot be asserted on. A border can.
//
// It also pins the DEFAULT: the marketing homepage renders ZoneRings bare and
// must keep its own chrome.
//
// No JSX on purpose — createElement keeps this inside the existing `.test.ts`
// include and transform, so no config or dependency moves for one test.

const PCT = { z1: 10, z2: 62, z3: 9, z45: 19 }

const CASES: { name: string; render: (chromeless?: boolean) => string }[] = [
  { name: 'live',     render: (c) => renderToStaticMarkup(createElement(ZoneRings, { pctByZone: PCT, chromeless: c })) },
  { name: 'empty',    render: (c) => renderToStaticMarkup(createElement(ZoneRings, { state: 'empty', reason: 'no-data', chromeless: c })) },
  { name: 'pending',  render: (c) => renderToStaticMarkup(createElement(ZoneRings, { state: 'pending', chromeless: c })) },
  { name: 'locked',   render: (c) => renderToStaticMarkup(createElement(ZoneRings, { state: 'locked', chromeless: c })) },
  { name: 'skeleton', render: (c) => renderToStaticMarkup(createElement(ZoneRingsSkeleton, { chromeless: c })) },
]

/** The component's own outermost element — the only one that may carry chrome. */
function outerTag(html: string): string {
  return html.slice(0, html.indexOf('>') + 1)
}

describe('ZoneRings chrome', () => {
  it.each(CASES)('$name keeps its card shell by DEFAULT', ({ render }) => {
    const tag = outerTag(render(undefined))
    expect(tag).toContain('border:1px solid var(--line)')
    expect(tag).toContain('border-radius:var(--radius-lg)')
    expect(tag).toContain('padding:20px')
  })

  it.each(CASES)('$name drops border, radius and padding when chromeless', ({ render }) => {
    // The parent card owns all three. The rings must contribute none of them.
    const tag = outerTag(render(true))
    expect(tag).not.toContain('border')
    expect(tag).not.toContain('padding')
    expect(tag).not.toContain('var(--radius-lg)')
  })

  it.each(CASES)('$name still draws the rings when chromeless', ({ render }) => {
    // Falsification guard: a component that rendered nothing at all would
    // satisfy the assertion above.
    expect(render(true)).toContain('<svg')
  })
})
