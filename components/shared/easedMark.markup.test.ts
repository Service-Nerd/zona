import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Plan } from '@/types/plan'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import SessionCard from '@/components/shared/SessionCard'
import { EASED_FOR_RECOVERY_LABEL } from '@/lib/ui/easedMark'

/**
 * 🔴 READINESS-SURFACE-01 item 3 — "Eased for recovery" on the session card, the Plan row, Today and
 * the session screen (Design Board, 2026-10-17). Each arm has a control: the same render without
 * the stamp shows no mark, so a mark that always rendered (or never did) fails.
 */
;(globalThis as { React?: unknown }).React = React
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
const base = harnessPlanJson as unknown as Plan
/** Week 2's Monday easy run, eased (as a confirmed readiness ease writes it). */
function plan(eased: boolean): Plan {
  return { ...base, weeks: base.weeks.map((w, i) => i !== 1 ? w : {
    ...w, sessions: { ...w.sessions, mon: { ...w.sessions.mon!, ...(eased ? { eased_for: 'recovery' as const } : {}) } } }) }
}
const MON = new Date(base.weeks[1].date + 'T12:00:00')
const marks = (html: string) => (html.match(/data-eased="recovery"/g) ?? []).length
afterEach(() => { vi.useRealTimers() })

describe('the mark', () => {
  it('SessionCard shows it when eased, and not otherwise', () => {
    const card = (eased: boolean) => renderToStaticMarkup(React.createElement(SessionCard, { type: 'easy', name: 'Easy run', eased }))
    expect(marks(card(true))).toBe(1)
    expect(card(true)).toContain(EASED_FOR_RECOVERY_LABEL)
    expect(marks(card(false))).toBe(0)
  })
  it('the Plan row carries it on the eased session only', async () => {
    vi.useFakeTimers(); vi.setSystemTime(MON)
    const { default: PlanCalendar } = await import('@/components/training/PlanCalendar')
    const go = (p: Plan) => renderToStaticMarkup(React.createElement(PlanCalendar, {
      weeks: p.weeks, allOverrides: [], allCompletions: {}, onOverrideChange: () => {}, onSessionTap: () => {} } as never))
    expect(marks(go(plan(true)))).toBe(1)
    expect(marks(go(plan(false)))).toBe(0)
  })
  it('Today\'s card carries it on an eased day', async () => {
    vi.useFakeTimers(); vi.setSystemTime(MON)
    const { default: TodayScreen } = await import('@/components/dashboard/TodayScreen')
    const go = (p: Plan) => renderToStaticMarkup(React.createElement(TodayScreen as never, {
      plan: p, weekIndex: 1, daysToRace: 60, raceName: 'Test', preferredMetric: 'distance', sessionMetricOverrides: {},
      stravaRuns: [], allOverrides: [], overridesReady: true, allCompletions: {}, preferredUnits: 'km', zone2Ceiling: 148,
    } as never))
    expect(marks(go(plan(true)))).toBe(1)
    expect(marks(go(plan(false)))).toBe(0)
  })
  it('the session screen carries it, done or not', async () => {
    const { default: SessionPopupInner } = await import('@/components/dashboard/SessionPopupInner')
    const go = (eased_for?: 'recovery', completion?: unknown) => renderToStaticMarkup(React.createElement(SessionPopupInner as never, {
      session: { key: 'mon', day: 'Mon', date: '24 Aug', type: 'easy', title: 'Easy run', label: 'Easy run', detail: '',
        rawDate: MON.toISOString(), distance_km: 8, eased_for, completion, isPast: !!completion },
      weekN: 2, aiNotes: false, preloadedRuns: [], onClose: () => {}, preferredUnits: 'km',
    } as never))
    expect(marks(go('recovery'))).toBe(1)
    expect(marks(go('recovery', { status: 'complete' }))).toBe(1)
    expect(marks(go())).toBe(0)
  })
})
