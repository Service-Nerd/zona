import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CharityCohortCard from './CharityCohortCard'

// FIRSTRUN-MOMENTS-01f — the honest version of "you are not alone".
//
// The risk on this card is not layout, it is OVERCLAIMING. The approved copy
// included "most of them have never done this either", which nothing in this
// app measures. It was cut rather than asserted, and this file is what stops it
// coming back — the same claim/computation mismatch class retracted three times
// on the day it shipped.

const html = (p: React.ComponentProps<typeof CharityCohortCard>) =>
  renderToStaticMarkup(React.createElement(CharityCohortCard, p))

const MAW = { partnerName: 'Make-A-Wish UK', cohortSize: 500 }

describe('CharityCohortCard markup', () => {
  it('states the cohort size and the partner, both checkable', () => {
    const out = html(MAW)
    expect(out).toContain('500')
    expect(out).toContain('Make-A-Wish UK')
  })

  it('the number dominates, matching the reveal family', () => {
    expect(html(MAW)).toMatch(/font-size:32px[^"]*font-weight:800/)
  })

  it('🔴 claims NOTHING about the other runners', () => {
    // Every one of these would be a statement about people we have no data on.
    const out = html(MAW).toLowerCase()
    for (const overclaim of [
      'never run', 'never done', 'first time', 'first-time', 'beginners', 'like you',
    ]) {
      expect(out, `unsupported claim about the cohort: "${overclaim}"`).not.toContain(overclaim)
    }
  })

  it('is not a counter — no progress, no "so far", no comparison', () => {
    // The SLT was explicit: a running counter is a leaderboard with extra steps.
    const out = html(MAW).toLowerCase()
    for (const counter of ['so far', 'joined', 'signed up', 'remaining', 'left', '%']) {
      expect(out, `reads as a counter: "${counter}"`).not.toContain(counter)
    }
  })

  it('never cheerleads', () => {
    const out = html(MAW).toLowerCase()
    for (const banned of ["you've got this", 'amazing', 'together we', 'crush', 'inspiring']) {
      expect(out, `cheerleading: "${banned}"`).not.toContain(banned)
    }
  })

  it('uses tokens, never a hardcoded colour', () => {
    const out = html(MAW)
    expect(out).toMatch(/var\(--moss\)/)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })

  it('carries no AIMark — this is a database fact', () => {
    expect(html(MAW).toLowerCase()).not.toContain('aimark')
  })
})
