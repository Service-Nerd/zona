import { describe, it, expect } from 'vitest'
import { resolveHealthKitDuplicate, tryEnrichHealthKitRow, type DedupCandidate } from './healthkitConsolidate'

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
    expect(resolveHealthKitDuplicate(incoming({ uuid: 'INCOMING' }), [c])).toEqual({ action: 'skip', matchId: 'self', patchHr: false, convertToHk: false })
  })

  it('inserts (refreshes) a re-sync of an unenriched same-uuid row', () => {
    const c = cand({ apple_health_uuid: 'INCOMING', strava_activity_id: null, hasHrSummary: false })
    expect(resolveHealthKitDuplicate(incoming({ uuid: 'INCOMING' }), [c]).action).toBe('insert')
  })

  it('skips and converts a Strava-only row to HK canonical (ADR-011: HK is SOR)', () => {
    // Strava webhook landed first → row has strava_activity_id but no
    // apple_health_uuid. HK ingest arrives second: instead of suppressing the
    // HK side and leaving us Strava-only, we patch the row to source=HK.
    // NB: build the candidate directly — `cand({ apple_health_uuid: null })`
    // gets silently swapped to 'HK_OTHER' by the factory's `??` fallback.
    const c: DedupCandidate = {
      id:                 's1',
      apple_health_uuid:  null,
      strava_activity_id: 999,
      distance_m:         10_000,
      start_ms:           T0,
      hasHrSummary:       true,
    }
    const d = resolveHealthKitDuplicate(incoming(), [c])
    expect(d).toEqual({ action: 'skip', matchId: 's1', patchHr: false, convertToHk: true })
  })

  it('does not convert when the canonical is already an HK row', () => {
    // Cross-source HK ingest from a second app (e.g. Garmin Connect): the
    // existing HK row stays canonical, no source change.
    const c = cand({ id: 'hk2', apple_health_uuid: 'HK_GARMIN', strava_activity_id: null, hasHrSummary: true })
    expect(resolveHealthKitDuplicate(incoming(), [c])).toEqual({ action: 'skip', matchId: 'hk2', patchHr: false, convertToHk: false })
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
    expect(resolveHealthKitDuplicate(incoming({ hr: true }), [c])).toEqual({ action: 'skip', matchId: 'noHr', patchHr: true, convertToHk: false })
  })

  it('does not patch HR when the canonical already has a summary', () => {
    const c = cand({ id: 'hasHr', hasHrSummary: true })
    expect(resolveHealthKitDuplicate(incoming({ hr: true }), [c])).toEqual({ action: 'skip', matchId: 'hasHr', patchHr: false, convertToHk: false })
  })

  it('does not patch HR when the incoming has no summary', () => {
    const c = cand({ id: 'noHr', hasHrSummary: false })
    expect(resolveHealthKitDuplicate(incoming({ hr: false }), [c])).toEqual({ action: 'skip', matchId: 'noHr', patchHr: false, convertToHk: false })
  })
})

/**
 * INV-DATA-008 sentinel. ADR-011 (amended 2026-06-24): HealthKit is the SOR.
 * A Strava activity that finds no matching HealthKit row must NOT be stored
 * as a primary record — `tryEnrichHealthKitRow` reports `enriched: false`
 * and the caller is required to discard the activity.
 *
 * If this test ever flips (e.g. the helper starts inserting a fallback Strava
 * row internally, or the contract changes silently), the doctrine has drifted.
 * The hook in `.githooks/pre-commit` catches NEW writers; this test pins the
 * existing helper's behaviour.
 */
describe('INV-DATA-008: tryEnrichHealthKitRow discards Strava with no HK match', () => {
  // Minimal supabase chain stub. Returns the configured candidate list from
  // the .order() terminal call. Skips update mirrors — the no-match path
  // shouldn't reach them. If it does, the test will throw on undefined chains
  // and that's a doctrine violation worth surfacing.
  const stubSupabase = (candidates: unknown[]) => ({
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, _val: unknown) => ({
          eq: (_col2: string, _val2: unknown) => ({
            gte: (_col3: string, _val3: unknown) => ({
              lte: (_col4: string, _val4: unknown) => ({
                order: (_col5: string, _opts: unknown) => Promise.resolve({ data: candidates, error: null }),
              }),
            }),
          }),
        }),
      }),
    }),
  })

  const stravaActivity = {
    id:           777,
    start_date:   '2026-06-23T17:49:55.000Z',
    distance:     8025,
    name:         '8K shakeout',
    suffer_score: null,
  }

  it('reports enriched=false when no HK candidates exist (Strava is discarded)', async () => {
    const result = await tryEnrichHealthKitRow(
      stubSupabase([]),
      'user-1',
      stravaActivity,
      null,
    )
    expect(result).toEqual({ enriched: false })
  })

  it('reports enriched=false when candidates are out of distance tolerance (Strava is discarded)', async () => {
    const farRow = { id: 'r1', apple_health_uuid: 'HK1', distance_m: 5000, strava_activity_id: null }
    const result = await tryEnrichHealthKitRow(
      stubSupabase([farRow]),
      'user-1',
      stravaActivity,
      null,
    )
    expect(result).toEqual({ enriched: false })
  })

  it('reports enriched=false when the only candidate is already linked to a Strava activity', async () => {
    const alreadyLinked = { id: 'r1', apple_health_uuid: 'HK1', distance_m: 8025, strava_activity_id: 999 }
    const result = await tryEnrichHealthKitRow(
      stubSupabase([alreadyLinked]),
      'user-1',
      stravaActivity,
      null,
    )
    expect(result).toEqual({ enriched: false })
  })
})
