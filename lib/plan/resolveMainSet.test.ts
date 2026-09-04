import { describe, it, expect } from 'vitest'
import { describeDerivedSet, type DerivedSet } from './resolveMainSet'

/**
 * Regression guard for the session-structure serializer.
 *
 * The bug (2026-09-04, SESSION-STRUCTURE-REDESIGN): `describeDerivedSet` was a
 * flat `${length}${pace}${modality}` concatenation with no grammar. On the hill
 * row it produced the garbled string that shipped to production:
 *
 *   "…8 × (1:30 at RPE 8 + until ready stand + same as the 1:30 at no faster
 *    than 5:53–7:02 /km jog)"
 *
 * — "until ready stand", "same as the 1:30 … jog", and the downhill direction
 * dropped entirely. These cases fail before the fix and pass after.
 */

// A faithful hill-rep derived set: lead-in transition, then 8× (uphill RPE / stand / jog-down).
const HILL: DerivedSet = {
  version: 2,
  blocks: [
    {
      repeat: 1,
      steps: [
        { role: 'transition', modality: 'run', length: 'to the bottom of the hill', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ],
    },
    {
      repeat: 8,
      steps: [
        { role: 'work', modality: 'run', terrain: 'uphill', length: '1:30', pace: null, rpe: 8, advance: 'auto' },
        { role: 'recovery', modality: 'stand', length: 'until ready', pace: null, advance: 'auto' },
        { role: 'recovery', modality: 'jog', terrain: 'downhill', length: 'same as the 1:30', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ],
    },
  ],
}

describe('describeDerivedSet — hill reps (the regression)', () => {
  const out = describeDerivedSet(HILL)

  it('never emits the garbled fragments', () => {
    expect(out).not.toMatch(/until ready stand/)
    expect(out).not.toMatch(/same as the/)
  })

  it('leads a standing rest with the verb, not a trailing modality', () => {
    expect(out).toContain('stand until ready')
  })

  it('names the descent by direction and keeps its pace', () => {
    expect(out).toContain('jog back down at no faster than 5:53–7:02 /km')
  })

  it('runs the lead-in to the landmark as a run', () => {
    expect(out).toContain('run to the bottom of the hill at no faster than 5:53–7:02 /km')
  })

  it('keeps the climb effort-governed with its terrain', () => {
    expect(out).toContain('1:30 uphill at RPE 8')
  })

  it('reads as a coherent whole', () => {
    expect(out).toBe(
      'run to the bottom of the hill at no faster than 5:53–7:02 /km, then ' +
      '8 × (1:30 uphill at RPE 8 + stand until ready + jog back down at no faster than 5:53–7:02 /km)',
    )
  })
})

describe('describeDerivedSet — classic rep set is unchanged in spirit', () => {
  const REPS: DerivedSet = {
    version: 2,
    blocks: [{
      repeat: 4,
      steps: [
        { role: 'work', modality: 'run', length: '5 min', pace: '4:25–4:35 /km', pace_mode: 'target', advance: 'auto' },
        { role: 'recovery', modality: 'jog', length: '1:30', pace: '5:53–7:02 /km', pace_mode: 'ceiling', advance: 'auto' },
      ],
    }],
  }

  it('renders reps with work + recovery legibly', () => {
    expect(describeDerivedSet(REPS)).toBe(
      '4 × (5 min at 4:25–4:35 /km + jog 1:30 at no faster than 5:53–7:02 /km)',
    )
  })
})
