import { describe, it, expect } from 'vitest'
import { fetchRunnerFacts } from './fetchRunnerFacts'
import { fakeDb, type FakeQuery } from '@/lib/strava/__fixtures__/fakeDb'
import type { GeneratorInput } from '@/types/plan'

// ADR027-B2-PROFILE — the route-boundary fetcher. It reads and hands rows to L1; these assert WHAT it
// reads, that the user filter is on every query, and that an error is never an empty history.

const INPUT: GeneratorInput = { race_date: '2027-04-18', race_distance_km: 10, goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4 }
const NOW = new Date(Date.UTC(2026, 10, 16, 23, 30)) // 23:30 UTC = the 17th in Auckland

function rowsFor(q: FakeQuery) {
  if (q.table === 'user_settings') return { data: { birth_year: 1985, date_of_birth: null, resting_hr: 0, max_hr: 186, max_hr_source: 'observed', timezone: 'Pacific/Auckland' } }
  if (q.table === 'strava_activities' && q.cols === 'start_date') return { data: [{ start_date: '2025-06-01T06:00:00Z' }] }
  if (q.table === 'strava_activities') return { data: [
    { start_date: '2026-11-16T19:00:00Z', distance_m: 10000, moving_time_s: 3300, max_hr: 172, activity_type: 'Run', sport_type: 'Run', strava_activity_id: null, apple_health_uuid: 'a' },
    { start_date: '2026-11-02T19:00:00Z', distance_m: 0, moving_time_s: 6, max_hr: null, activity_type: 'Run', sport_type: 'Run', strava_activity_id: null, apple_health_uuid: 'b' },
  ] }
  if (q.table === 'health_daily_samples') return { data: [{ sample_date: '2026-11-17', rhr_bpm: 51 }] }
  if (q.table === 'session_completions') return { data: [{ created_at: '2026-11-15T18:00:00Z', rpe: 7, fatigue_tag: 'Fine' }] }
  if (q.table === 'run_analysis') return { data: [{ created_at: '2026-11-15T18:00:00Z', ef_trend_pct: 1.2 }] }
  return { data: null }
}

describe('fetchRunnerFacts', () => {
  it('reads the six stores, filtered to the runner, and aggregates through L1', async () => {
    const db = fakeDb(rowsFor)
    const facts = await fetchRunnerFacts(db, 'u-1', INPUT, NOW)
    expect(db.log.map(q => q.table).sort()).toEqual(
      ['health_daily_samples', 'run_analysis', 'session_completions', 'strava_activities', 'strava_activities', 'user_settings'])
    for (const q of db.log) expect(q.filters[q.table === 'user_settings' ? 'id' : 'user_id']).toBe('u-1')
    // Superseded completions and analyses are not this runner's current record.
    expect(db.log.filter(q => q.table === 'session_completions' || q.table === 'run_analysis').every(q => q.filters.superseded_at === null)).toBe(true)
    expect(db.log.every(q => q.op === 'select')).toBe(true)

    expect(facts.input).toBe(INPUT)
    expect(facts.settings).toMatchObject({ birth_year: 1985, resting_hr: 0, timezone: 'Pacific/Auckland' }) // raw: validity is L1's
    // as_of resolved in the runner's zone, not the server's.
    expect(facts.observed?.as_of).toBe('2026-11-17')
    expect(facts.observed?.run_log).toMatchObject({ run_count: 1, km_total: 10, excluded_rows: 1, first_run_date: '2025-06-01' })
    expect(facts.observed?.health.rhr_7d_median).toBe(51)
    expect(facts.observed?.analyses.ef_trend_pct_latest).toBe(1.2)
  })

  it('a runner with no settings row has settings null and a server-local as_of', async () => {
    const facts = await fetchRunnerFacts(fakeDb(q => (q.table === 'user_settings' ? { data: null } : { data: [] })), 'u-2', INPUT, NOW)
    expect(facts.settings).toBeNull()
    expect(facts.observed?.run_log.run_count).toBe(0)
  })

  it('🔴 a query error throws; it is never read as an empty history', async () => {
    const db = fakeDb(q => (q.table === 'health_daily_samples' ? { error: { message: 'permission denied' } } : rowsFor(q)))
    await expect(fetchRunnerFacts(db, 'u-3', INPUT, NOW)).rejects.toThrow(/health_daily_samples.*permission denied/)
  })
})
