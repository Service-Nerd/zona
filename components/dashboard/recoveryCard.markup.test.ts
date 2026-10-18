import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Plan } from '@/types/plan'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import { generateStrengthPlan, type StrengthSession } from '@/packages/strength'
import { isoLocalDate } from '@/lib/strength-bridge/display'

/**
 * 🔴 STRENGTH-RECOVERY-01 × READINESS-SURFACE-01 item 2 (Design Board 2026-10-18) — ONE recovery card a
 * day: the reading against their normal (A), each session that changes (B run, C lift), two equal
 * answers (D on a day the run is not changing). Each arm has a control that must not show the card.
 */
;(globalThis as { React?: unknown }).React = React
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
const plan = harnessPlanJson as unknown as Plan
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
afterEach(() => { vi.useRealTimers() })

function restDay(): { date: Date; weekIndex: number } {
  for (let wi = 0; wi < plan.weeks.length; wi++) {
    const start = new Date(plan.weeks[wi].date + 'T12:00:00')
    for (let k = 0; k < 7; k++) {
      const d = new Date(start); d.setDate(d.getDate() + k)
      const s = (plan.weeks[wi].sessions as Record<string, { type: string } | undefined>)[DOW[d.getDay()]]
      if (!s || s.type === 'rest') return { date: d, weekIndex: wi }
    }
  }
  throw new Error('no rest day')
}
const lifts = generateStrengthPlan({ focus: 'running', session_minutes: 60, sessions_per_week: 2, equipment: ['dumbbells', 'bench'], experience: 'regular' }, null, { standaloneStart: '2026-11-02' }).weeks.flatMap(w => w.sessions)
const heavy = lifts.find(s => s.kind === 'full_body' && s.heavy_legs)!
const READING = { warranted: true, reason: 'strength_only', detail: { hrvToday: 38, hrvBaseline: 52, samplesUsed: 14 }, signals: { isLowHRV: true } }

async function render(opts: { reading?: unknown; answered?: 'eased' | 'declined'; done?: boolean; pending?: unknown } = {}) {
  const day = restDay()
  vi.useFakeTimers(); vi.setSystemTime(day.date)
  const iso = isoLocalDate(day.date)
  const lift: StrengthSession = { ...heavy, date: iso }
  const { default: TodayScreen } = await import('@/components/dashboard/TodayScreen')
  return renderToStaticMarkup(React.createElement(TodayScreen as never, {
    plan, weekIndex: day.weekIndex, daysToRace: 60, raceName: 'Test', preferredMetric: 'distance', sessionMetricOverrides: {},
    stravaRuns: [], allOverrides: [], overridesReady: true, allCompletions: {}, preferredUnits: 'km', zone2Ceiling: 148,
    hasPaidAccess: true, readinessData: 'reading' in opts ? opts.reading : READING, pendingAdjustment: opts.pending ?? null,
    strength: { sessionsByDate: { [iso]: lift }, completions: opts.done ? { [iso]: 'done' } : {}, onOpen: () => {}, onSetStatus: async () => true,
      recoveryEases: opts.answered ? { [iso]: opts.answered } : {}, onRecoveryAnswer: async () => true },
  } as never))
}
const card = (html: string) => html.includes('data-recovery-card')

describe('the recovery card on a strength-only day', () => {
  it('shows the reading, the lift line and "Lift as planned"', async () => {
    const html = await render()
    expect(card(html)).toBe(true)
    expect(html).toContain('HRV 38. Your normal is 52.')
    expect(html).toContain('Strength drops to')
    expect(html).toContain('Ease the session')
    expect(html).toContain('Lift as planned')
    expect(html).not.toContain('Run it anyway')
  })
  it('🔴 an answered day is never asked again (either answer)', async () => {
    expect(card(await render({ answered: 'eased' }))).toBe(false)
    expect(card(await render({ answered: 'declined' }))).toBe(false)
  })
  it('🔴 no card when recovery is fine, or the lift is already done', async () => {
    expect(card(await render({ reading: { ...READING, warranted: false, reason: 'all_clear' } }))).toBe(false)
    expect(card(await render({ reading: null }))).toBe(false)
    expect(card(await render({ done: true }))).toBe(false)
  })
})

describe('the recovery card with a run ease', () => {
  it('🔴 one card: the run line AND the lift line, one answer, "Run it anyway"', async () => {
    const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    const pending = { id: 'a1', trigger_type: 'readiness_signal', trigger_detail: { sessionDay: 'tue', isLowHRV: true },
      sessions_before: DAYS.map(d => (d === 'tue' ? { type: 'tempo' } : { type: 'rest' })), sessions_after: DAYS.map(d => (d === 'tue' ? { type: 'easy' } : { type: 'rest' })), summary: 'x' }
    const html = await render({ pending })
    expect((html.match(/data-recovery-card/g) ?? []).length).toBe(1)
    expect(html).toContain("Today&#x27;s tempo becomes an easy run.")
    expect(html).toContain('Strength drops to')
    expect(html).toContain('Run it anyway')
    expect(html).not.toContain('Lift as planned')
  })
})
