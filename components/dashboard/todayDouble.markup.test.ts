import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Plan } from '@/types/plan'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import { doubleAdvice } from '@/lib/plan/doubles'

/**
 * 🔴 SESSION-SLOTS-01 Phase 3 (Design Board, 2026-10-17) — Today on a double day.
 * The hero is the first run not yet done; the other is a compact row under its AM / PM eyebrow;
 * the spacing advice is said once, and only on a double day. Harness week 2: Mon and Wed easy,
 * Mon moved onto Wed's PM.
 */
;(globalThis as { React?: unknown }).React = React
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
const plan = harnessPlanJson as unknown as Plan
const WED = new Date(plan.weeks[1].date + 'T12:00:00'); WED.setDate(WED.getDate() + 2)
afterEach(() => { vi.useRealTimers() })

async function render(allOverrides: unknown[], allCompletions: Record<number, Record<string, unknown>> = {}) {
  vi.useFakeTimers(); vi.setSystemTime(WED)
  const { default: TodayScreen } = await import('@/components/dashboard/TodayScreen')
  return renderToStaticMarkup(React.createElement(TodayScreen as never, {
    plan, weekIndex: 1, daysToRace: 60, raceName: 'Test', preferredMetric: 'distance',
    sessionMetricOverrides: {}, stravaRuns: [], allOverrides, overridesReady: true, allCompletions,
    preferredUnits: 'km', zone2Ceiling: 148,
  } as never))
}
const DOUBLE = [{ week_n: 2, original_day: 'mon', new_day: 'wed', new_slot: 'pm' }]
// The advice contains an apostrophe-free sentence; the server render escapes nothing in it.
const count = (html: string, s: string) => html.split(s).length - 1

describe('Today on a double day', () => {
  it('shows the other run under its slot, and the advice once', async () => {
    const html = await render(DOUBLE)
    expect(count(html, doubleAdvice())).toBe(1)
    expect(html).toContain('data-slot="pm"')   // nothing done: the AM run is the hero, PM is the row
  })
  it('🔴 a finished AM run hands the hero to the PM one: the row below becomes the AM', async () => {
    const html = await render(DOUBLE, { 2: { wed: { status: 'complete' } } })
    expect(html).toContain('data-slot="am"')
    expect(html).not.toContain('data-slot="pm"')
  })
  it('🔴 control: the same move without a slot is a swap, so no row, no advice', async () => {
    const html = await render([{ week_n: 2, original_day: 'mon', new_day: 'wed' }])
    expect(count(html, doubleAdvice())).toBe(0)
    expect(html).not.toContain('data-slot=')
  })
})
