// COACH-RINGS-SOURCE-01 — the Coach zone rings read every run this plan week (Coaching Board, Coach review 2026-10-30).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { weekZoneSplitRows, zoneTimeSplit } from './weeklyZoneAggregate'

const WEEK = { date: '2026-10-26' }   // Monday
let n = 0
const run = (iso: string, km: number, z: [number, number, number, number] | null, extra: Record<string, unknown> = {}) => ({
  start_date: iso, distance_m: km * 1000, activity_type: 'Run', sport_type: 'Run',
  strava_activity_id: null, apple_health_uuid: `hk-${++n}`, manual_uuid: null,
  hr_pct_z1: z?.[0] ?? null, hr_pct_z2: z?.[1] ?? null, hr_pct_z3: z?.[2] ?? null, hr_pct_z4_5: z?.[3] ?? null,
  ...extra,
})

describe('weekZoneSplitRows', () => {
  it('every run in the plan week with a split counts, matched or not', () => {
    const rows = weekZoneSplitRows([
      run('2026-10-27T07:00:00Z', 8, [10, 80, 10, 0]),
      run('2026-10-29T07:00:00Z', 12, [5, 70, 20, 5]),
    ], WEEK)
    expect(rows).toHaveLength(2)
  })
  it('runs outside the week, walks, and runs with no split do not', () => {
    const rows = weekZoneSplitRows([
      run('2026-10-25T07:00:00Z', 10, [0, 100, 0, 0]),                       // Sunday before
      run('2026-11-02T07:00:00Z', 10, [0, 100, 0, 0]),                       // next Monday
      run('2026-10-28T07:00:00Z', 5, [0, 100, 0, 0], { activity_type: 'Walk', sport_type: 'Walk' }),
      run('2026-10-28T09:00:00Z', 6, null),                                  // no HR split
      run('2026-10-30T07:00:00Z', 9, [20, 60, 20, 0]),
    ], WEEK)
    expect(rows).toHaveLength(1)
    expect(rows[0].z2).toBe(60)
  })
  it('is weighted by distance, so a long run counts for more than a short one', () => {
    const split = zoneTimeSplit(weekZoneSplitRows([
      run('2026-10-27T07:00:00Z', 30, [0, 100, 0, 0]),
      run('2026-10-28T07:00:00Z', 10, [0, 0, 100, 0]),
    ], WEEK)).split!
    expect(split.z2).toBeCloseTo(75, 5)
    expect(split.z3).toBeCloseTo(25, 5)
  })
  it('the same run from two sources is counted once', () => {
    const a = run('2026-10-27T07:00:00Z', 8, [0, 100, 0, 0])
    const b = { ...run('2026-10-27T07:00:30Z', 8, [0, 100, 0, 0]), apple_health_uuid: null, strava_activity_id: 42 }
    expect(weekZoneSplitRows([a, b], WEEK)).toHaveLength(1)
  })
  it('no week, no rows', () => {
    expect(weekZoneSplitRows([run('2026-10-27T07:00:00Z', 8, [0, 100, 0, 0])], null)).toEqual([])
  })
})

describe('wiring', () => {
  const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it('🔴 the rings read the activity log, not run_analysis', () => {
    expect(shell).toMatch(/const zoneHistogramRows = weekZoneSplitRows\(recentActivity \?\? \[\], currentWeek/)
    const i = shell.indexOf('const zoneHistogramRows')
    expect(shell.slice(i, i + 200)).not.toMatch(/runAnalysisMap/)
  })
  it('the activity read selects the zone columns', () => {
    const i = shell.indexOf('[coach] load picture read failed')
    const block = shell.slice(shell.lastIndexOf("supabase.from('strava_activities')", i), i)
    for (const c of ['hr_pct_z1', 'hr_pct_z2', 'hr_pct_z3', 'hr_pct_z4_5']) expect(block).toContain(c)
  })
  it('the rings hold their skeleton until the read returns', () => {
    expect(shell).toContain('runAnalysisReady={runAnalysisReady && recentActivity !== null}')
  })
})

describe('COACH-CODE-HYGIENE-01 (non-visual part)', () => {
  const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it('Coach no longer pays for a trend gloss it never shows', () => {
    const i = shell.indexOf("session_type:  'easy'")
    expect(i).toBeGreaterThan(0)
    const params = shell.slice(i, shell.indexOf('})', i))
    expect(params).not.toMatch(/include_gloss:\s*'true'/)
    // …because the card on Coach is glossless. If that ever changes, the gloss must be asked for again.
    expect(shell).toMatch(/preferredUnits=\{preferredUnits\}\s*\n\s*glossless/)
  })
})
