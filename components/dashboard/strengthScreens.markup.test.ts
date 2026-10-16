import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { generateStrengthPlan, CATALOGUE_BY_ID } from '@/packages/strength'
import { STRENGTH_AFTER_RUN_LINE, STRENGTH_KIND_TITLE, doseLine, exerciseName } from '@/lib/strength-bridge/display'

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
  it('shows the title, every exercise and its dose', async () => {
    const html = await screen()
    expect(html).toContain(STRENGTH_KIND_TITLE[session.kind])
    for (const b of session.blocks) for (const it of b.items) {
      expect(html).toContain(exerciseName(it.exercise_id).replace(/'/g, '&#x27;'))
      expect(html).toContain(doseLine(it))
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

describe('StrengthSetupScreen', () => {
  async function setup(props: Record<string, unknown> = {}) {
    const { default: S } = await import('@/components/dashboard/StrengthSetupScreen')
    return renderToStaticMarkup(React.createElement(S, { profile: null, planInjuries: [], planNotes: [], onSave: async () => null, ...props } as never))
  }
  it('asks the seven questions with ONE call to action', async () => {
    const html = await setup()
    for (const q of ['What is it for?', 'How many a week?', 'How long?', 'What can you use?', 'How much have you lifted?']) expect(html).toContain(q)
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
