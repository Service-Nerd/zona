import { describe, it, expect } from 'vitest'
import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import SessionSteps from './SessionSteps'
import type { DerivedSet } from '@/lib/plan/resolveMainSet'

/**
 * 🔴 SESSION-INTERVALS-HUE-01 (Design Board 2026-10-22, 6t-f, step 1). ONE owner of a session's hue: the main set takes
 * `getSessionColor(session)`, the answer the rail, Plan, Today, the silhouette and the trace give. It used to paint by
 * peak zone, so VO2 and hill main sets drew in `--s-inter` = `#B84545`, the `--danger` value.
 */
;(globalThis as { React?: unknown }).React = React
const vo2: DerivedSet = { version: 2, blocks: [{ repeat: 5, steps: [
  { role: 'work', modality: 'run', length: '3 min', pace: '4:10 /km', zone: 'Z5', advance: 'auto' },
  { role: 'recovery', modality: 'jog', length: '2 min', pace: '7:00 /km', advance: 'auto' }] }] }
const st = { warmup: { duration_mins: 15, zone: 'Z1' }, main: { duration_mins: 25, zone: 'Z5' }, cooldown: { duration_mins: 10, zone: 'Z1' }, total_duration_mins: 50, shape: 'quality_intervals' }
const render = (silhouetteColour?: string) => renderToStaticMarkup(React.createElement(SessionSteps, {
  structure: st as never, derivedSet: vo2, sessionType: 'quality', displayZones: [5], zoneRangeLabel: 'Zone 5',
  metric: 'duration', preferredUnits: 'km', sessionDistanceKm: null, easyPaceStr: null, silhouetteColour,
}))

describe('the session detail takes the session hue', () => {
  it('🔴 a VO2 main set draws in the hue it is given, not the error red', () => {
    const html = render('var(--session-quality)')
    expect(html).toContain('var(--session-quality)')
    expect(html).not.toContain('var(--s-inter)')
  })
  it('without a hue it falls back to the zone accent, as before', () => {
    expect(render()).toContain('var(--s-inter)')
  })
  it('🔴 the session detail passes getSessionColor(session) as the hue', () => {
    const src = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')
    const at = src.indexOf('<SessionSteps')
    expect(at).toBeGreaterThan(0)
    expect(src.slice(at, src.indexOf('/>', at))).toMatch(/silhouetteColour=\{getSessionColor\(session\)\}/)
  })
})
