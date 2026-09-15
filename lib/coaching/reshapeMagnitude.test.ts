import { describe, it, expect } from 'vitest'
import { computeReshapeMagnitude } from './reshapeMagnitude'
import type { ProposedAdjustment } from './planAdjustment'
import type { Session } from '@/types/plan'

const easy = (km: number): Session => ({ type: 'easy', label: 'Easy', detail: null, distance_km: km })
const long = (km: number): Session => ({ type: 'long', label: 'Long', detail: null, distance_km: km })
const rest = (): Session => ({ type: 'rest', label: 'Rest', detail: null })
const quality = (km: number): Session => ({ type: 'quality', label: 'Tempo', detail: null, distance_km: km })

// Helper to build a minimum-shape ProposedAdjustment for tests
const make = (overrides: Partial<ProposedAdjustment> & {
  triggerType: string
  before:      Session[]
  after:       Session[]
  adjustmentType?: ProposedAdjustment['adjustmentType']
}): ProposedAdjustment => ({
  weekN:           1,
  trigger:         { type: overrides.triggerType as any, detail: {} },
  adjustmentType:  overrides.adjustmentType ?? 'reorder_sessions',
  summary:         '',
  sessionsBefore:  overrides.before,
  sessionsAfter:   overrides.after,
  requiresConfirmation: false,
})

describe('computeReshapeMagnitude — always-high triggers', () => {
  const week = [rest(), rest(), rest(), rest(), rest(), rest(), easy(8)]

  it('skip_with_reason is always high', () => {
    expect(computeReshapeMagnitude(make({
      triggerType: 'skip_with_reason',
      before: week, after: week,
    }))).toBe('high')
  })

  it('session_reorder is always high — closes the 2026-06-26 incident class', () => {
    // The exact incident: rest day moved tue → thu, swap landed long run
    // on tue. Pre-Wave-3 builder marked this requiresConfirmation: false
    // because no §7 violation fired. Wave 3 catches it unconditionally.
    const before = [easy(10), rest(),    easy(5), long(24),  rest(), easy(8), rest()]
    const after  = [easy(10), long(24),  easy(5), rest(),    rest(), easy(8), rest()]
    expect(computeReshapeMagnitude(make({
      triggerType: 'session_reorder',
      before, after,
    }))).toBe('high')
  })

  it('readiness_signal is always high', () => {
    expect(computeReshapeMagnitude(make({
      triggerType: 'readiness_signal',
      before: week, after: week,
    }))).toBe('high')
  })
})

describe('computeReshapeMagnitude — coach-note-only triggers', () => {
  it('flag_for_review is low even when the diff would otherwise flag', () => {
    const before = [easy(10), rest(), easy(5), long(24), rest(), easy(8), rest()]
    const after  = before  // no structural diff
    expect(computeReshapeMagnitude(make({
      triggerType: 'zone_drift',
      adjustmentType: 'flag_for_review',
      before, after,
    }))).toBe('low')
  })
})

describe('computeReshapeMagnitude — structural diff inspection', () => {
  it('replaces are high (different session type at the same slot)', () => {
    const before = [easy(10), rest(), easy(5), rest(), rest(), easy(8), long(24)]
    const after  = [easy(10), rest(), easy(5), rest(), rest(), easy(8), rest()]  // sun replaced
    expect(computeReshapeMagnitude(make({
      triggerType: 'fatigue_accumulation',
      before, after,
    }))).toBe('high')
  })

  it('a TYPE SWAP at the same distance is high, with the volume held constant', () => {
    // Added 2026-09-15 by `npm run test:liveness`. The existing "replaces are
    // high" case swaps a 24 km long run for a rest day, so the CUMULATIVE
    // week-volume check returns 'high' on its own — and the harness proved it:
    // breaking the `replaced` branch outright left this file green, because a
    // different code path produced the same answer.
    //
    // ADR-012's rule is that a session-type change at any slot is structural
    // REGARDLESS of volume: "you moved my long day" is the kind of change a
    // runner would tell a real coach about. Holding the distance identical is
    // the only way to make the structural branch the sole thing that can answer.
    const before = [easy(10), rest(), quality(8), rest(), rest(), easy(8), long(24)]
    const after  = [easy(10), rest(), easy(8),    rest(), rest(), easy(8), long(24)]  // same km
    const beforeKm = before.reduce((a, s) => a + (s.distance_km ?? 0), 0)
    const afterKm  = after.reduce((a, s) => a + (s.distance_km ?? 0), 0)
    expect(afterKm, 'the fixture must hold volume constant or it proves nothing').toBe(beforeKm)
    expect(computeReshapeMagnitude(make({
      triggerType: 'ef_decline',
      before, after,
    }))).toBe('high')
  })

  it('a REMOVED session is high even when the volume barely moves', () => {
    // The `removed` arm of the same branch, isolated the same way: drop a 1 km
    // session out of a 55 km week so no volume threshold can be what answers.
    const before = [easy(10), easy(1), easy(5), rest(), rest(), easy(8), long(24)]
    const after  = [easy(10), rest(),  easy(5), rest(), rest(), easy(8), long(24)]
    expect(computeReshapeMagnitude(make({
      triggerType: 'ef_decline',
      before, after,
    }))).toBe('high')
  })

  it('an ADDED session is high even when the volume barely moves', () => {
    const before = [easy(10), rest(),  easy(5), rest(), rest(), easy(8), long(24)]
    const after  = [easy(10), easy(1), easy(5), rest(), rest(), easy(8), long(24)]
    expect(computeReshapeMagnitude(make({
      triggerType: 'ef_decline',
      before, after,
    }))).toBe('high')
  })

  it('modifies above the distance threshold are high (20% trim)', () => {
    const before = [easy(10), rest(), easy(5), rest(), rest(), easy(8), long(24)]
    const after  = [easy(10), rest(), easy(5), rest(), rest(), easy(8), long(19)]  // 21% trim
    expect(computeReshapeMagnitude(make({
      triggerType: 'long_run_shortfall',
      before, after,
    }))).toBe('high')
  })

  it('modifies at or below the distance threshold are low (10% trim)', () => {
    const before = [easy(10), rest(), easy(5), rest(), rest(), easy(8), long(24)]
    const after  = [easy(10), rest(), easy(5), rest(), rest(), easy(8), long(21.6)]  // 10% trim
    expect(computeReshapeMagnitude(make({
      triggerType: 'acute_chronic_high',
      before, after,
    }))).toBe('low')
  })

  it('cumulative week-volume change above threshold is high (compound small trims)', () => {
    // Each individual day trim is sub-threshold (10%) but the cumulative
    // week-volume change exceeds 15%, so the compound is high-magnitude.
    const before = [easy(10), rest(), easy(5),    rest(), rest(), easy(8),    long(24)]
    const after  = [easy(8),  rest(), easy(4),    rest(), rest(), easy(6.5),  long(19.5)]  // ~19% week trim
    expect(computeReshapeMagnitude(make({
      triggerType: 'acute_chronic_high',
      before, after,
    }))).toBe('high')
  })

  it('no structural change and no distance change is low', () => {
    const week = [easy(10), rest(), easy(5), rest(), rest(), easy(8), long(24)]
    expect(computeReshapeMagnitude(make({
      triggerType: 'ef_decline',
      before: week, after: week,
    }))).toBe('low')
  })
})
