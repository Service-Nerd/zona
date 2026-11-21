import { describe, it, expect } from 'vitest'
import { aggregateObserved, type ObservedRows, type RunRow } from './observed'
import { buildRunnerProfile } from './buildRunnerProfile'
import type { ResolvedAsOf } from '@/lib/engine/contracts/facts'
import type { GeneratorInput } from '@/types/plan'

// ADR027-B2-PROFILE — the observed aggregates. Hand fixtures, so each number is checkable by eye.

const FRAME: ResolvedAsOf = { as_of: '2026-11-16', timezone: 'Europe/London', timezone_known: true }
const run = (date: string, km: number, extra: Partial<RunRow> = {}): RunRow => ({
  start_date: `${date}T07:00:00Z`, distance_m: km * 1000, activity_type: 'Run', sport_type: 'Run',
  strava_activity_id: null, apple_health_uuid: `${date}-${km}`, moving_time_s: Math.round(km * 360), ...extra,
})
const EMPTY: ObservedRows = { runs: [], first_run_at: null, health: [], completions: [], analyses: [] }

describe('aggregateObserved — run log', () => {
  it('🔴 code review round 2: a 0-second run is junk, not "no duration"', () => {
    const a = aggregateObserved({ ...EMPTY, runs: [run('2026-11-12', 5, { moving_time_s: 0 })] }, FRAME)
    expect(a.run_log).toMatchObject({ run_count: 0, km_total: 0, excluded_rows: 1 })
  })

  it('🔴 code review: validity runs before dedupe, so a junk longer duplicate cannot hide the real run', () => {
    const a = aggregateObserved({ ...EMPTY, runs: [
      run('2026-11-10', 10, { moving_time_s: 3000 }),
      run('2026-11-10', 10.05, { apple_health_uuid: 'dup', start_date: '2026-11-10T07:02:00Z', moving_time_s: 30 }),
    ] }, FRAME)
    expect(a.run_log).toMatchObject({ run_count: 1, km_total: 10, excluded_rows: 1 })
  })

  it('sums the 28-day window, drops outside rows, keeps the longest', () => {
    const a = aggregateObserved({
      ...EMPTY, first_run_at: '2026-01-05T07:00:00Z',
      runs: [run('2026-11-16', 10), run('2026-10-20', 5), run('2026-10-19', 30) /* 28 days back: outside */, run('2026-11-17', 8) /* future */],
    }, FRAME)
    expect(a.run_log).toMatchObject({ run_count: 2, km_total: 15, longest_km: 10, first_run_date: '2026-01-05', excluded_rows: 0 })
  })

  it('a duplicate ingest counts once (dedupeRuns), and a non-run is ignored', () => {
    const a = aggregateObserved({ ...EMPTY, runs: [
      run('2026-11-10', 10), run('2026-11-10', 10, { apple_health_uuid: 'dup', start_date: '2026-11-10T07:05:00Z' }),
      run('2026-11-11', 20, { activity_type: 'Ride', sport_type: 'Ride' }),
    ] }, FRAME)
    expect(a.run_log.run_count).toBe(1)
    expect(a.run_log.km_total).toBe(10)
  })

  it('validity: 0 m, a 6-second run and an impossible pace are excluded and counted', () => {
    const a = aggregateObserved({ ...EMPTY, runs: [
      run('2026-11-01', 0), run('2026-11-02', 5, { moving_time_s: 6 }), run('2026-11-03', 10, { moving_time_s: 600 }) /* 1:00/km */,
      run('2026-11-04', 6),
    ] }, FRAME)
    expect(a.run_log.run_count).toBe(1)
    expect(a.run_log.km_total).toBe(6)
    // 0 m has no distance at all (`runDistance` → null), so it is excluded too.
    expect(a.run_log.excluded_rows).toBe(3)
  })

  it('latest max HR is the most recent valid one', () => {
    const a = aggregateObserved({ ...EMPTY, runs: [
      run('2026-11-01', 5, { max_hr: 181 }), run('2026-11-08', 5, { max_hr: 175 }), run('2026-11-12', 5, { max_hr: 999 }),
    ] }, FRAME)
    expect(a.run_log.latest_max_hr).toEqual({ bpm: 175, date: '2026-11-08' })
  })
})

describe('aggregateObserved — health, completions, analyses', () => {
  it('RHR: median of valid values over the 7 days ending as_of', () => {
    const a = aggregateObserved({ ...EMPTY, health: [
      { sample_date: '2026-11-16', rhr_bpm: 50 }, { sample_date: '2026-11-12', rhr_bpm: 54 }, { sample_date: '2026-11-10', rhr_bpm: 52 },
      { sample_date: '2026-11-11', rhr_bpm: 0 } /* invalid */, { sample_date: '2026-11-09', rhr_bpm: 80 } /* 7 days back: outside */,
    ] }, FRAME)
    expect(a.health).toEqual({ rhr_7d_median: 52, rhr_samples: 3 })
  })

  it('RPE halves, fatigue counts and the latest tag', () => {
    const a = aggregateObserved({ ...EMPTY, completions: [
      { created_at: '2026-11-15T18:00:00Z', rpe: 8, fatigue_tag: 'Heavy' },
      { created_at: '2026-11-10T18:00:00Z', rpe: 6, fatigue_tag: 'Fine' },
      { created_at: '2026-10-25T18:00:00Z', rpe: 4, fatigue_tag: 'Fresh' },
      { created_at: '2026-10-24T18:00:00Z', rpe: 11, fatigue_tag: 'nonsense' },
    ] }, FRAME)
    expect(a.completions).toEqual({
      rpe_recent_mean: 7, rpe_prior_mean: 4, rpe_n: 3,
      fatigue_counts: { Fresh: 1, Fine: 1, Heavy: 1, Wrecked: 0 }, fatigue_latest: 'Heavy',
    })
  })

  it('EF trend: the latest in the window', () => {
    const a = aggregateObserved({ ...EMPTY, analyses: [
      { created_at: '2026-11-01T08:00:00Z', ef_trend_pct: -2 }, { created_at: '2026-11-14T08:00:00Z', ef_trend_pct: 3.5 },
      { created_at: '2026-11-15T08:00:00Z', ef_trend_pct: null },
    ] }, FRAME)
    expect(a.analyses).toEqual({ ef_trend_pct_latest: 3.5, n: 3 })
  })

  it('an empty history is zero runs, not missing data', () => {
    const a = aggregateObserved(EMPTY, FRAME)
    expect(a.run_log).toEqual({ run_count: 0, km_total: 0, longest_km: null, latest_max_hr: null, first_run_date: null, excluded_rows: 0 })
  })
})

describe('the profile carries the observed block; precedence observed > confirmed > stated', () => {
  const input: GeneratorInput = { race_date: '2027-04-18', race_distance_km: 10, goal: 'finish', current_weekly_km: 40, longest_recent_run_km: 12, days_available: 4, resting_hr: 58 }
  it('observed RHR wins over settings and the request, and the planning facts stay stated', () => {
    const observed = aggregateObserved({ ...EMPTY, first_run_at: '2026-11-01T07:00:00Z',
      runs: [run('2026-11-10', 8)], health: [{ sample_date: '2026-11-15', rhr_bpm: 49 }] }, FRAME)
    const p = buildRunnerProfile({ facts_version: 1, input, observed,
      settings: { birth_year: null, date_of_birth: null, resting_hr: 55, max_hr: null, max_hr_source: null, timezone: 'Europe/London' } },
      { asOf: new Date(Date.UTC(2026, 10, 16, 12)), timezone: 'Europe/London', planStart: '2026-11-23' })
    expect(p.physiology.resting_hr).toEqual({ value: 49, source: 'observed' })
    expect(p.observed).toMatchObject({ available: true, window_days: 28,
      logged_km_28d: { value: 8, source: 'observed' }, run_count_28d: { value: 1, source: 'observed' },
      log_coverage_days: { value: 16, source: 'observed' } })
    // Carried, not read: the declared 40 km is still what the profile reports as the planning volume.
    expect(p.volume.declared_weekly_km).toEqual({ value: 40, source: 'stated' })
    expect(p.volume.effective_start_km.value).toBe(40)
  })
})
