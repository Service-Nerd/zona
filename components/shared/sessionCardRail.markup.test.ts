import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SessionCard, { SESSION_CARD_RAIL_PX } from './SessionCard'
import { getSessionColor } from '@/lib/session-types'

/**
 * 🔴 SESSION-TODAY-CARD-01 (Design Board 2026-10-22, Silvanto's amended W4) — the type rail is 6 px, from one constant,
 * on every SessionCard: the app's Today card and the website homepage's cards alike.
 */
;(globalThis as { React?: unknown }).React = React
describe('SessionCard rail', () => {
  it('is the named constant, 6 px', () => {
    expect(SESSION_CARD_RAIL_PX).toBe(6)
    const html = renderToStaticMarkup(React.createElement(SessionCard, { type: 'easy', name: 'Easy run', distanceKm: 8, units: 'km', metric: 'distance' } as never))
    expect(html).toMatch(new RegExp(`width:${SESSION_CARD_RAIL_PX}px`))
    expect(html).not.toMatch(/width:3px/)
  })
  it('the session colour is the rail, never a card fill', () => {
    const html = renderToStaticMarkup(React.createElement(SessionCard, { type: 'easy', name: 'Easy run', distanceKm: 8, units: 'km', metric: 'distance' } as never))
    const token = getSessionColor({ type: 'easy', label: 'Easy run' } as never)
    expect(token).toMatch(/^var\(--/)
    expect(html.split(token).length - 1, 'the session colour appears once: the rail').toBe(1)
  })
})
