import { describe, it, expect } from 'vitest'
import React from 'react'
import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import SessionCompleteCard from './SessionCompleteCard'
import { getSessionLabel } from '@/lib/session-types'

/**
 * 🔴 SESSION-COMPLETE-LONG-LABEL-01 — a long run is `type: 'easy'` (so §52/§9 treat it as aerobic volume), so a card
 * labelled by type called it "Easy run" under a header that said LONG. The card and the share image now label by the
 * session, through `getSessionLabel`'s `isLongRun`. Same class as PLAN-LONGRUN-COLOUR-01.
 */
;(globalThis as { React?: unknown }).React = React
const base = { date: '2026-10-21', completionCopy: { headline: 'Logged.', body: 'x' }, zonePct: null, rpe: 4, fatigueTag: null }
const long = { type: 'easy', role: 'long_run' as const, label: 'Sunday run' }

describe('the completion card names the session, not its type', () => {
  it('🔴 a long run reads as a long run', () => {
    const html = renderToStaticMarkup(React.createElement(SessionCompleteCard, { ...base, sessionType: 'easy', session: long } as never))
    expect(html).toContain(getSessionLabel(long as never))
    expect(html).not.toContain(getSessionLabel('easy'))
  })
  it('without a session it is labelled by type, exactly as before', () => {
    const html = renderToStaticMarkup(React.createElement(SessionCompleteCard, { ...base, sessionType: 'easy' } as never))
    expect(html).toContain(getSessionLabel('easy'))
  })
  it('🔴 every caller passes the session, and the share image labels by the slot', () => {
    const src = (f: string) => readFileSync(f, 'utf8')
    const calls = (s: string) => (s.match(/<SessionCompleteCard\b[\s\S]{0,40}?session=\{session\}/g) ?? []).length
    expect(calls(src('app/dashboard/DashboardClient.tsx'))).toBe(2)
    expect(calls(src('components/dashboard/SessionPopupInner.tsx'))).toBe(1)
    expect(src('app/api/og/session-complete-card/route.tsx')).toMatch(/getSessionLabel\(\(planSlot as never\) \?\? sessionType\)/)
  })
})
