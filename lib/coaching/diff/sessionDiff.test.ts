import { describe, it, expect } from 'vitest'
import {
  computeSessionDiff,
  hasStructuralChange,
  summariseDiff,
  labelSession,
} from './sessionDiff'

const rest = () => ({ type: 'rest', label: 'Rest', detail: null })
const easy = (km: number) => ({ type: 'easy', label: 'Easy', detail: null, distance_km: km })
const long = (km: number, mins: number) => ({
  type: 'long', label: 'Long run', detail: null, distance_km: km, duration_mins: mins,
})

describe('computeSessionDiff', () => {
  it('reports every day unchanged when arrays are identical', () => {
    const week = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const diff = computeSessionDiff(week, week)
    expect(diff).toHaveLength(7)
    expect(diff.every(d => d.kind === 'unchanged')).toBe(true)
    expect(hasStructuralChange(diff)).toBe(false)
  })

  it('reports `replaced` when a session swap changes type at both ends — the 2026-06-26 incident shape', () => {
    // Pre-incident: sun = long run, tue = rest
    // Post-incident: sun = rest, tue = long run
    const before = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const after  = [easy(10), long(24, 180), easy(5), rest(), easy(8), easy(5), rest()]
    const diff   = computeSessionDiff(before, after)
    expect(diff[1].kind).toBe('replaced')  // tue
    expect(diff[6].kind).toBe('replaced')  // sun
    expect(diff[1].after?.type).toBe('long')
    expect(diff[6].after?.type).toBe('rest')
    expect(hasStructuralChange(diff)).toBe(true)
  })

  it('reports `modified` when the type stays but distance/duration changes (trim case)', () => {
    const before = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const after  = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(20, 150)]
    const diff   = computeSessionDiff(before, after)
    expect(diff[6].kind).toBe('modified')
    expect(diff[6].before?.distance_km).toBe(24)
    expect(diff[6].after?.distance_km).toBe(20)
  })
})

describe('summariseDiff', () => {
  it('emits a single line per non-unchanged day in mon→sun order — the incident shape', () => {
    const before = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const after  = [easy(10), long(24, 180), easy(5), rest(), easy(8), easy(5), rest()]
    expect(summariseDiff(computeSessionDiff(before, after))).toEqual([
      'Tue: rest → long 24km',
      'Sun: long 24km → rest',
    ])
  })

  it('omits unchanged days unless `includeUnchanged` is set', () => {
    const before = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(24, 180)]
    const after  = [easy(10), rest(), easy(5), rest(), easy(8), easy(5), long(20, 150)]
    expect(summariseDiff(computeSessionDiff(before, after))).toEqual([
      'Sun: long 24km → long 20km',
    ])
  })
})

describe('labelSession', () => {
  it('renders rest plainly', () => {
    expect(labelSession(rest())).toBe('rest')
  })

  it('prefers distance when available, honouring units', () => {
    expect(labelSession(easy(8))).toBe('easy 8km')
    expect(labelSession(easy(8), 'mi')).toBe('easy 5mi')
  })

  it('falls back to the canonical duration glyph when distance is absent', () => {
    expect(labelSession({ type: 'long', label: null, duration_mins: 180 } as any)).toBe('long 3h')
    expect(labelSession({ type: 'long', label: null, duration_mins: 45  } as any)).toBe('long 45 min')
    expect(labelSession({ type: 'long', label: null, duration_mins: 90  } as any)).toBe('long 1h 30')
  })

  it('uses label in parens for non-distance non-duration sessions', () => {
    expect(labelSession({ type: 'strength', label: 'Mobility only', detail: null } as any))
      .toBe('strength (Mobility only)')
  })
})
