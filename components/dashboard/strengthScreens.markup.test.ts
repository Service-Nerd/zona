import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { generateStrengthPlan, withChosenDays, CATALOGUE_BY_ID } from '@/packages/strength'
import { STRENGTH_AFTER_RUN_LINE, STRENGTH_KIND_TITLE, STRENGTH_NEW_LIFTS_LINE, STRENGTH_SUPERSET_LINK, exerciseName, partDose, partHeader, partTitle } from '@/lib/strength-bridge/display'
import { sessionEffort, sessionParts, trainingParts } from '@/lib/strength-bridge/sessionParts'
import type { Day, RunContext, RunRole, StrengthSession } from '@/packages/strength'

/**
 * 🔴 STRENGTH-APP-01 (D, F) — the strength session screen and the setup screen,
 * rendered from a REAL engine plan.
 *
 * D: no zone or pace language (strength has none), no media placeholder until Phase 3,
 *    cues one tap deep (absent until the row is opened), done-or-skipped only (no RPE).
 * F: injuries are shown, never asked; the honest bodyweight note is said once; one CTA.
 */
;(globalThis as { React?: unknown }).React = React
const plan = generateStrengthPlan(
  { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'some' },
  null, { standaloneStart: '2026-11-02' },
)
const session = plan.weeks[5].sessions.find(s => s.kind !== 'mobility')!

async function screen(props: Record<string, unknown> = {}) {
  const { default: S } = await import('@/components/dashboard/StrengthSessionScreen')
  return renderToStaticMarkup(React.createElement(S, {
    session, dayLabel: 'Monday', weekN: 6, status: null, canLog: true, onBack: () => {}, onSetStatus: async () => true, ...props,
  } as never))
}

describe('StrengthSessionScreen', () => {
  it('shows the title, every exercise and its dose inside its part', async () => {
    const html = await screen()
    expect(html).toContain(STRENGTH_KIND_TITLE[session.kind])
    for (const p of sessionParts(session)) for (const it of p.items) {
      expect(html).toContain(exerciseName(it.exercise_id).replace(/'/g, '&#x27;'))
      expect(html).toContain(partDose(it, p.rounds))
    }
  })
  it('carries no zone, pace or effort-rating language, and no media placeholder', async () => {
    const html = await screen()
    expect(html).not.toMatch(/Zone \d|\/km|bpm|How did it feel|RPE/)
    expect(html).not.toMatch(/animation|video|<img/i)
  })
  it('cues are one tap deep: absent until a row is opened', async () => {
    const html = await screen()
    const firstCue = CATALOGUE_BY_ID.get(session.blocks.find(b => b.role === 'main')!.items[0].exercise_id)!.cues[0]
    expect(html).not.toContain(firstCue)
    expect(html).toContain('aria-expanded="false"')
  })
  it('logs done or skipped, and offers Undo once logged', async () => {
    const open = await screen()
    expect(open).toContain('Mark complete')
    expect(open).toContain('Skip')
    const done = await screen({ status: 'done' })
    expect(done).toContain('Undo')
    expect(done).not.toContain('Mark complete')
  })
  it('a future session cannot be logged; the after-run line shows only when stacked', async () => {
    expect(await screen({ canLog: false })).not.toContain('Mark complete')
    expect(await screen({ session: { ...session, after_quality_run: true } })).toContain(STRENGTH_AFTER_RUN_LINE)
    expect(await screen({ session: { ...session, after_quality_run: false } })).not.toContain(STRENGTH_AFTER_RUN_LINE)
  })
})

// STRENGTH-SESSION-PARTS-01 (Design Board 2026-10-28 E): a general session at 45 min holds paired main lifts, and
// accessories paired with core; a tight run week (two quality days and a long run) turns leg days into upper days.
const DAYS: Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
function runCtx(week: RunRole[], weeks: number): RunContext {
  const days = Array.from({ length: weeks }, (_, w) => week.map((role, k) => ({
    date: new Date(Date.UTC(2026, 10, 2 + w * 7 + k)).toISOString().slice(0, 10), day: DAYS[k], week_n: w + 1, role,
  }))).flat()
  return { version: 1, days, weeks: Array.from({ length: weeks }, (_, i) => ({ n: i + 1, phase: 'build' as const })), race_date: null, injury_tags: [], masters: false }
}
const general = generateStrengthPlan(
  { focus: 'general', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'regular' },
  runCtx(['rest', 'easy', 'rest', 'easy', 'rest', 'easy', 'rest'], 8),
).weeks[2].sessions.find(s => s.kind === 'full_body')!
// The founder's shape: lifting Mon + Wed beside a Tuesday quality run, so Monday's legs convert (S3 Am.2), and the
// running focus pairs accessories with core across blocks.
const founderLike = generateStrengthPlan(
  withChosenDays({ focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells', 'bench', 'bands'], experience: 'regular' }, ['mon', 'wed']),
  runCtx(['easy', 'quality', 'easy', 'easy', 'rest', 'long', 'rest'], 8),
)
const converted = founderLike.weeks[2].sessions.find(s => s.kind === 'upper_core' && s.blocks.some(b => b.items.some(i => i.light)))!
const crossBlock = founderLike.weeks.flatMap(w => w.sessions).find(s => sessionParts(s).some(p => p.kind === 'superset' && new Set(p.items.map(i => i.role)).size > 1))!
const unconverted = general
const count = (html: string, s: string) => html.split(s).length - 1

describe('StrengthSessionScreen — in parts (STRENGTH-SESSION-PARTS-01)', () => {
  it('the cases reach what they test: paired mains, a cross-block superset, a converted session', () => {
    expect(sessionParts(general).some(p => p.kind === 'superset' && p.items.every(i => i.role === 'main'))).toBe(true)
    expect(crossBlock).toBeTruthy()
    expect(converted).toBeTruthy()
    expect(founderLike.legs_day_suggestion).toMatchObject({ day: 'tue', run: 'quality' })
  })
  it('🔴 rounds and rest are said once per part, never on a row; "reps in reserve" is gone', async () => {
    const html = await screen({ session: general })
    const parts = sessionParts(general)
    const effort = sessionEffort(parts)
    for (const p of parts) { const h = partHeader(p, effort); if (h) expect(html).toContain(h) }
    expect(count(html, 'rest ')).toBe(parts.filter(p => p.rest_s > 0).length)
    expect(html).not.toMatch(/reps in reserve|each side ·/)
  })
  for (const [name, s] of [['paired main lifts', () => general], ['an accessory paired with core', () => crossBlock]] as const) {
    it(`🔴 parts are numbered in order, and a superset's rows are linked once per join: ${name}`, async () => {
      const html = await screen({ session: s() })
      const training = trainingParts(sessionParts(s()))
      training.forEach((p, i) => expect(html).toContain(partTitle(p, i + 1)))
      const joins = training.filter(p => p.kind === 'superset').reduce((n, p) => n + p.items.length - 1, 0)
      expect(joins).toBeGreaterThan(0)
      expect(count(html, 'data-superset-link')).toBe(joins)
      expect(count(html, STRENGTH_SUPERSET_LINK)).toBe(joins)
    })
  }
  for (const [name, s, mixed] of [['one effort', () => general, false], ['light legs at 3 beside mains at 2', () => converted, true]] as const) {
    it(`🔴 the effort is the tile, once; a part says its own only when it differs; a timed part says none: ${name}`, async () => {
      const html = await screen({ session: s() })
      const parts = sessionParts(s())
      const effort = sessionEffort(parts)!
      // Counted from the items, not from partHeader: a header that dropped its own effort must go red here.
      const own = parts.filter(p => p.items.some(i => i.reps != null && i.rir != null && i.rir !== effort)).length
      expect(own > 0).toBe(mixed)
      expect(count(html, 'in the tank')).toBe(1 + own)
      for (const p of parts) if (p.items.every(i => i.reps == null)) expect(partHeader(p, effort)).not.toMatch(/in the tank/)
    })
  }
  it('🔴 "new lifts" is said once under the tiles, and no row says "Start light"', async () => {
    const mains = general.blocks.find(b => b.role === 'main')!.items
    const suggestions = Object.fromEntries(mains.map(i => [i.exercise_id, { kind: 'start', load_kg: null, extra_reps: 0, last: null }]))
    const html = await screen({ session: general, lifts: { suggestions, today: {}, units: 'km' } })
    expect(count(html, STRENGTH_NEW_LIFTS_LINE)).toBe(1)
    expect(html).not.toContain('New lift. Start light.')
    expect(await screen({ session: general, lifts: { suggestions: {}, today: {}, units: 'km' } })).not.toContain(STRENGTH_NEW_LIFTS_LINE)
  })
  it('🔴 the no-legs line shows on a converted session only, with the plan\'s swap day', async () => {
    const noLegs = { beside: 'quality' as const, swap: founderLike.legs_day_suggestion }
    const on = await screen({ session: converted, noLegs })
    expect(on).toContain('No heavy legs today: your quality run is the day next to it. Lifting on Tuesday, after the run, would fit legs in.')
    expect(await screen({ session: unconverted, noLegs })).not.toContain('No heavy legs today')
    expect(await screen({ session: converted })).not.toContain('No heavy legs today')
  })
  it('🔴 the swap is named only on the day it replaces (code review 2026-10-29)', async () => {
    const noLegs = { beside: 'quality' as const, swap: founderLike.legs_day_suggestion }
    expect(converted.day).toBe(founderLike.legs_day_suggestion!.replaces)
    const other = await screen({ session: { ...converted, day: 'thu' }, noLegs })
    expect(other).toContain('No heavy legs today: your quality run is the day next to it.')
    expect(other).not.toContain('would fit legs in')
  })
  it('🔴 when only some main lifts are new, their rows say so and the session line does not', async () => {
    const mains = general.blocks.find(b => b.role === 'main')!.items
    const last = { date: '2026-11-01', exercise_id: 'x', load_kg: 20, feel: 'right' as const, counts: true }
    const suggestions = Object.fromEntries(mains.map((i, k) => [i.exercise_id, k === 0
      ? { kind: 'start', load_kg: null, extra_reps: 0, last: null }
      : { kind: 'step', load_kg: 22.5, extra_reps: 0, last }]))
    const html = await screen({ session: general, lifts: { suggestions, today: {}, units: 'km' } })
    expect(html).not.toContain(STRENGTH_NEW_LIFTS_LINE)
    expect(count(html, 'New lift. Start light.')).toBe(1)
  })
  it('a mobility session keeps Duration and Exercises, and has no effort tile', async () => {
    // Synthetic, from real items: placement only places a mobility session in rare weeks.
    const cool = { role: 'mobility' as const, items: general.blocks.find(b => b.role === 'warmup')!.items.map(i => ({ ...i, sets: 1 })) }
    const mob: StrengthSession = { ...general, kind: 'mobility', blocks: [cool] }
    const html = await screen({ session: mob })
    expect(html).toContain('Exercises')
    expect(html).not.toContain('in the tank')
  })
})

describe('StrengthSessionScreen — the weekly note (STRENGTH-NOTE-01)', () => {
  it('renders the note once, with AI provenance', async () => {
    const html = await screen({ note: 'Legs on Tuesday, after the intervals.' })
    expect(html.split('Legs on Tuesday, after the intervals.').length - 1).toBe(1)
    expect(html).toMatch(/Kit/)
  })
  it('🔴 STRENGTH-SESSION-TOP-01: the note sits at the bottom, after the last part and before the actions', async () => {
    const html = await screen({ note: 'Legs on Tuesday, after the intervals.' })
    const at = html.indexOf('data-strength-note')
    const lastPart = sessionParts(session)[sessionParts(session).length - 1]
    const lastMove = exerciseName(lastPart.items[lastPart.items.length - 1].exercise_id).replace(/'/g, '&#x27;')
    expect(at).toBeGreaterThan(html.lastIndexOf(lastMove))
    expect(at).toBeLessThan(html.indexOf('Mark complete'))
    // Nothing but the tiles' facts and the session lines sits between the tiles and the work.
    expect(html.indexOf('data-strength-note')).toBeGreaterThan(html.indexOf('Warm-up'))
  })
  it('🔴 no note renders nothing: no placeholder, no byline', async () => {
    expect(await screen({ note: null })).not.toMatch(/Kit/)
  })
})

describe('StrengthSetupScreen', () => {
  async function setup(props: Record<string, unknown> = {}) {
    const { default: S } = await import('@/components/dashboard/StrengthSetupScreen')
    return renderToStaticMarkup(React.createElement(S, { profile: null, planInjuries: [], planNotes: [], onSave: async () => null, ...props } as never))
  }
  it('asks the six questions with ONE call to action', async () => {
    const html = await setup()
    for (const q of ['What is it for?', 'Which days can you lift?', 'How long?', 'What can you use?', 'How much have you lifted?']) expect(html).toContain(q)
    expect(html.split('Build my strength plan').length - 1).toBe(1)
  })
  it('🔴 shows the run plan’s injuries and never asks for them', async () => {
    const html = await setup({ planInjuries: ['achilles'] })
    expect(html).toContain('achilles')
    expect(html).not.toMatch(/injur/i)
  })
  it('says the bodyweight ceiling once, only when there is no load kit', async () => {
    expect((await setup()).split('Heavier work needs weights').length - 1).toBe(1)
    expect(await setup({ profile: { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells'], experience: 'some' } })).not.toContain('Heavier work needs weights')
  })
})
