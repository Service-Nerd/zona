import { describe, it, expect } from 'vitest'
import { classifyHrPending, isHrPending, PENDING_HR_WINDOW_HOURS } from './hrPending'

/**
 * HR-SYNC-01 pending-state classification.
 *
 * The 24h boundary is the point where the product position flips: inside the
 * window we're "still expecting Apple sync to land", outside we offer the
 * user a manual retry and stop waiting passively. Changing the boundary
 * affects the late-arrival gate too — they share `PENDING_HR_WINDOW_HOURS`.
 */
describe('classifyHrPending', () => {
  const baseNow = new Date('2026-06-24T18:00:00Z')
  const oneHourMs = 60 * 60 * 1000

  it('returns has-hr when avg_hr is present', () => {
    expect(classifyHrPending({
      source:        'apple_health',
      avg_hr:        135,
      start_date:    '2026-06-24T17:00:00Z',
      moving_time_s: 1800,
    }, baseNow)).toBe('has-hr')
  })

  it('returns not-applicable for non-HK rows', () => {
    expect(classifyHrPending({
      source:        'strava',
      avg_hr:        null,
      start_date:    '2026-06-24T17:00:00Z',
      moving_time_s: 1800,
    }, baseNow)).toBe('not-applicable')
  })

  it('returns not-applicable when start_date is missing', () => {
    expect(classifyHrPending({
      source:        'apple_health',
      avg_hr:        null,
      start_date:    null,
      moving_time_s: 1800,
    }, baseNow)).toBe('not-applicable')
  })

  it('returns pending for HR-null HK row inside the 24h window', () => {
    // Run ended 5 min ago
    const start = new Date(baseNow.getTime() - 65 * 60 * 1000).toISOString()
    expect(classifyHrPending({
      source:        'apple_health',
      avg_hr:        null,
      start_date:    start,
      moving_time_s: 60 * 60,  // 1h run
    }, baseNow)).toBe('pending')
  })

  it('returns pending exactly at the 24h boundary', () => {
    // Run end is exactly 24h before now
    const start = new Date(baseNow.getTime() - (PENDING_HR_WINDOW_HOURS * oneHourMs + 30 * 60 * 1000)).toISOString()
    expect(classifyHrPending({
      source:        'apple_health',
      avg_hr:        null,
      start_date:    start,
      moving_time_s: 30 * 60,  // 30 min run → end is exactly 24h ago
    }, baseNow)).toBe('pending')
  })

  it('returns fallback just past the 24h boundary', () => {
    // Run end is 24h + 1s before now
    const start = new Date(baseNow.getTime() - (PENDING_HR_WINDOW_HOURS * oneHourMs + 30 * 60 * 1000 + 1000)).toISOString()
    expect(classifyHrPending({
      source:        'apple_health',
      avg_hr:        null,
      start_date:    start,
      moving_time_s: 30 * 60,
    }, baseNow)).toBe('fallback')
  })

  it('returns pending when clock skew makes the run appear to be in the future', () => {
    // start_date is in the future relative to now — treat as fresh
    const start = new Date(baseNow.getTime() + 60 * 1000).toISOString()
    expect(classifyHrPending({
      source:        'apple_health',
      avg_hr:        null,
      start_date:    start,
      moving_time_s: 1800,
    }, baseNow)).toBe('pending')
  })

  it('isHrPending is true for both pending and fallback states', () => {
    const pendingInput = {
      source:        'apple_health' as const,
      avg_hr:        null,
      start_date:    new Date(baseNow.getTime() - 30 * 60 * 1000).toISOString(),
      moving_time_s: 1800,
    }
    expect(isHrPending(pendingInput, baseNow)).toBe(true)

    const fallbackInput = {
      ...pendingInput,
      start_date: new Date(baseNow.getTime() - 48 * oneHourMs).toISOString(),
    }
    expect(isHrPending(fallbackInput, baseNow)).toBe(true)
  })

  it('isHrPending is false when HR is present', () => {
    expect(isHrPending({
      source:        'apple_health',
      avg_hr:        135,
      start_date:    new Date(baseNow.getTime() - 30 * 60 * 1000).toISOString(),
      moving_time_s: 1800,
    }, baseNow)).toBe(false)
  })
})
