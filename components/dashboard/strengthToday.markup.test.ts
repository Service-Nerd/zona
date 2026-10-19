import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Plan } from '@/types/plan'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import type { StrengthSession } from '@/packages/strength'
import { isoLocalDate, STRENGTH_AFTER_RUN_LINE, STRENGTH_HERO_ADVERB } from '@/lib/strength-bridge/display'

/**
 * 🔴 STRENGTH-APP-01 (A, B) — Today with strength, rendered from REAL engine output.
 *
 * The defect this guards is a contradiction, not a crash: a day that holds a strength
 * session must never be called a rest day ("Do nothing. It helps." / the rest card),
 * and on a run day strength appears ONCE, as a quiet row, with the after-run line said
 * once. The clock is pinned to a real rest day and a real run day of the harness plan.
 */
;(globalThis as { React?: unknown }).React = React
// TodayScreen constructs a Supabase client at render; a server render makes no call with it.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
const plan = harnessPlanJson as unknown as Plan
const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function findDay(want: 'rest' | 'run'): { date: Date; weekIndex: number } {
  for (let wi = 0; wi < plan.weeks.length; wi++) {
    const w = plan.weeks[wi]
    const start = new Date(w.date + 'T12:00:00')
    for (let k = 0; k < 7; k++) {
      const d = new Date(start); d.setDate(d.getDate() + k)
      const s = (w.sessions as Record<string, { type: string } | undefined>)[DOW[d.getDay()]]
      const isRun = !!s && ['easy', 'run', 'quality', 'race'].includes(s.type)
      if (want === 'run' ? isRun : !s || s.type === 'rest') return { date: d, weekIndex: wi }
    }
  }
  throw new Error('no such day in the harness plan')
}

function session(date: Date, after_quality_run: boolean): StrengthSession {
  return {
    date: isoLocalDate(date), day: 'mon', week_n: 1, kind: 'full_body', heavy_legs: true, after_quality_run, estimated_minutes: 40,
    // A real full body holds upper work (S10 Am.3): the title is read from the content (strengthSessionTitle).
    blocks: [
      { role: 'main', items: [{ exercise_id: 'goblet_squat', sets: 3, reps: 8, rir: 2, rest_s: 90, per_side: false }] },
      { role: 'accessory', items: [{ exercise_id: 'single_arm_dumbbell_row', sets: 2, reps: 10, rir: 2, rest_s: 60, per_side: true }] },
    ],
  }
}

async function render(day: { date: Date; weekIndex: number }, s: StrengthSession | null) {
  vi.useFakeTimers(); vi.setSystemTime(day.date)
  const { default: TodayScreen } = await import('@/components/dashboard/TodayScreen')
  return renderToStaticMarkup(React.createElement(TodayScreen as never, {
    plan, weekIndex: day.weekIndex, daysToRace: 60, raceName: 'Test', preferredMetric: 'distance',
    sessionMetricOverrides: {}, stravaRuns: [], allOverrides: [], overridesReady: true, allCompletions: {},
    preferredUnits: 'km', zone2Ceiling: 148,
    strength: s ? { sessionsByDate: { [s.date!]: s }, completions: {}, onOpen: () => {}, onSetStatus: async () => true } : null,
  } as never))
}

afterEach(() => { vi.useRealTimers() })

describe('Today on a no-run day that holds strength', () => {
  it('is not called a rest day anywhere', async () => {
    const day = findDay('rest')
    const html = await render(day, session(day.date, false))
    expect(html).not.toContain('Do nothing.')
    expect(html).not.toContain('It helps.')
    // The rest CARD, not just the rest hero: its "Next run" row is its signature.
    expect(html).not.toContain('Next run ·')
    expect(html).toContain(`${STRENGTH_HERO_ADVERB}.`)
    expect(html).toContain('Full body')
    expect(html).toContain('Mark complete')
  })
  it('🔴 control: the same day WITHOUT strength still says rest (the check can fail)', async () => {
    const day = findDay('rest')
    const rest = await render(day, null)
    expect(rest).toContain('Do nothing.')
    expect(rest).toContain('Next run ·')
  })
})

describe('Today on a run day that also holds strength', () => {
  it('keeps the run as the day and adds strength once, after-run line said once', async () => {
    const day = findDay('run')
    const html = await render(day, session(day.date, true))
    expect(html).toContain('Log this run')
    expect(html.split('Full body').length - 1).toBe(1)
    expect(html.split(STRENGTH_AFTER_RUN_LINE).length - 1).toBe(1)
    expect(html).not.toContain(`${STRENGTH_HERO_ADVERB}.`)
    expect(html).not.toContain('Mark complete')
  })
})
