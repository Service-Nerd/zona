// ZONE-RINGS-HEADING-01 — the Coach rings' tap wrapper stacks its children (founder screenshot 2026-10-31:
// "THIS WEEK IN ZONESACROSS 1 RUN"). Measured in a browser at 375px: label 37–156 / meta 256–338 with the
// column; 87–206 / 206–288 (touching) without it. This file holds the cause, and that Coach uses the owner.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import RingsTapArea from './RingsTapArea'
import ZoneRings from './ZoneRings'

describe('RingsTapArea', () => {
  const rings = React.createElement(ZoneRings, { chromeless: true, pctByZone: { z1: 4, z2: 6, z3: 52, z45: 38 }, meta: 'across 1 run' })
  const html = renderToStaticMarkup(React.createElement(RingsTapArea, { onOpen: () => {}, children: rings }))

  it('🔴 stacks its children in a column that fills the width (`.btn` is an inline-flex row)', () => {
    const btn = html.match(/<button[^>]*>/)![0]
    expect(btn).toMatch(/flex-direction:column/)
    expect(btn).toMatch(/align-items:stretch/)
    expect(btn).toMatch(/width:100%/)
  })

  it('keeps an accessible name', () => {
    expect(html).toMatch(/aria-label="What counts as in-zone\. Opens an explanation\."/)
  })

  it('Coach and the preview harness both render the owner, not a hand-rolled button', () => {
    const coach = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(coach).toContain('<RingsTapArea onOpen=')
    expect(coach).not.toMatch(/aria-label="What counts as in-zone\. Opens an explanation\."/)
    expect(readFileSync('app/coach-preview/page.tsx', 'utf8')).toContain('<RingsTapArea')
  })
})
