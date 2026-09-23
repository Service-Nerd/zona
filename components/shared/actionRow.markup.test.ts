// ACTION-ROW-01 — an action row is legible AS a control.
//
// 🔴 The founder, on the Plan screen: *"that is an action tile. It's not clear
// you can click on it. We have them under Me profile so we should have a
// standard pattern for these."*
//
// **Measured cause, and it is structural rather than an oversight: the chevron
// was a local `const` inside the Me screen's component.** Seven rows there used
// it; the Plan screen could not reach it, so its tile shipped with NO affordance
// — on a screen where every session row beside it carries one.
//
// ⚠️ A PATTERN THAT IS A LOCAL VARIABLE CANNOT TRAVEL. The shape was agreed and
// rendering correctly in one place, and nothing was available to reuse, so the
// second surface re-implemented it and lost the part that says "control".

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import ActionRow from './ActionRow'

const row = (props: Partial<React.ComponentProps<typeof ActionRow>> = {}) =>
  html(React.createElement(ActionRow, { title: 'Adjust your plan', onClick: () => {}, ...props }))

describe('ActionRow markup', () => {
  it('🔴 always carries the chevron — the thing that says it is a control', () => {
    // The defect, exactly: a row that renders without this reads as a panel.
    expect(row()).toContain('<svg')
    expect(row()).toContain('M6 3L11 8L6 13')
  })

  it('is a real button, not a tappable div', () => {
    expect(row().startsWith('<button')).toBe(true)
  })

  it('clears the 44px tap target', () => {
    expect(row()).toMatch(/min-height:44px/)
  })

  it('renders the subtitle when given one, and omits the node when not', () => {
    expect(row({ subtitle: 'Without starting again.' })).toContain('Without starting again.')
    // Empty state: no stray element, no reserved blank line.
    expect(row()).not.toMatch(/--mute.*line-height:1\.5/)
  })

  it('the divider is opt-in — stacked rows get it, a standalone card does not', () => {
    expect(row({ divider: true })).toMatch(/border-bottom:1px solid var\(--line\)/)
    expect(row()).toMatch(/border-bottom:none/)
  })

  it('uses tokens, never a hand-typed gap', () => {
    // APP-SPACE-01 — the chevron's gutter is on the ruled scale.
    expect(row()).toMatch(/margin-left:var\(--space-3\)/)
  })
})
