import { describe, it, expect } from 'vitest'
import { resolveHealthKitDuplicate, type DedupCandidate } from './healthkitConsolidate'

/**
 * INGEST-DEDUP-01 — the pure decision behind HealthKit-side consolidation.
 * The incoming HK row is suppressed when an existing row already covers the
 * same physical run (±5 min / ±5%); otherwise it's inserted. A false match
 * would drop a real run, so the tolerances are deliberately tight.
 */
describe('resolveHealthKitDuplicate', () => {
  const T0 = 1_700_000_000_000 // fixed reference ms (no Date.now in the pure fn)
  const incoming = (over: Partial<{ uuid: string; dist: number; start: number; hr: boolean }> = {}) => ({
    appleHealthUuid: over.uuid ?? 'INCOMING',
    distanceM:       over.dist ?? 10_000,
    startMs:         over.start ?? T0,
    hasHrSummary:    over.hr ?? true,
  })
  const cand = (o: Partial<DedupCandidate> = {}): DedupCandidate => ({
    id:                 o.id ?? 'c1',
    apple_health_uuid:  o.apple_health_uuid ?? 'HK_OTHER',
    strava_activity_id: o.strava_activity_id ?? null,
    distance_m:         o.distance_m ?? 10_000,
    start_ms:           o.start_ms ?? T0,
    hasHrSummary:       o.hasHrSummary ?? false,
  })

  it('inserts when there are no candidates', () => {
    expect(resolveHealthKitDuplicate(incoming(), [])).toEqual({ action: 'insert' })
  })

  it('skips a re-sync of an already-enriched same-uuid row (preserve the Strava link)', () => {
    // Re-upserting would null strava_activity_id + overwrite Strava HR — the bug.
    const c = cand({ id: 'self', apple_health_uuid: 'INCOMING', strava_activity_id: 123, hasHrSummary: true })
    expect(resolveHealthKitDuplicate(incoming({ uuid: 'INCOMING' }), [c])).toEqual({ action: 'skip', matchId: 'self', patchHr: false })
  })

  it('inserts (refreshes) a re-sync of an unenriched same-uuid row', () => {
    const c = cand({ apple_health_uuid: 'INCOMING', strava_activity_id: null, hasHrSummary: false })
    expect(resolveHealthKitDuplicate(incoming({ uuid: 'INCOMING' }), [c]).action).toBe('insert')
  })

  it('skips when a Strava row covers the same run', () => {
    const c = cand({ id: 's1', apple_health_uuid: null, strava_activity_id: 999, hasHrSummary: true })
    const d = resolveHealthKitDuplicate(incoming(), [c])
    expect(d).toEqual({ action: 'skip', matchId: 's1', patchHr: false })
  })

  it('skips when another HealthKit row (different uuid) covers the same run', () => {
    const c = cand({ id: 'hk2', apple_health_uuid: 'HK_GARMIN', hasHrSummary: true })
    expect(resolveHealthKitDuplicate(incoming({ hr: false }), [c]).action).toBe('skip')
  })

  it('inserts when distance differs by more than 5%', () => {
    const c = cand({ distance_m: 10_600 }) // +6%
    expect(resolveHealthKitDuplicate(incoming({ dist: 10_000 }), [c]).action).toBe('insert')
  })

  it('skips when distance differs by less than 5%', () => {
    const c = cand({ id: 'near', distance_m: 10_400 }) // +4%
    expect(resolveHealthKitDuplicate(incoming({ dist: 10_000 }), [c])).toMatchObject({ action: 'skip', matchId: 'near' })
  })

  it('inserts when start time is more than 5 min apart', () => {
    const c = cand({ start_ms: T0 + 6 * 60 * 1000 })
    expect(resolveHealthKitDuplicate(incoming({ start: T0 }), [c]).action).toBe('insert')
  })

  it('prefers a Strava-linked row as canonical over a bare HK row', () => {
    const hk     = cand({ id: 'hk', apple_health_uuid: 'HK_X', hasHrSummary: true })
    const strava = cand({ id: 'sv', apple_health_uuid: null, strava_activity_id: 42, hasHrSummary: true })
    const d = resolveHealthKitDuplicate(incoming(), [hk, strava])
    expect(d).toMatchObject({ action: 'skip', matchId: 'sv' })
  })

  it('patches HR when the canonical lacks a summary and the incoming has one', () => {
    const c = cand({ id: 'noHr', hasHrSummary: false })
    expect(resolveHealthKitDuplicate(incoming({ hr: true }), [c])).toEqual({ action: 'skip', matchId: 'noHr', patchHr: true })
  })

  it('does not patch HR when the canonical already has a summary', () => {
    const c = cand({ id: 'hasHr', hasHrSummary: true })
    expect(resolveHealthKitDuplicate(incoming({ hr: true }), [c])).toEqual({ action: 'skip', matchId: 'hasHr', patchHr: false })
  })

  it('does not patch HR when the incoming has no summary', () => {
    const c = cand({ id: 'noHr', hasHrSummary: false })
    expect(resolveHealthKitDuplicate(incoming({ hr: false }), [c])).toEqual({ action: 'skip', matchId: 'noHr', patchHr: false })
  })
})
