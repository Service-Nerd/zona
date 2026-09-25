// ICON-BUTTON-01 — `IconButton` is RENDERED, per BUTTON-REGRESSION-01's rule
// that a class-name grep is not a regression test.

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import IconButton from './IconButton'
import BackButton from '../shared/BackButton'

const render = (props: Partial<React.ComponentProps<typeof IconButton>> = {}) =>
  html(React.createElement(IconButton, {
    icon: React.createElement('span', { 'aria-hidden': true }, '✕'),
    ariaLabel: 'Close',
    ...props,
  }))
const classes = (m: string) => (m.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)

describe('IconButton renders', () => {
  it('🔴 always carries its accessible name — the whole reason it exists', () => {
    expect(render()).toContain('aria-label="Close"')
  })

  it('defaults to type=button so it cannot submit a form by accident', () => {
    expect(render()).toContain('type="button"')
  })

  it.each([['circle'], ['square'], ['bare']] as const)('shape %s emits exactly one shape class', (shape) => {
    const cs = classes(render({ shape }))
    expect(cs).toContain(`icon-btn--${shape}`)
    expect(cs.filter(c => /^icon-btn--(circle|square|bare)$/.test(c))).toEqual([`icon-btn--${shape}`])
  })

  it('🔴 takes the 44px floor unless it is the inline-mark exception', () => {
    expect(classes(render())).toContain('icon-btn--regular')
    const inline = classes(render({ inlineMark: true }))
    expect(inline).toContain('icon-btn--inline-mark')
    expect(inline, 'an inline mark must not also claim the 44px box').not.toContain('icon-btn--regular')
  })

  it('carries no inline visual styling of its own', () => {
    expect(render()).not.toMatch(/style="[^"]*(background|border-radius)/)
  })

  it('🔴 BackButton still draws the documented arrow THROUGH this primitive', () => {
    // The refactor's actual risk: BackButton is the app's one back arrow and
    // its contract is unchanged. A wrapper that stopped producing a 44px
    // circle with a name would be a silent regression on every screen.
    const m = html(React.createElement(BackButton, { onClick: () => {} }))
    expect(m).toContain('aria-label="Back"')
    expect(classes(m)).toEqual(expect.arrayContaining(['icon-btn', 'icon-btn--circle', 'icon-btn--regular']))
    expect(m, 'the chevron path changed').toContain('M13 4L7 10L13 16')
  })

  it('BackButton keeps its overridable label', () => {
    expect(html(React.createElement(BackButton, { onClick: () => {}, ariaLabel: 'Back to plan' })))
      .toContain('aria-label="Back to plan"')
  })
})
