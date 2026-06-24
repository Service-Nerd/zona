import { describe, it, expect } from 'vitest'
import { decideLateArrival } from './lateArrivalGate'
import { PENDING_HR_WINDOW_HOURS } from './hrPending'

/**
 * Hutchinson late-arrival gate: when HR arrives on a previously HR-null row,
 * within `PENDING_HR_WINDOW_HOURS` we re-fire analyse-run (fresh coaching);
 * outside the window we patch HR columns only (no stale reframe). This test
 * locks the boundary so a future refactor can't silently invert it.
 */
describe('decideLateArrival', () => {
  const baseNow = new Date('2026-06-24T18:00:00Z')
  const oneHourMs = 60 * 60 * 1000

  it('considers a workout that ended 5 minutes ago as within the fresh window', () => {
    const start = new Date(baseNow.getTime() - 35 * 60 * 1000).toISOString()
    const d = decideLateArrival({ workoutStartIso: start, durationSeconds: 30 * 60 }, baseNow)
    expect(d.withinFreshWindow).toBe(true)
    expect(d.secondsSinceEnd).toBe(5 * 60)
  })

  it('considers a workout that ended exactly at the boundary as within the fresh window', () => {
    // Run end is exactly 24h before now
    const start = new Date(baseNow.getTime() - (PENDING_HR_WINDOW_HOURS * oneHourMs + 30 * 60 * 1000)).toISOString()
    const d = decideLateArrival({ workoutStartIso: start, durationSeconds: 30 * 60 }, baseNow)
    expect(d.withinFreshWindow).toBe(true)
    expect(d.secondsSinceEnd).toBe(PENDING_HR_WINDOW_HOURS * 60 * 60)
  })

  it('considers a workout that ended just past the boundary as STALE (no fresh coaching)', () => {
    const start = new Date(baseNow.getTime() - (PENDING_HR_WINDOW_HOURS * oneHourMs + 30 * 60 * 1000 + 1000)).toISOString()
    const d = decideLateArrival({ workoutStartIso: start, durationSeconds: 30 * 60 }, baseNow)
    expect(d.withinFreshWindow).toBe(false)
    expect(d.secondsSinceEnd).toBe(PENDING_HR_WINDOW_HOURS * 60 * 60 + 1)
  })

  it('considers a 2-day-late HR arrival as stale (matches the founder-Row-3 case)', () => {
    // Workout was June 7, now is June 9 — 2 days later
    const now   = new Date('2026-06-09T18:44:58Z')
    const start = new Date('2026-06-07T08:04:03Z').toISOString()
    const d = decideLateArrival({ workoutStartIso: start, durationSeconds: 12_691 }, now)
    expect(d.withinFreshWindow).toBe(false)
  })

  it('falls back to "fresh" when start_date is unparseable (never silently drops coaching on parse glitch)', () => {
    const d = decideLateArrival({ workoutStartIso: 'not-a-date', durationSeconds: 1800 }, baseNow)
    expect(d.withinFreshWindow).toBe(true)
    expect(d.secondsSinceEnd).toBe(0)
  })

  it('clamps secondsSinceEnd at 0 for future-dated workouts (clock skew)', () => {
    const start = new Date(baseNow.getTime() + 60 * 1000).toISOString()
    const d = decideLateArrival({ workoutStartIso: start, durationSeconds: 1800 }, baseNow)
    expect(d.secondsSinceEnd).toBe(0)
    expect(d.withinFreshWindow).toBe(true)
  })
})
