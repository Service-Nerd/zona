import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Plan } from '@/types/plan'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import type { StrengthSession } from '@/packages/strength'
import { isoLocalDate } from '@/lib/strength-bridge/display'

/**
 * 🔴 STRENGTH-APP-01 (C) — strength on the Plan week, from real engine output.
 * A no-run day with strength is a normal row with its title; a run day with strength
 * keeps ONE row (the run's) plus a quiet "Strength" mark. With no strength prop — the
 * marketing homepage still — the render is byte-identical to before.
 */
;(globalThis as { React?: unknown }).React = React
const plan = harnessPlanJson as unknown as Plan
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

afterEach(() => { vi.useRealTimers() })

async function render(strength: Record<string, StrengthSession> | null) {
  const w = plan.weeks[1]
  vi.useFakeTimers(); vi.setSystemTime(new Date(w.date + 'T12:00:00'))
  const { default: PlanCalendar } = await import('@/components/training/PlanCalendar')
  return renderToStaticMarkup(React.createElement(PlanCalendar, {
    weeks: plan.weeks, allOverrides: [], allCompletions: {}, onOverrideChange: () => {}, onSessionTap: () => {},
    strength: strength ? { sessionsByDate: strength, completions: {}, onOpen: () => {} } : null,
  } as never))
}

function daysOfWeek(wi: number) {
  const w = plan.weeks[wi]; const out: { date: Date; run: boolean }[] = []
  for (let k = 0; k < 7; k++) {
    const d = new Date(w.date + 'T12:00:00'); d.setDate(d.getDate() + k)
    const s = (w.sessions as Record<string, { type: string } | undefined>)[DOW[d.getDay()]]
    out.push({ date: d, run: !!s && s.type !== 'rest' })
  }
  return out
}
const ss = (date: Date, kind: StrengthSession['kind']): StrengthSession => ({
  date: isoLocalDate(date), day: 'mon', week_n: 2, kind, heavy_legs: false, after_quality_run: false, estimated_minutes: 40, blocks: [],
})

describe('PlanCalendar with strength', () => {
  it('a no-run day shows its strength title; a run day gets one quiet mark, no second row', async () => {
    const days = daysOfWeek(1)
    const rest = days.find(d => !d.run)!, run = days.find(d => d.run)!
    const html = await render({ [isoLocalDate(rest.date)]: ss(rest.date, 'upper_core'), [isoLocalDate(run.date)]: ss(run.date, 'full_body') })
    expect(html).toContain('Upper body')
    expect(html).not.toContain('Full body')
    expect(html.match(/>Strength</g) ?? []).toHaveLength(1)
  })
  it('🔴 no strength prop renders exactly what it rendered before (the marketing still)', async () => {
    const without = await render(null)
    expect(without).not.toContain('Upper body')
    expect(without.match(/>Strength</g) ?? []).toHaveLength(0)
    expect(await render({})).toBe(without)
  })
})
