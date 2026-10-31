// COACH-EFFORT-PICTURE-01 / §132 — what kind of run was this, by time in zone, never by average heart rate.
import { describe, it, expect } from 'vitest'
import { runEffortKind, effortRecord, plannedTypeByActivity } from './runEffort'

const run = (z1: number, z2: number, z3: number, z45: number) => ({ hr_pct_z1: z1, hr_pct_z2: z2, hr_pct_z3: z3, hr_pct_z4_5: z45 })

describe('runEffortKind', () => {
  it('a run mostly in Zone 3 is grey', () => {
    // The founder's 23 Aug 9.3 km: 0 / 34 / 59 / 6.
    expect(runEffortKind(run(0, 34.38, 59.38, 6.25))).toBe('grey')
  })

  it('🔴 an interval-shaped run is split, even though its average heart rate would sit in Zone 3', () => {
    expect(runEffortKind(run(10, 30, 25, 35))).toBe('split')
  })

  it('🔴 a linked tempo is planned, never grey: the engine prescribes Zone 3', () => {
    expect(runEffortKind(run(0, 20, 70, 10), 'quality')).toBe('planned')
    expect(runEffortKind(run(0, 20, 70, 10), 'easy')).toBe('grey')
  })

  it('mostly easy is easy, mostly Zone 4–5 is hard, ties go to the easier side', () => {
    expect(runEffortKind(run(5.88, 76.47, 17.65, 0))).toBe('easy')
    expect(runEffortKind(run(0, 19.23, 34.62, 46.15))).toBe('hard')
    expect(runEffortKind(run(0, 50, 50, 0))).toBe('easy')
    expect(runEffortKind(run(0, 0, 50, 50))).toBe('grey')
  })

  it('no split is unknown, never easy', () => {
    expect(runEffortKind({ hr_pct_z1: null, hr_pct_z2: null, hr_pct_z3: null, hr_pct_z4_5: null })).toBe('unknown')
    expect(runEffortKind(run(0, 0, 0, 0))).toBe('unknown')
    expect(runEffortKind(run(NaN, NaN, NaN, NaN))).toBe('unknown')
  })

  it('the split line is inclusive at exactly 25% easy and 25% hard', () => {
    expect(runEffortKind(run(0, 25, 50, 25))).toBe('split')
    expect(runEffortKind(run(0, 24, 51, 25))).toBe('grey')
  })
})

describe('effortRecord', () => {
  const row = (date: string, z: [number, number, number, number], extra: Record<string, unknown> = {}) => ({
    start_date: date, distance_m: 8000, activity_type: 'Run', sport_type: 'Run', strava_activity_id: null, apple_health_uuid: `u-${date}`,
    hr_pct_z1: z[0], hr_pct_z2: z[1], hr_pct_z3: z[2], hr_pct_z4_5: z[3], ...extra,
  })
  const week = { date: '2026-10-26' }

  it('keeps the window of N plan weeks ending this week, oldest first, and marks this week', () => {
    const out = effortRecord([
      row('2026-10-28T07:00:00Z', [0, 10, 60, 30]),
      row('2026-09-01T07:00:00Z', [0, 90, 10, 0]),   // before the 8-week window (it opens 7 Sep)
      row('2026-09-08T07:00:00Z', [0, 90, 10, 0]),
      row('2026-11-03T07:00:00Z', [0, 90, 10, 0]),   // after this week
    ], week, 8)
    expect(out.map(r => r.date.slice(0, 10))).toEqual(['2026-09-08', '2026-10-28'])
    expect(out.map(r => r.thisWeek)).toEqual([false, true])
    expect(out[1].kind).toBe('grey')
  })

  it('drops non-runs and runs without a split', () => {
    const out = effortRecord([
      row('2026-10-27T07:00:00Z', [0, 90, 10, 0], { activity_type: 'Ride', sport_type: 'Ride' }),
      row('2026-10-27T09:00:00Z', [null, null, null, null] as any),
    ], week, 8)
    expect(out).toEqual([])
  })

  it('🔴 a run linked to a planned quality session is planned, not grey', () => {
    const plan = { weeks: [{ n: 2, sessions: { tue: { type: 'quality' } } }] }
    const types = plannedTypeByActivity([{ week_n: 2, session_day: 'tue', apple_health_uuid: 'u-2026-10-27T07:00:00Z' }], plan)
    const out = effortRecord([row('2026-10-27T07:00:00Z', [0, 10, 70, 20])], week, 8, types)
    expect(out[0].kind).toBe('planned')
  })
})
