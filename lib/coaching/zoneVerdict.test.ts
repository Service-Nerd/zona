// P-01 — the semantic pair has ONE owner, and `unknown` is never `held`.

import { describe, it, expect } from 'vitest'
import { zoneVerdict, zoneVerdictColour, zoneVerdictLabel } from './zoneVerdict'
import { ZONE_DRIFT_ABOVE_CEILING_PCT as T } from './constants'

describe('P-01 — zoneVerdict binds to the RATIFIED threshold', () => {
  it('drifts strictly above the threshold, holds at and below it', () => {
    expect(zoneVerdict(T + 0.1)).toBe('drifted')
    expect(zoneVerdict(T)).toBe('held')
    expect(zoneVerdict(T - 0.1)).toBe('held')
  })

  it('the measured distribution lands where the principle says it does', () => {
    // Too-easy runs from the production sample: 0, 0, 1, 2, 3, 19% above ceiling.
    for (const p of [0, 0, 1, 2, 3, 19]) expect(zoneVerdict(p)).toBe('held')
    // Too-hard runs: 23, 40, 47 … 94%.
    for (const p of [23, 40, 47, 94]) expect(zoneVerdict(p)).toBe('drifted')
  })

  it('is bound to the constant, not to a copy of its value', () => {
    // If someone re-tunes the principle, this test moves with it rather than
    // pinning an independent 20 that would drift from the constitution.
    expect(T).toBeGreaterThan(0)
    expect(zoneVerdict(T + 1)).toBe('drifted')
  })
})

describe('P-01 — a missing measurement is NEVER a good one', () => {
  it('null, undefined and NaN are unknown, not held', () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(zoneVerdict(v as number)).toBe('unknown')
    }
  })

  it('THE DEFECT THIS PREVENTS: `?? 0` would award "held" to every runner with no HR', () => {
    // This repo's recorded `distance_km ?? 0` class, in a new costume.
    expect(zoneVerdict(null)).not.toBe('held')
    expect(zoneVerdict(undefined)).not.toBe('held')
  })

  it('unknown says nothing rather than guessing', () => {
    expect(zoneVerdictLabel('unknown')).toBeNull()
  })
})

describe('P-01 — colours resolve from tokens, never literals', () => {
  it('every verdict returns a var()', () => {
    for (const v of ['held', 'drifted', 'unknown'] as const) {
      expect(zoneVerdictColour(v)).toMatch(/^var\(--[a-z-]+\)$/)
    }
  })

  it('held and drifted are distinguishable, and neither is the unknown token', () => {
    const h = zoneVerdictColour('held'), d = zoneVerdictColour('drifted'), u = zoneVerdictColour('unknown')
    expect(new Set([h, d, u]).size).toBe(3)
  })

  it('no literal colour value escapes this module', () => {
    for (const v of ['held', 'drifted', 'unknown'] as const) {
      expect(zoneVerdictColour(v)).not.toMatch(/#|rgba?\(/)
    }
  })
})

describe('P-01 — resolution A: the pair is scoped to COMPLETION, not prescription', () => {
  it('does not claim the race accent or the coaching amber', () => {
    // A race week in amber must not read as a reprimand. The module answers one
    // question and returns its own tokens; it never returns --s-race or --warn.
    for (const v of ['held', 'drifted', 'unknown'] as const) {
      expect(zoneVerdictColour(v)).not.toBe('var(--s-race)')
      expect(zoneVerdictColour(v)).not.toBe('var(--warn)')
    }
  })
})
