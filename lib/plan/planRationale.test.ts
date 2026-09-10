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

describe('§98 — the §1 yield is visible to the runner (ONSET-YIELD-NOTE-01)', () => {
  const yielded = (over: any = {}) => ({
    early_quality_onset: true,
    onset_yield: { rungs: 2, bound: 5, effective: 4 },
    ...over,
  }) as any

  it('a trimmed plan says so', () => {
    const notes = planRationaleNotes(yielded())
    const note = notes.find(n => n.label === 'Quality timing')
    expect(note).toBeDefined()
    expect(note!.text).toContain('starts later here')
  })

  it('an UNTRIMMED gated plan says nothing — 84% of the cohort', () => {
    const notes = planRationaleNotes({ early_quality_onset: true } as any)
    expect(notes.find(n => n.label === 'Quality timing')).toBeUndefined()
    // and still gets to claim the early start, because it is true for them
    expect(notes.find(n => n.label === 'Shaped for you')).toBeDefined()
  })

  it('STOPS the "earlier than a novice plan" claim when the trim reached a tie', () => {
    // effective === bound: quality starts exactly when it would for an ungated
    // runner, so the claim would be false. This is the case that would have
    // silently shipped a untrue sentence.
    const notes = planRationaleNotes(yielded({ onset_yield: { rungs: 3, bound: 5, effective: 5 } }))
    expect(notes.find(n => n.label === 'Shaped for you')).toBeUndefined()
    expect(notes.find(n => n.label === 'Quality timing')).toBeDefined()
  })

  it('keeps the claim when the trimmed plan is still genuinely earlier', () => {
    const notes = planRationaleNotes(yielded({ onset_yield: { rungs: 1, bound: 6, effective: 4 } }))
    expect(notes.find(n => n.label === 'Shaped for you')).toBeDefined()
  })

  it('a fell-through plan (rung 0, gate suppressed) explains itself and claims nothing', () => {
    const notes = planRationaleNotes({
      early_quality_onset: false,
      onset_yield: { rungs: 0, bound: 5, effective: 5 },
    } as any)
    expect(notes.find(n => n.label === 'Quality timing')).toBeDefined()
    expect(notes.find(n => n.label === 'Shaped for you')).toBeUndefined()
  })

  it('a plan the ladder never touched is completely unchanged', () => {
    expect(planRationaleNotes({} as any)).toEqual([])
  })
})
