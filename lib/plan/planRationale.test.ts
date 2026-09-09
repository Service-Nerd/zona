import { describe, it, expect } from 'vitest'
import { planRationaleNotes, levelFitNote, PLAN_RATIONALE_MAX_NOTES } from './planRationale'
import type { Plan } from '@/types/plan'

const meta = (o: Partial<Plan['meta']>) => o as Plan['meta']

describe('planRationaleNotes — the single owner of "why this plan"', () => {
  it('empty plan → no notes (renderer shows nothing, no empty card)', () => {
    expect(planRationaleNotes(meta({}))).toEqual([])
    expect(planRationaleNotes(undefined)).toEqual([])
  })

  it('surfaces an engine-stamped note verbatim under its topic label', () => {
    const notes = planRationaleNotes(meta({ terrain_effort_note: 'Off-road, effort leads.' }))
    expect(notes).toEqual([{ label: 'Off-road', text: 'Off-road, effort leads.' }])
  })

  it('honest constraints rank ABOVE the "shaped for you" line (Wood: never a brag first)', () => {
    const notes = planRationaleNotes(meta({
      early_quality_onset: true,                 // → "Shaped for you"
      volume_constraint_note: 'Maintenance because…',
    }))
    expect(notes[0].label).toBe('Maintenance')
    expect(notes[notes.length - 1].label).toBe('Shaped for you')
  })

  it('caps at PLAN_RATIONALE_MAX_NOTES — a plan does not become a wall of notes', () => {
    const notes = planRationaleNotes(meta({
      volume_constraint_note: 'a', volume_shortfall_note: 'b', long_run_shortfall_note: 'c',
      fitness_signal_note: 'd', hard_pref_note: 'e', terrain_effort_note: 'f', early_quality_onset: true,
    }))
    expect(notes).toHaveLength(PLAN_RATIONALE_MAX_NOTES)
    // The lowest-priority "shaped for you" line is the one dropped by the cap.
    expect(notes.map(n => n.label)).not.toContain('Shaped for you')
  })

  it('levelFitNote is DERIVED, honest, and only fires on a real level decision', () => {
    expect(levelFitNote(meta({ early_quality_onset: true }))?.toLowerCase()).toContain('training history')
    expect(levelFitNote(meta({}))).toBeNull()
  })
})
