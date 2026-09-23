import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

// The component reads `useRouter` (ONBOARD-EXIT-01: sign-out must be a ROUTE
// CHANGE, never `window.location`, or Capacitor iOS hands it to Safari).
// There is no app-router context under `renderToStaticMarkup`, and this file
// is about MARKUP — the navigation itself is asserted in lib/auth/signOut.test.ts.
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: () => {} }) }))

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
    // ⚠️ ASSERTS THE GAP, NOT ITS SPELLING (APP-SPACE-01, 2026-09-23). This read
    // `/margin-top:8px/` and went red when the app was swept onto the ruled
    // spacing scale — **the distance did not change**, `--space-2` IS 8px. A
    // test pinned to a literal fails on a change that preserves exactly the
    // thing it guards, which is the third time today a spelling stood in for a
    // guarantee. Either form satisfies the rule this test carries.
    expect(html(React.createElement(SignOutLink))).toMatch(/margin-top:(8px|var\(--space-2\))/)
  })

  it('uses tokens, never a hardcoded colour', () => {
    const out = html(React.createElement(SignOutLink))
    expect(out).toMatch(/var\(--mute\)/)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
