import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SessionCompleteCard from './SessionCompleteCard'
import { buildRunTrace } from '@/lib/coaching/zoneTrace'

/**
 * 🔴 SESSION-SCREENS-WOW-01 (Design Board 2026-10-21, location amended) — the Zone Trace REPLACES the card's ZoneBar
 * when the run has a rich trace, and the card is exactly as before when it does not. The card is what the runner sees
 * straight after answering how it felt, on both logged paths, and what the share image renders.
 */
;(globalThis as { React?: unknown }).React = React
const t0 = Date.UTC(2026, 9, 21, 7, 0, 0)
const samples = (min: number, bpm: (s: number) => number) =>
  Array.from({ length: (min * 60) / 5 }, (_, i) => ({ valueBpm: bpm(i * 5), timestamp: new Date(t0 + i * 5000).toISOString() }))
const easy = { type: 'easy', zone: 'Zone 2', label: 'Easy run' }
const base = { sessionType: 'easy', date: '2026-10-21', completionCopy: { headline: 'Logged.', body: 'Easy days build the engine.' }, rpe: 3, fatigueTag: null }
const render = (p: Record<string, unknown>) => renderToStaticMarkup(React.createElement(SessionCompleteCard, { ...base, zonePct: null, ...p } as never))

describe('SessionCompleteCard with a trace', () => {
  const held = buildRunTrace(samples(50, () => 132), easy, 51, 185, null)!
  const late = buildRunTrace(samples(60, s => (s < 40 * 60 ? 135 : 156)), easy, 51, 185, null)!

  it('🔴 the trace replaces the zone bar, with its sentence', () => {
    const html = render({ zonePct: 96, trace: held })
    expect(html).toContain('data-zone-trace')
    expect(html).toContain('You held the zone.')
    expect(html).not.toMatch(/aria-label="Zone \d/)
  })
  it('🔴 a free run (no analysis) still reaches it, with the trace\'s own %', () => {
    const html = render({ trace: late })
    expect(html).toContain('Time in zone')
    expect(html).toContain('You held it for 40 min, then it got away from you.')
  })
  it('must not lose: without a trace the card is exactly as before (zone bar in A, RPE in B)', () => {
    const a = render({ zonePct: 80 })
    expect(a).not.toContain('data-zone-trace')
    expect(a).toMatch(/aria-label="[^"]*[Zz]one/)
    const b = render({})
    expect(b).toContain('Effort')
    expect(b).toContain('/ 10')
    expect(b).not.toContain('data-zone-trace')
  })
  it('a short or missing trace never draws (the zone bar keeps the job)', () => {
    expect(buildRunTrace(samples(4, () => 132), easy, 51, 185, null)).toBeNull()
    expect(buildRunTrace(samples(50, () => 132), { type: 'easy' }, 51, 185, null)).toBeNull()
    expect(buildRunTrace(samples(50, () => 132), easy, 51, null, null)).toBeNull()
  })
  it('the colour is the session\'s token, never a literal', () => {
    expect(held.colour).toMatch(/^var\(--/)
    expect(render({ trace: held })).not.toMatch(/stroke="#|fill="#/)
  })
})
