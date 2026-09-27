// LOG-OFFPLAN-01 — the owner's gate (Coaching Board 2026-09-27).
//
// Every arm here was falsified before being trusted: see the FALSIFICATION
// block at the foot of the file for what was broken and what went red.

import { describe, it, expect } from 'vitest'
import {
  activityKey, dedupeRuns, bucketLoadByPlanWeek, priorWeeks,
  type ActivityLogRow,
} from './weeklyActualLoad'

const plan = {
  weeks: [
    { n: 1, date: '2026-09-07', weekly_km: 30 },
    { n: 2, date: '2026-09-14', weekly_km: 33 },
    { n: 3, date: '2026-09-21', weekly_km: 36 },
  ],
} as any

const run = (date: string, km: number, over: Partial<ActivityLogRow> = {}): ActivityLogRow => ({
  start_date: `${date}T09:00:00.000Z`,
  distance_m: km * 1000,
  activity_type: 'Run',
  sport_type: 'Run',
  strava_activity_id: null,
  apple_health_uuid: `hk-${date}-${km}`,
  ...over,
})

describe('activityKey', () => {
  it('prefers the strava id, falls back to the HealthKit uuid', () => {
    expect(activityKey({ strava_activity_id: 7, apple_health_uuid: 'u' })).toBe('s:7')
    expect(activityKey({ strava_activity_id: null, apple_health_uuid: 'u' })).toBe('h:u')
  })

  it('🔴 returns null when a row carries NEITHER id — it can never be matched', () => {
    // Production has 16 such rows. A key of '' would collide them all into one
    // bucket and make them look linked to each other.
    expect(activityKey({ strava_activity_id: null, apple_health_uuid: null })).toBeNull()
  })
})

describe('dedupeRuns', () => {
  it('🔴 collapses the same run ingested from two sources', () => {
    // The real production shape: 29.2 km logged by Strava and by Connect, a
    // few minutes apart, distances differing by less than 3%.
    const rows = [
      run('2026-09-21', 29.20, { apple_health_uuid: null, strava_activity_id: 1 }),
      { ...run('2026-09-21', 29.17, { apple_health_uuid: 'hk-x', strava_activity_id: null }),
        start_date: '2026-09-21T09:04:00.000Z' },
    ]
    expect(dedupeRuns(rows)).toHaveLength(1)
  })

  it('keeps the LONGER record — a truncated duplicate must not shrink the week', () => {
    const rows = [run('2026-09-21', 10.0, { strava_activity_id: 1, apple_health_uuid: null }),
                  run('2026-09-21', 10.2, { strava_activity_id: null })]
    expect(dedupeRuns(rows)[0].distance_m).toBe(10200)
  })

  it('🔴 does NOT collapse a genuine double day', () => {
    // Wroblewski's case: two real runs, same distance, hours apart.
    const rows = [
      { ...run('2026-09-21', 5), start_date: '2026-09-21T07:00:00.000Z' },
      { ...run('2026-09-21', 5), start_date: '2026-09-21T18:00:00.000Z', apple_health_uuid: 'hk-pm' },
    ]
    expect(dedupeRuns(rows)).toHaveLength(2)
  })

  it('does not collapse two runs of clearly different length at the same time', () => {
    const rows = [run('2026-09-21', 5), run('2026-09-21', 12)]
    expect(dedupeRuns(rows)).toHaveLength(2)
  })
})

describe('bucketLoadByPlanWeek', () => {
  it('splits linked from off-plan and totals them', () => {
    const rows = [run('2026-09-08', 10), run('2026-09-10', 6)]
    const load = bucketLoadByPlanWeek(plan, rows, new Set(['h:hk-2026-09-08-10']))
    expect(load.get(1)).toEqual({ linkedKm: 10, offPlanKm: 6, totalKm: 16 })
  })

  it('🔴 a run with NO ids counts as off-plan, never as linked', () => {
    const rows = [run('2026-09-08', 8, { apple_health_uuid: null, strava_activity_id: null })]
    expect(bucketLoadByPlanWeek(plan, rows, new Set()).get(1)).toEqual(
      { linkedKm: 0, offPlanKm: 8, totalKm: 8 })
  })

  it('🔴 DROPS runs that predate the plan — 79% of the raw production figure', () => {
    // getWeekIndexForDate falls back to week 0 for an earlier date, so without
    // the window guard this 12 km lands in week 1 as off-plan volume the runner
    // never did during the block. This is the 63.5% -> 26.9% correction.
    const load = bucketLoadByPlanWeek(plan, [run('2026-08-20', 12)], new Set())
    expect(load.get(1)).toBeUndefined()
    expect(load.size).toBe(0)
  })

  it('🔴 drops runs AFTER the plan ends, for the same reason', () => {
    expect(bucketLoadByPlanWeek(plan, [run('2026-10-05', 9)], new Set()).size).toBe(0)
  })

  it('keys by week.n, not array position (ADR-013)', () => {
    const shifted = { weeks: [{ n: 41, date: '2026-09-07' }, { n: 42, date: '2026-09-14' }] } as any
    const load = bucketLoadByPlanWeek(shifted, [run('2026-09-15', 5)], new Set())
    expect(load.has(42)).toBe(true)
    expect(load.has(2)).toBe(false)
  })

  it('ignores non-run activities', () => {
    const rows = [run('2026-09-08', 40, { activity_type: 'Ride', sport_type: 'Ride' })]
    expect(bucketLoadByPlanWeek(plan, rows, new Set()).size).toBe(0)
  })

  it('dedupes BEFORE bucketing, so a double-ingested run counts once', () => {
    const rows = [
      run('2026-09-08', 10, { strava_activity_id: 1, apple_health_uuid: null }),
      run('2026-09-08', 10, { strava_activity_id: null, apple_health_uuid: 'hk-dup' }),
    ]
    expect(bucketLoadByPlanWeek(plan, rows, new Set()).get(1)!.totalKm).toBe(10)
  })

  it('returns an empty map for a plan with no weeks', () => {
    expect(bucketLoadByPlanWeek({ weeks: [] } as any, [run('2026-09-08', 5)], new Set()).size).toBe(0)
  })
})

describe('priorWeeks', () => {
  const loads = new Map([
    [1, { linkedKm: 20, offPlanKm: 5,  totalKm: 25 }],
    [2, { linkedKm: 24, offPlanKm: 0,  totalKm: 24 }],
    [3, { linkedKm: 28, offPlanKm: 10, totalKm: 38 }],
  ])

  it('returns prior weeks most-recent first, LINKED by default', () => {
    expect(priorWeeks(loads, 4, 4)).toEqual([28, 24, 20])
  })

  it('excludes the current week and anything after it', () => {
    expect(priorWeeks(loads, 2, 4)).toEqual([20])
  })

  it('🔴 the default is LINKED, not total — clause 2 lives in this default', () => {
    // The ratio auto-trims. If this ever defaults to totalKm, an off-plan run
    // silently shrinks next week, which is exactly what the board forbade.
    expect(priorWeeks(loads, 4, 4)).not.toEqual([38, 24, 25])
    expect(priorWeeks(loads, 4, 4, w => w.totalKm)).toEqual([38, 24, 25])
  })
})

/**
 * 🥇 FALSIFICATION — each arm broken, and what went red.
 *
 * 1. `activityKey` returning '' instead of null for a no-id row
 *    → "returns null when a row carries NEITHER id" RED.
 * 2. `dedupeRuns` window 20 -> 720 mins
 *    → "does NOT collapse a genuine double day" RED.
 * 3. `dedupeRuns` keeping the FIRST rather than the longer row
 *    → "keeps the LONGER record" RED.
 * 4. Removing the `isInsidePlanWeek` guard
 *    → "DROPS runs that predate the plan" RED (12 km landed in week 1).
 * 5. `priorWeeks` default `pick` switched to `w => w.totalKm`
 *    → "the default is LINKED, not total" RED. This is the clause-2 arm.
 * 6. Control: renaming an unrelated local in the module — all arms stayed GREEN,
 *    which is what shows these are keyed to the claims and not to "any change".
 */
