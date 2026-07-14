import { describe, it, expect } from 'vitest'
import { raceInjuryFlagged, buildRaceNarrativeBlock } from './raceNarrative'
import type { RaceResult } from '@/types/plan'

describe('raceInjuryFlagged', () => {
  it('returns false for null / empty', () => {
    expect(raceInjuryFlagged(null)).toBe(false)
    expect(raceInjuryFlagged(undefined)).toBe(false)
    expect(raceInjuryFlagged({})).toBe(false)
  })

  it('flags an injury named in what_broke', () => {
    expect(raceInjuryFlagged({ what_broke: 'hamstring went at 60k' })).toBe(true)
    expect(raceInjuryFlagged({ what_broke: 'rolled my ankle on a root' })).toBe(true)
  })

  it('flags an injury named in notes or strategy_outcome', () => {
    expect(raceInjuryFlagged({ notes: 'Got injured around halfway and had to walk it in.' })).toBe(true)
    expect(raceInjuryFlagged({ strategy_outcome: 'even pacing until the calf seized' })).toBe(true)
  })

  it('does NOT flag general fatigue or a tough day', () => {
    expect(raceInjuryFlagged({ notes: 'Really tough day, legs were tired but I got it done.' })).toBe(false)
    expect(raceInjuryFlagged({ what_broke: 'just ran out of energy in the last 10k' })).toBe(false)
  })
})

describe('buildRaceNarrativeBlock', () => {
  it('returns empty string when no narrative logged', () => {
    expect(buildRaceNarrativeBlock(null)).toBe('')
    expect(buildRaceNarrativeBlock({})).toBe('')
  })

  it('surfaces only the fields the runner filled in, and marks the account authoritative', () => {
    const result: RaceResult = {
      outcome: 'off_target',
      finish_time: '14:32:10',
      what_broke: 'injured at 60k',
      notes: 'too hot early, backed off',
    }
    const block = buildRaceNarrativeBlock(result)
    expect(block).toMatch(/OUTRANKS any device signal/)
    expect(block).toMatch(/injured at 60k/)
    expect(block).toMatch(/too hot early/)
    expect(block).toMatch(/14:32:10/)
    // Fields not provided must not appear.
    expect(block).not.toMatch(/Fueling/)
    expect(block).not.toMatch(/What worked/)
  })
})
