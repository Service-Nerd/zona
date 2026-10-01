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
  // UPNEXT-EXACT-01 — a PRESCRIBED distance rounds to whole units, same as the
  // card. This label is rendered by `AdjustmentDiff.tsx`, so `exact: true` put
  // "easy 5.3mi" in the adjustment diff beside a session card reading "5mi" for
  // the same 8.5 km run. Found by sweeping for the SHAPE of the UP NEXT fix
  // rather than its symptom; it is the second surface, not the reported one.
  it('rounds a prescribed distance to whole units, in both unit systems', () => {
    // 8.5 km is the real value from the reporting runner's week-2 plan.
    expect(labelSession({ type: 'easy', distance_km: 8.5 }, 'mi')).toBe('easy 5mi')
    expect(labelSession({ type: 'easy', distance_km: 8.5 }, 'km')).toBe('easy 9km')
  })

  it('never emits a decimal for a planned distance', () => {
    // The whole class, not the one value: any half-unit input is the risk.
    for (const km of [8.5, 11.5, 4.3, 6.6, 12.5]) {
      for (const u of ['km', 'mi'] as const) {
        expect(labelSession({ type: 'easy', distance_km: km }, u)).not.toMatch(/\d\.\d/)
      }
    }
  })

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
