import { describe, it, expect } from 'vitest'
import { mergeHealthKitRuns, healthKitRunsChanged, type HkRunLike } from './mergeHealthKitRuns'

const hk = (id: string, over: Partial<HkRunLike> = {}): HkRunLike => ({ id, source: 'apple_health', average_heartrate: null, max_heartrate: null, moving_time: 6199, distance: 15718, ...over })
const strava = (id: string): HkRunLike => ({ id, source: 'strava', average_heartrate: 140 })

describe('DASHBOARD-RUNS-STALE-HR-01 — a refreshed run list reaches the screen', () => {
  it('🔴 a held run whose heart rate has since arrived replaces the list', () => {
    const prev = [hk('a')]
    const next = [hk('a', { average_heartrate: 153, max_heartrate: 175 })]
    const merged = mergeHealthKitRuns(prev, next)
    expect(merged).not.toBe(prev)
    expect(merged[0].average_heartrate).toBe(153)
  })
  it('a new run replaces it, and non-HealthKit runs are kept', () => {
    const merged = mergeHealthKitRuns([hk('a'), strava('s')], [hk('b'), hk('a')])
    expect(merged.map(r => r.id)).toEqual(['b', 'a', 's'])
  })
  it('an identical list keeps the SAME array, so React does not re-render', () => {
    const prev = [hk('a', { average_heartrate: 153 }), strava('s')]
    expect(mergeHealthKitRuns(prev, [hk('a', { average_heartrate: 153 })])).toBe(prev)
  })
  it('null and undefined heart rate are the same value (no churn on a run that never had HR)', () => {
    expect(healthKitRunsChanged([hk('a')], [{ ...hk('a'), average_heartrate: undefined }])).toBe(false)
  })
  it('a late elevation patch or a rename also reaches the screen', () => {
    expect(healthKitRunsChanged([hk('a')], [hk('a', { total_elevation_gain: 120 })])).toBe(true)
    expect(healthKitRunsChanged([hk('a')], [hk('a', { name: 'Long run' })])).toBe(true)
  })
  it('no previous list takes the new one', () => {
    const next = [hk('a')]
    expect(mergeHealthKitRuns(null, next)).toBe(next)
  })
  it('a Strava run sharing an id with a HealthKit run is not mistaken for it', () => {
    expect(healthKitRunsChanged([strava('a')], [hk('a')])).toBe(true)
  })
})
