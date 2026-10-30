// COACH-CODE-HYGIENE-01 (visible half) — three copy fixes the founder approved from the Coach mockups, 2026-10-30.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import ZoneRings from './ZoneRings'

describe('COACH-CODE-HYGIENE-01 copy fixes', () => {
  it('the free teaser no longer says the zone score needs Strava (ADR-011; the Strava app is inactive)', () => {
    const src = readFileSync('components/dashboard/CoachTeaser.tsx', 'utf8')
    const strings = src.split('\n').filter(l => !/^\s*(\/\/|\{\/\*|\*)/.test(l)).join('\n')
    expect(strings).not.toMatch(/Needs Strava/)
    expect(strings).toContain("Zone score and weekly coaching, from your watch&apos;s heart rate.")
  })
  it('rings, nothing connected, native: the connect line and its button', () => {
    const html = renderToStaticMarkup(React.createElement(ZoneRings, { state: 'empty', reason: 'not-linked', onConnect: () => {} }))
    expect(html).toContain('Connect Apple Health and the rings fill from your runs.')
    expect(html).not.toContain('Run with HR this week')
  })
  it('rings, nothing connected, web: the honest constraint, never an instruction with no route (P-10)', () => {
    const html = renderToStaticMarkup(React.createElement(ZoneRings, { state: 'empty', reason: 'not-linked' }))
    expect(html).toContain('Your runs come from Apple Health, on the iOS app.')
    expect(html).not.toContain('Connect Apple Health')
  })
  it('Coach passes the connect action to the rings on native only', () => {
    expect(readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')).toContain('onConnect={isNative ? onConnect : undefined}')
  })
  it("Kit's card no longer repeats the week counter the header already shows", () => {
    const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    const i = shell.indexOf('Eyebrow — single byline + week counter')
    expect(i).toBeGreaterThan(0)
    expect(shell.slice(i, i + 1400)).not.toMatch(/W\{weekNum\}\/\{totalWeeks\}/)
  })
})
