// MODIFY the pace tile's typography without touching §12's words
// (Design Board, 2026-09-27, clause 2).

import { describe, it, expect } from 'vitest'
import { splitPaceQualifier, easyPaceAsCeiling } from './easyPaceCeiling'

describe('splitPaceQualifier', () => {
  it('🔴 splits the ceiling form the producer actually emits', () => {
    // Composed with the producer rather than hand-written, so the two cannot
    // drift: if `easyPaceAsCeiling` changes its wording this goes red.
    const produced = easyPaceAsCeiling('5:53–6:40 /km', 'easy')!
    expect(produced).toBe('5:53 /km or slower')
    expect(splitPaceQualifier(produced)).toEqual({ value: '5:53 /km', qualifier: 'or slower' })
  })

  it('🔴 a RANGE keeps its whole value — there the range IS the target', () => {
    // Quality, long and race sessions keep their band (§12, top of the module).
    // Demoting half of "5:30–5:50 /km" would be a coaching change.
    expect(splitPaceQualifier('5:30–5:50 /km')).toEqual({ value: '5:30–5:50 /km', qualifier: null })
  })

  it('handles miles, since the unit is read back out of the text', () => {
    expect(splitPaceQualifier('12:04 /mi or slower'))
      .toEqual({ value: '12:04 /mi', qualifier: 'or slower' })
  })

  it('is case-insensitive but does not invent a qualifier', () => {
    expect(splitPaceQualifier('5:53 /km OR SLOWER')?.qualifier).toBe('OR SLOWER')
    expect(splitPaceQualifier('5:53 /km or faster')?.qualifier).toBeNull()
  })

  it('null in, null out — a display helper never blanks a prescription', () => {
    expect(splitPaceQualifier(null)).toBeNull()
    expect(splitPaceQualifier(undefined)).toBeNull()
    expect(splitPaceQualifier('')).toBeNull()
  })
})
