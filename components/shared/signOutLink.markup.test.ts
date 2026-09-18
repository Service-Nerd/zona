import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SignOutLink from './SignOutLink'

// ONBOARD-EXIT-01 — assertions on rendered HTML, not on the comment above it.
// This repo's recurring failure is a design decision that lives in a comment
// while the markup says something else (UX-COACH-01). The two fixes the
// fixture page found — a visible disabled state, and separation from the skip
// link it sits under — are both style, which is exactly the kind of thing that
// gets silently reverted by the next person tidying the file.

const html = (el: React.ReactElement) => renderToStaticMarkup(el)

describe('SignOutLink markup', () => {
  it('says who it is for, in the product voice', () => {
    // "Not you?" is the whole point: this is an identity escape, not a
    // settings action. Wood's constraint at the SLT review.
    expect(html(React.createElement(SignOutLink))).toContain('Not you? Sign out')
  })

  it('meets the 44px iOS HIG tap target', () => {
    // The hand-rolled ConnectRuns original was 40.
    expect(html(React.createElement(SignOutLink))).toMatch(/min-height:44px/)
  })

  it('is actually disabled — not merely styled as such', () => {
    const out = html(React.createElement(SignOutLink, { disabled: true }))
    // The `disabled` attribute is what stops the click at the browser level.
    // Opacity alone would look right and still fire underneath an in-flight
    // permission prompt.
    expect(out).toMatch(/\bdisabled\b/)
  })

  it('LOOKS unavailable when disabled', () => {
    // Found on /onboarding-preview: the first cut changed only the CSS cursor,
    // so a link that could not be pressed was pixel-identical to one that
    // could. No test could have seen that; this one can see it come back.
    const on  = html(React.createElement(SignOutLink))
    const off = html(React.createElement(SignOutLink, { disabled: true }))
    expect(off).toMatch(/opacity:0\.4/)
    expect(on).not.toMatch(/opacity:0\.4/)
  })

  it('keeps its distance from the skip link above it', () => {
    // Also found on the fixture page: on Connect Runs this sits directly under
    // that screen's own "Not now →", and at 375px the two read as a pair —
    // one skips a step, one ends the session. Space, not a divider (banned).
    expect(html(React.createElement(SignOutLink))).toMatch(/margin-top:8px/)
  })

  it('uses tokens, never a hardcoded colour', () => {
    const out = html(React.createElement(SignOutLink))
    expect(out).toMatch(/var\(--mute\)/)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
