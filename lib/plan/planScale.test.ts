import { describe, it, expect } from 'vitest'
import { planScale } from './planScale'
import type { Plan, Session, Week } from '@/types/plan'

// FIRSTRUN-MOMENTS-01d + 01e.
//
// The two properties that matter are not "does it add up" — they are that it
// REFUSES rather than under-reports, and that a duration-anchored beginner plan
// (95.8% of their sessions) does not total to zero. `distance_km ?? 0` has cost
// this repo four measured defects; this is the surface where it would read as
// "you will run about 0 km", which is the exact opposite of the reframe.

const session = (s: Partial<Session>): Session => ({
  type: 'easy', label: 'Easy run', zone: 'Zone 2', hr_target: null,
  pace_target: '6:00–6:30 /km', distance_km: null, duration_mins: null,
  coach_notes: [], ...s,
} as unknown as Session)

const week = (n: number, date: string, sessions: Record<string, Session>): Week => ({
  n, date, label: `Week ${n}`, theme: '', type: 'normal',
  sessions, long_run_hrs: null, weekly_km: 0,
} as unknown as Week)

const plan = (weeks: Week[], raceKm = 42.2): Plan =>
  ({ meta: { race_distance_km: raceKm }, weeks } as unknown as Plan)

describe('planScale — the honest size of the plan', () => {
  it('totals a DISTANCE-anchored plan and keeps the race decimals', () => {
    const p = plan([
      week(1, '2027-01-04', { mon: session({ distance_km: 10 }), sat: session({ distance_km: 12 }) }),
      week(2, '2027-01-11', { mon: session({ distance_km: 10 }) }),
    ])
    const s = planScale(p)
    // 32 km rounds to the nearest 10 — the sentence says "about".
    // NOTE the spacing is `formatDistance`'s, not ours — it is the ADR-015
    // owner and every other surface in the app reads "6km". The test yields to
    // the owner rather than the owner yielding to the test.
    expect(s?.totalDistance).toBe('30km')
    // ADR-015: race distances keep their iconic decimals.
    expect(s?.raceDistance).toBe('42.2km')
  })

  it('🔴 a DURATION-anchored beginner plan does NOT total zero', () => {
    // The defect this test exists for. Every session is duration-anchored with
    // no distance_km, which `distance_km ?? 0` reads as no ground covered.
    const p = plan([
      week(1, '2027-01-04', {
        mon: session({ duration_mins: 30 }),
        sat: session({ duration_mins: 60, role: 'long_run' } as Partial<Session>),
      }),
    ])
    const s = planScale(p)
    expect(s).not.toBeNull()
    expect(s!.totalDistance).not.toMatch(/^0\b/)
  })

  it('names the longest run and the month it falls in', () => {
    const p = plan([
      week(1, '2027-01-04', { sat: session({ duration_mins: 60, role: 'long_run' } as Partial<Session>) }),
      week(9, '2027-03-08', { sat: session({ duration_mins: 208, role: 'long_run' } as Partial<Session>) }),
    ])
    const s = planScale(p)
    // ADR-015 — "3h 28", never "208 minutes".
    expect(s?.hardestRun).toBe('3h 28')
    expect(s?.hardestMonth).toBe('March')
  })

  it('reads the month from the STRING, so a timezone cannot shift it', () => {
    // `new Date('2027-03-01')` is UTC midnight and renders as February in any
    // negative-offset timezone. A substring read cannot.
    const p = plan([
      week(1, '2027-03-01', { sat: session({ duration_mins: 100, role: 'long_run' } as Partial<Session>) }),
    ])
    expect(planScale(p)?.hardestMonth).toBe('March')
  })

  it('the RACE is inside the total, which is what "of it" claims', () => {
    const p = plan([
      week(1, '2027-01-04', { mon: session({ distance_km: 10 }) }),
      week(2, '2027-04-25', { sun: session({ type: 'race', distance_km: 42.2 }) }),
    ])
    // 52.2 -> 50. If the race were excluded this would be 10.
    expect(planScale(p)?.totalDistance).toBe('50km')
  })

  it('a race session is not mistaken for the longest RUN', () => {
    const p = plan([
      week(1, '2027-01-04', { sat: session({ duration_mins: 90, role: 'long_run' } as Partial<Session>) }),
      week(2, '2027-04-25', { sun: session({ type: 'race', distance_km: 42.2, duration_mins: 300 }) }),
    ])
    // The race is the point, not a training ask. 90 min, not 300.
    expect(planScale(p)?.hardestRun).toBe('1h 30')
  })

  it('REFUSES rather than under-reporting when a distance cannot be resolved', () => {
    // Duration-anchored AND no pace to convert with. A partial total would
    // quietly under-state the size of the plan, which makes the reframe a lie.
    const p = plan([
      week(1, '2027-01-04', {
        mon: session({ distance_km: 10 }),
        tue: session({ duration_mins: 45, pace_target: undefined }),
      }),
    ])
    expect(planScale(p)).toBeNull()
  })

  it('honours the runner’s units', () => {
    const p = plan([week(1, '2027-01-04', { mon: session({ distance_km: 100 }) })])
    expect(planScale(p, 'mi')?.totalDistance).toMatch(/mi$/)
  })

  it('returns null for an empty plan rather than "about 0 km"', () => {
    expect(planScale(plan([]))).toBeNull()
    expect(planScale(plan([week(1, '2027-01-04', {})]))).toBeNull()
  })

  it('omits the longest-run line when there is no long run to name', () => {
    const p = plan([week(1, '2027-01-04', { mon: session({ distance_km: 5 }) })])
    const s = planScale(p)
    expect(s?.hardestRun).toBeNull()
    expect(s?.hardestMonth).toBeNull()
  })
})
