import { describe, it, expect, vi, afterEach } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import type { Plan } from '@/types/plan'
import harnessPlanJson from '@/components/dashboard/__fixtures__/harnessPlan.json'
import { generateStrengthPlan } from '@/packages/strength'
import {
  weekIdentity, DELOAD_WEEK_NOTE, DELOAD_WEEK_NOTE_WITH_STRENGTH, STRENGTH_DELOAD_LINE, PHASE_LABELS,
} from '@/lib/coaching/weekVoice'
import { buildDailyCoachNotePrompt, type DailyCoachNoteInput } from '@/lib/coaching/prompts/dailyCoachNote'

/**
 * 🔴 PHASE-ON-TODAY-01 (Design Board + Coaching Board, 2026-10-26). The founder set strength to an hour and saw 33
 * minutes: a deload week, named on Today only by the rest-day card. Harness: week 4 is a deload (badge), week 2 an
 * ordinary base week.
 */
;(globalThis as { React?: unknown }).React = React
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key'
const plan = harnessPlanJson as unknown as Plan
afterEach(() => { vi.useRealTimers() })

const tuesdayOf = (i: number) => { const d = new Date(plan.weeks[i].date + 'T12:00:00'); d.setDate(d.getDate() + 1); return d }
async function today(weekIndex: number, strength: unknown = null, paid = true) {
  vi.useFakeTimers(); vi.setSystemTime(tuesdayOf(weekIndex))
  const { default: TodayScreen } = await import('@/components/dashboard/TodayScreen')
  return renderToStaticMarkup(React.createElement(TodayScreen as never, {
    plan, weekIndex, daysToRace: 60, raceName: 'Test', preferredMetric: 'distance',
    sessionMetricOverrides: {}, stravaRuns: [], allOverrides: [], overridesReady: true, allCompletions: {},
    preferredUnits: 'km', zone2Ceiling: 148, strength, hasPaidAccess: paid, coachNoteSettled: true,
  } as never))
}
const esc = (s: string) => s.replace(/'/g, '&#x27;')

describe('weekIdentity — what kind of week this is, one owner', () => {
  it('a badge outranks the phase: race, then deload, then taper, then the phase name', () => {
    expect(weekIdentity({ badge: 'race', phase: 'taper' }).kind).toBe('race')
    expect(weekIdentity({ badge: 'deload', phase: 'build' })).toEqual({ label: 'Deload', kind: 'deload' })
    expect(weekIdentity({ phase: 'taper' }).kind).toBe('taper')
    expect(weekIdentity({ phase: 'build' })).toEqual({ label: 'Build', kind: 'phase' })
    expect(weekIdentity(null).kind).toBe('none')
  })
  it('🔴 every phase the engine emits has a name (the local map knew four)', () => {
    for (const p of ['base_build', 'walk_run_start', 'foundation', 'maintenance_restoration', 'maintenance_base']) {
      expect(weekIdentity({ phase: p }).label).toBe(PHASE_LABELS[p])
    }
  })
  it('🔴 Today has no phase map of its own', () => {
    const src = readFileSync('components/dashboard/TodayScreen.tsx', 'utf8')
    expect(src).not.toMatch(/\{\s*base:\s*'Base',\s*build:\s*'Build'/)
    expect(src).toContain('weekIdentity(currentWeek')
  })
})

describe('Today names the week, and marks a deload', () => {
  it('🔴 a deload week: named in the context row, the recovery-hue mark, and the week line', async () => {
    const html = await today(3)
    expect(html).toContain('data-week-identity="deload"')
    expect(html).toContain('Deload · Week 4')
    expect(html).toMatch(/data-week-mark="deload"[^>]*background:var\(--s-recov\)/)
    expect(html).toContain(esc(DELOAD_WEEK_NOTE))
    expect(html, 'no strength that week, so no claim about sets').not.toContain('fewer sets')
  })
  it('🔴 an ordinary week: the phase name, no mark, no hue', async () => {
    const html = await today(1)
    expect(html).toContain('data-week-identity="phase"')
    expect(html).toContain('Base · Week 2')
    expect(html).not.toContain('data-week-mark')
    expect(html).not.toContain(esc(DELOAD_WEEK_NOTE))
  })
  it('free: the name and the mark still show (the coach card is paid/trial by an existing gate)', async () => {
    const html = await today(3, null, false)
    expect(html).toContain('Deload · Week 4')
    expect(html).toContain('data-week-mark="deload"')
  })
  it('🔴 a deload week with strength in it says "fewer sets" too', async () => {
    const d = plan.weeks[3].date
    const strength = { sessionsByDate: { [d]: { date: d, kind: 'full_body', blocks: [], estimated_minutes: 30, week_n: 1 } }, completions: {}, onOpen: () => {}, onSetStatus: async () => true }
    const html = await today(3, strength)
    expect(html).toContain(esc(DELOAD_WEEK_NOTE_WITH_STRENGTH))
  })
})

describe('the strength session says why a deload session is short', () => {
  const sp = generateStrengthPlan({ focus: 'general', session_minutes: 60, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'regular' }, null, { standaloneStart: '2026-11-02' })
  const session = sp.weeks[1].sessions.find(s => s.kind !== 'mobility')!
  async function screen(deloadWeek: boolean) {
    const { default: S } = await import('@/components/dashboard/StrengthSessionScreen')
    return renderToStaticMarkup(React.createElement(S, { session, dayLabel: 'Monday', weekN: 2, status: null, canLog: true, onBack: () => {}, onSetStatus: async () => true, deloadWeek } as never))
  }
  it('🔴 in a deload week, the line', async () => expect(await screen(true)).toContain(STRENGTH_DELOAD_LINE))
  it('in any other week, nothing', async () => expect(await screen(false)).not.toContain('data-strength-deload'))
  it('🔴 the dashboard passes it from the strength plan\'s own week phase', () => {
    const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
    expect(src).toContain("deloadWeek={strength.plan?.weeks.find(w => w.n === activeStrength.week_n)?.phase === 'deload'}")
  })
})

describe('the AI daily note is told it is a deload week', () => {
  const base = { todayDayName: 'Tuesday', todaySessionType: 'easy', todaySessionLabel: 'Easy', todayZoneLabel: null, todayDistanceKm: 6,
    lastSession: null, weekPhase: 'build', weekN: 8, totalWeeks: 16, weeksToRace: 8, raceName: 'X', raceDistanceKm: 21.1,
    heavyFatigueTrend: false, consecutiveNailed: 0, firstName: 'R' } as unknown as DailyCoachNoteInput
  it('🔴 deload → the fact is in the prompt; otherwise it is not', () => {
    expect(buildDailyCoachNotePrompt({ ...base, deloadWeek: true })).toContain('planned deload week')
    expect(buildDailyCoachNotePrompt(base)).not.toContain('planned deload week')
  })
  it('🔴 the route sets it from the week badge', () => {
    expect(readFileSync('app/api/daily-coach-note/route.ts', 'utf8')).toContain("deloadWeek: (week as any).badge === 'deload',")
  })
})
