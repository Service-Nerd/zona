import { describe, it, expect } from 'vitest'
import { buildPlanWeeklyNotePrompt, type PlanWeeklyNotePromptInput } from './planWeeklyNote'

/**
 * ADR-020 / CB-2 — a foundation week must not be described to the model (and
 * therefore to the runner) as "Week -2".
 *
 * §57 numbers foundation weeks n <= 0 because they sit BEFORE Week 1. The
 * prompt rendered the raw number, and the route rejected n < 1 outright — so a
 * paid runner in a foundation block saw a failed card for up to three weeks
 * while the route carried an unreachable `phase === 'foundation'` branch.
 */

const base: PlanWeeklyNotePromptInput = {
  weekN: 3,
  phase: 'base',
  weeksToRace: 10,
  raceName: 'Hyde Park 5k',
  raceDistance: '5K',
  sessions: [
    { day: 'Mon', type: 'easy', distanceKm: 5 },
    { day: 'Sun', type: 'long', distanceKm: 10 },
  ],
  isRestHeavyWeek: false,
}

const promptFor = (over: Partial<PlanWeeklyNotePromptInput>) =>
  buildPlanWeeklyNotePrompt({ ...base, ...over })

describe('planWeeklyNote prompt — foundation weeks', () => {
  it('never emits a negative week number', () => {
    for (const weekN of [-1, -2, -3]) {
      expect(promptFor({ weekN, phase: 'foundation' })).not.toContain(`Week ${weekN}`)
    }
  })

  it('describes position relative to the start of the plan', () => {
    expect(promptFor({ weekN: -1, phase: 'foundation' })).toContain('1 week before Week 1')
    expect(promptFor({ weekN: -2, phase: 'foundation' })).toContain('2 weeks before Week 1')
  })

  it('still renders a normal week as "Week N"', () => {
    expect(promptFor({ weekN: 3 })).toContain('Week 3')
  })

  it('keeps the phase label alongside the foundation heading', () => {
    expect(promptFor({ weekN: -2, phase: 'foundation' })).toContain('Foundation week')
  })
})
