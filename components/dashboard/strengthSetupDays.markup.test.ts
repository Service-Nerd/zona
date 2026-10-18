import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { STRENGTH_SETUP as T } from '@/lib/strength-bridge/display'
import type { StrengthProfile } from '@/packages/strength'

/**
 * 🔴 PINNED-DAYS-01 (Design Board 2026-10-18) — the setup screen asks ONE positive day question.
 * "Which days can you lift?" replaces "How many a week?" + "Days you can't": the picks are the count,
 * the note says the sessions stay put, and nothing builds until at least one day is picked.
 */
;(globalThis as { React?: unknown }).React = React
const PROFILE: StrengthProfile = { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['bodyweight'], experience: 'some', available_days: ['mon', 'thu'], unavailable_days: ['tue', 'wed', 'fri', 'sat', 'sun'] }

async function setup(props: Record<string, unknown> = {}) {
  const { default: S } = await import('@/components/dashboard/StrengthSetupScreen')
  return renderToStaticMarkup(React.createElement(S, { profile: null, planInjuries: [], planNotes: [], onSave: async () => null, ...props } as never))
}
const pressed = (html: string) => Array.from(html.matchAll(/aria-pressed="true" aria-label="([A-Za-z]+)"/g)).map(m => m[1])
const cta = (html: string) => html.match(/<button[^>]*>(?:(?!<\/button>).)*Build my strength plan/)?.[0] ?? ''

describe('strength setup — which days can you lift (PINNED-DAYS-01)', () => {
  it('asks the positive question once, and neither old question', async () => {
    const html = await setup()
    expect(html.split(T.daysLabel).length - 1).toBe(2) // the label and the group's aria-label
    expect(html).not.toContain('How many a week?')
    expect(html).not.toMatch(/Days you can(’|&#x27;|')t/)
  })
  it('says the sessions stay on the chosen days', async () => {
    expect(await setup()).toContain('Your sessions stay on these days.')
  })
  it('🔴 a new runner starts with nothing picked and cannot build until they pick', async () => {
    const html = await setup()
    expect(pressed(html)).toEqual([])
    expect(cta(html)).toMatch(/disabled=""/)
  })
  it('a picked day is enough to build', async () => {
    const html = await setup({ initialDays: ['wed'] })
    expect(pressed(html)).toEqual(['Wed'])
    expect(cta(html)).not.toMatch(/disabled=""/)
  })
  it('a saved profile shows its own days as picked', async () => {
    expect(pressed(await setup({ profile: PROFILE, initialDays: ['mon', 'thu'] }))).toEqual(['Mon', 'Thu'])
  })
  it('at four days, the note says four is the most', async () => {
    expect(await setup({ initialDays: ['mon', 'tue', 'thu', 'sat'] })).toContain(T.daysMaxNote)
  })
})
