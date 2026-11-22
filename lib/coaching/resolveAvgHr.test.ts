import { describe, it, expect } from 'vitest'
import { resolveAvgHr } from './resolveAvgHr'

describe('SESSION-COMPLETION-AVG-HR-STALE-01 — resolveAvgHr', () => {
  it('🔴 a completion linked before HR arrived falls back to the activity row', () => expect(resolveAvgHr(null, 153)).toBe(153))
  it('the completion value wins when present (manual log)', () => expect(resolveAvgHr(148, 153)).toBe(148))
  it('no HR anywhere is null, never 0', () => { expect(resolveAvgHr(null, null)).toBeNull(); expect(resolveAvgHr(undefined, 0)).toBeNull() })
  it('a junk completion value (0, NaN) falls through to a valid activity value', () => { expect(resolveAvgHr(0, 153)).toBe(153); expect(resolveAvgHr(Number.NaN, 153)).toBe(153) })
  it('a non-finite activity value is not a heart rate', () => expect(resolveAvgHr(null, Number.NaN)).toBeNull())
})
