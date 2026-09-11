// MAINT-LABEL-01 — what the plan CALLS itself to a beginner.
//
// Measured 2026-09-11: 89% of beginner MARATHON plans carry a
// `volume_constraint_note` (320 of 360; 10K 0%, HM 4%), including a parkrun-er
// with a 24-week runway. Every one of them used to open "Plan generated as
// maintenance" — a word §23 defines as "maintains current fitness rather than
// building it" — to a first-time charity runner going from 5km a week to 26.2
// miles, who will improve more than any other user of this product.
//
// SLT ruling: fix the word, not the engine. `volume_profile` is UNCHANGED
// (it feeds the paid confidence score and §38's remedies; changing the VALUE is
// a Coaching Board question). This pins the prose only.

import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import type { GeneratorInput } from '@/types/plan'

const charityBeginner = (over: Record<string, unknown> = {}) => ({
  athlete_name: 'A', age: 38, race_name: 'Charity', primary_metric: 'distance',
  plan_start: '2026-04-27', race_distance_km: 42.2, race_date: '2026-10-05',
  goal: 'finish', current_weekly_km: 5, longest_recent_run_km: 0,
  fitness_level: 'beginner', recent_quality_training: 'none',
  hard_session_relationship: 'avoid', injury_history: [],
  days_available: 4, days_cannot_train: [], ...over,
}) as unknown as GeneratorInput

const noteFor = (over: Record<string, unknown> = {}) => {
  const input = charityBeginner(over)
  const plan = generateRulePlan(input, 'paid', '2026-04-27', undefined, '2026-04-27')
  return { note: plan.meta.volume_constraint_note ?? null, profile: plan.meta.volume_profile }
}

describe('the note a beginner charity marathoner reads', () => {
  it('exists at all (guards the guard)', () => {
    const { note } = noteFor()
    expect(note, 'this runner is the 89% case; if no note fires, this file tests nothing').toBeTruthy()
  })

  it('never OPENS by calling the plan maintenance', () => {
    const { note } = noteFor()
    expect(note!.startsWith('Plan generated as maintenance')).toBe(false)
  })

  it('says what the plan IS, not what classification it got', () => {
    const { note } = noteFor()
    expect(note!.toLowerCase()).toMatch(/this plan is built to/)
  })

  // The honesty obligation is not weakened — §38 requires diagnosis AND the
  // lever. Softening the label must not soften the information.
  it('still names the diagnosis and the lever (§38)', () => {
    const { note } = noteFor()
    expect(note!.toLowerCase(), 'diagnosis missing').toMatch(/long run|volume|days|time/)
    expect(note!.toLowerCase(), 'lever missing').toContain('lever')
  })

  // Sutherland's point, and the reason this item existed: they WILL get fitter.
  it('tells a beginner they will improve, because they will', () => {
    const { note } = noteFor()
    expect(note!.toLowerCase()).toContain('fitter')
  })

  // The VALUE is deliberately untouched — it feeds the confidence score and
  // §38's remedy selection. Changing it is the board's half of this item.
  it('leaves volume_profile alone — that half is the Coaching Board’s', () => {
    expect(noteFor().profile).toBe('maintenance')
  })

  // The post-race maintenance BLOCK is a different thing and genuinely is
  // maintenance; this item must not have touched it.
  it('does not describe a plan as maintenance anywhere in the opening clause', () => {
    for (const over of [
      {}, { days_available: 3 }, { current_weekly_km: 12, longest_recent_run_km: 5 },
      { race_distance_km: 21.1, race_date: '2026-08-17' },
    ]) {
      const { note } = noteFor(over)
      if (!note) continue
      expect(note.split('—')[0], `opening clause: "${note.split('—')[0]}"`)
        .not.toMatch(/generated as maintenance/i)
    }
  })
})
