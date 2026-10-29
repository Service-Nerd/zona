import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StrengthSessionScreen, { LiftLogPanel } from '@/components/dashboard/StrengthSessionScreen'
import { generateStrengthPlan, isLoadedLift, type LiftLog, type StrengthSession } from '@/packages/strength'
import { liftSuggestionsFor, logsOn } from '@/lib/strength-bridge/progressionView'
import { STRENGTH_NEW_LIFTS_LINE, liftSuggestionLine } from '@/lib/strength-bridge/display'
import { formatWeight, weightToKg } from '@/lib/format'

/**
 * 🔴 STRENGTH-PROGRESSION-01 (Design Board 2026-10-18) — what to lift, before the set, on main lifts only; the log in
 * the opened row; plain words; kg / lb by the runner's units.
 */
;(globalThis as { React?: unknown }).React = React
const plan = generateStrengthPlan({ focus: 'running', session_minutes: 60, sessions_per_week: 2, equipment: ['dumbbells', 'bench'], experience: 'regular' }, null, { standaloneStart: '2026-11-02' })
const sessions = plan.weeks.flatMap(w => w.sessions).filter(s => s.date)
const loadedMainIn = (s: StrengthSession) => s.blocks.find(b => b.role === 'main')?.items.find(i => isLoadedLift(i.exercise_id))
const session = sessions.filter(s => loadedMainIn(s) && plan.weeks.find(w => w.sessions.includes(s))!.phase === 'build')[2]
const lift = loadedMainIn(session)!
const earlier = (days: number) => new Date(Date.parse(session.date! + 'T00:00:00Z') - days * 86_400_000).toISOString().slice(0, 10)

function render(logs: LiftLog[], units: 'km' | 'mi' = 'km', canLog = true) {
  return renderToStaticMarkup(React.createElement(StrengthSessionScreen, {
    session, dayLabel: 'Today', weekN: session.week_n, status: null, canLog, onBack: () => {}, onSetStatus: async () => true,
    lifts: { suggestions: liftSuggestionsFor(plan, session, logs, {}), today: logsOn(logs, session.date), units, onLog: async () => true },
  }))
}

describe('the suggestion line, before the set', () => {
  it('new lifts say start light ONCE, under the tiles (PARTS-01); after a log a row says last time and what to try', () => {
    expect(render([])).toContain(STRENGTH_NEW_LIFTS_LINE)
    expect(render([])).not.toContain('New lift. Start light.')
    const html = render([{ date: earlier(7), exercise_id: lift.exercise_id, load_kg: 40, feel: 'easy', counts: true }])
    expect(html).toContain('Last time 40 kg, easy.')
    expect(html).toMatch(/Try 4[12](\.5)? kg/)
  })
  it('🔴 a non-main row never carries a line, even when handed a suggestion for it', () => {
    const last = { date: earlier(7), exercise_id: 'x', load_kg: 20, feel: 'right' as const, counts: true }
    const every = Object.fromEntries(session.blocks.flatMap(b => b.items).map(i => [i.exercise_id, { kind: 'step' as const, load_kg: 22.5, extra_reps: 0, last }]))
    const html = renderToStaticMarkup(React.createElement(StrengthSessionScreen, {
      session, dayLabel: 'Today', weekN: 1, status: null, canLog: true, onBack: () => {}, onSetStatus: async () => true,
      lifts: { suggestions: every, today: {}, units: 'km', onLog: async () => true } }))
    const mains = session.blocks.filter(b => b.role === 'main').flatMap(b => b.items).length
    expect((html.match(/data-lift-suggestion/g) ?? []).length).toBe(mains)
  })
  it('🔴 only main lifts carry it: the count of lines equals the session\'s loaded main lifts', () => {
    const mains = session.blocks.filter(b => b.role === 'main').flatMap(b => b.items).filter(i => isLoadedLift(i.exercise_id)).length
    const logs = session.blocks.filter(b => b.role === 'main').flatMap(b => b.items).map(i => ({ date: earlier(7), exercise_id: i.exercise_id, load_kg: 30, feel: 'right' as const, counts: true }))
    expect((render(logs).match(/data-lift-suggestion/g) ?? []).length).toBe(mains)
  })
  it('🔴 lb when the runner runs in miles', () => {
    expect(render([{ date: earlier(7), exercise_id: lift.exercise_id, load_kg: 40, feel: 'right', counts: true }], 'mi')).toContain('Last time 88 lb, about right.')
  })
  it('no lifts prop, no lines (strength off, or before Phase 4 data)', () => {
    const html = renderToStaticMarkup(React.createElement(StrengthSessionScreen, {
      session, dayLabel: 'Today', weekN: 1, status: null, canLog: true, onBack: () => {}, onSetStatus: async () => true }))
    expect(html).not.toContain('data-lift-suggestion')
  })
})

describe('the log, in the opened row', () => {
  const panel = (exerciseId: string, today?: LiftLog) => renderToStaticMarkup(React.createElement(LiftLogPanel, {
    item: { exercise_id: exerciseId, sets: 3, reps: 5, rir: 2, rest_s: 120, per_side: false },
    logging: { suggestion: undefined, today, units: 'km', onLog: async () => true },
  }))
  it('a loaded lift: a weight field in kg and three plain chips, never "RIR"', () => {
    const html = panel(lift.exercise_id)
    expect(html).toMatch(/inputmode="decimal"/i)
    expect(html).toContain('kg')
    for (const w of ['Easy', 'About right', 'Hard']) expect(html).toContain(`>${w}<`)
    expect(html).not.toMatch(/RIR|in reserve/)
  })
  it('🔴 a bodyweight lift: the feels only, no weight field', () => {
    const html = panel('glute_bridge')
    expect(html).not.toMatch(/inputmode="decimal"/i)
    expect(html).toContain('>About right<')
  })
  it('a logged lift shows the feel it chose and says Logged', () => {
    const html = panel(lift.exercise_id, { date: session.date!, exercise_id: lift.exercise_id, load_kg: 20, feel: 'hard', counts: true })
    expect(html).toContain('Logged')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Hard</)
  })
})

describe('the words and units', () => {
  it('formatWeight and its inverse', () => {
    expect(formatWeight(22.5)).toBe('22.5 kg')
    expect(formatWeight(22.4)).toBe('22.5 kg')
    expect(formatWeight(40, 'mi')).toBe('88 lb')
    expect(weightToKg(88, 'mi')).toBeCloseTo(39.92, 1)
    expect(formatWeight(null)).toBeNull()
  })
  it('every suggestion kind has a sentence, no em dash, no claim', () => {
    const last: LiftLog = { date: '2026-11-01', exercise_id: 'goblet_squat', load_kg: 20, feel: 'right', counts: true }
    const lines = [
      liftSuggestionLine({ kind: 'start', load_kg: null, extra_reps: 0, last: null }, 5, 'km'),
      liftSuggestionLine({ kind: 'step', load_kg: 22.5, extra_reps: 0, last }, 5, 'km'),
      liftSuggestionLine({ kind: 'reps', load_kg: 20, extra_reps: 1, last }, 5, 'km'),
      liftSuggestionLine({ kind: 'hold_week', load_kg: 20, extra_reps: 0, last }, 5, 'km'),
      liftSuggestionLine({ kind: 'reduce', load_kg: 18, extra_reps: 0, last: { ...last, feel: 'hard' } }, 5, 'km'),
      // S14 Am.1 — more reps this block: the lighter weight comes with the reps that explain it.
      liftSuggestionLine({ kind: 'more_reps', load_kg: 18, extra_reps: 0, last }, 10, 'km'),
    ]
    expect(lines).toEqual(['New lift. Start light.', 'Last time 20 kg, about right. Try 22.5 kg.', 'Last time 20 kg, about right. Try 20 kg for 6.',
      'Last time 20 kg, about right. Keep 20 kg this week.', 'Last time 20 kg, hard. Try 18 kg.',
      'Last time 20 kg, about right. Try 18 kg for 10.'])
    for (const l of lines) expect(l).not.toMatch(/—|prevent|injur|PR|record/)
    expect(liftSuggestionLine({ kind: 'bodyweight', load_kg: null, extra_reps: 0, last: null }, 5, 'km')).toBeNull()
  })
})
