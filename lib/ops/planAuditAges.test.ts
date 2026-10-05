import { describe, it, expect } from 'vitest'
import { summarisePlanAges, ageDays } from './planAuditAges'

const NOW = new Date('2026-10-04T13:29:11Z').getTime()
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString()

/**
 * PLAN-AUDIT-AGE-SOURCE-01 — the metric was named for one timestamp and computed from
 * another, and that produced a false alarm in the 2026-10-05 digest.
 *
 * The first arm below IS the incident, with its real numbers: a plan created
 * 2026-04-21 and rewritten by the race-week remediation on 2026-10-03 was reported in
 * the "0-1d" freshness bucket, and the digest's escalation rule reads that bucket as
 * "the current engine has recently produced a bad plan".
 */
describe('summarisePlanAges — creation age and modification age are different questions', () => {
  it('🔴 THE INCIDENT: a 166-day-old plan touched yesterday is NOT a fresh plan', () => {
    const s = summarisePlanAges([{ created_at: daysAgo(166), updated_at: daysAgo(1) }], NOW)
    // By CREATION it is ancient — this is what the escalation rule must read.
    expect(s.newest_invalid_plan_age_days).toBe(166)
    expect(s.invalid_by_plan_age['31d+']).toBe(1)
    expect(s.invalid_by_plan_age['0-1d']).toBe(0)
    // The modification signal is preserved, not discarded.
    expect(s.newest_invalid_modified_age_days).toBe(1)
    // And the divergence is COUNTED, so it cannot be rediscovered as an anomaly.
    expect(s.modified_recently_but_older).toBe(1)
  })

  it('a genuinely fresh bad plan still reads as fresh — the signal that matters', () => {
    const s = summarisePlanAges([{ created_at: daysAgo(0), updated_at: daysAgo(0) }], NOW)
    expect(s.newest_invalid_plan_age_days).toBe(0)
    expect(s.invalid_by_plan_age['0-1d']).toBe(1)
    // Created today AND modified today is not a divergence.
    expect(s.modified_recently_but_older).toBe(0)
  })

  it('reproduces the 2026-10-04 run: 10 old remediated plans + 1 real new one', () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => ({ created_at: daysAgo(63 + i * 10), updated_at: daysAgo(1) })),
      { created_at: daysAgo(1), updated_at: daysAgo(1) },
    ]
    const s = summarisePlanAges(rows, NOW)
    // Under the OLD behaviour all eleven landed in 0-1d. Now only the real one does.
    expect(s.invalid_by_plan_age['0-1d']).toBe(1)
    expect(s.newest_invalid_plan_age_days).toBe(1)
    expect(s.modified_recently_but_older).toBe(10)
  })

  it('takes the MINIMUM age, not the first row — order must not decide the answer', () => {
    const s = summarisePlanAges([
      { created_at: daysAgo(90), updated_at: daysAgo(90) },
      { created_at: daysAgo(2), updated_at: daysAgo(2) },
      { created_at: daysAgo(40), updated_at: daysAgo(40) },
    ], NOW)
    expect(s.newest_invalid_plan_age_days).toBe(2)
    expect(s.newest_invalid_modified_age_days).toBe(2)
  })

  it('an empty fleet reports null, never 0 — "no breaching plans" is not "one breaching today"', () => {
    const s = summarisePlanAges([], NOW)
    expect(s.newest_invalid_plan_age_days).toBeNull()
    expect(s.newest_invalid_modified_age_days).toBeNull()
    expect(Object.values(s.invalid_by_plan_age).every(n => n === 0)).toBe(true)
  })

  it('buckets are exhaustive and non-overlapping — every plan is counted exactly once', () => {
    const rows = [0, 1, 2, 7, 8, 30, 31, 400].map(d => ({ created_at: daysAgo(d), updated_at: daysAgo(d) }))
    const s = summarisePlanAges(rows, NOW)
    expect(Object.values(s.invalid_by_plan_age).reduce((a, b) => a + b, 0)).toBe(rows.length)
    expect(s.invalid_by_plan_age).toEqual({ '0-1d': 2, '2-7d': 2, '8-30d': 2, '31d+': 2 })
  })
})

describe('ageDays — a bad timestamp must not become a confident 0', () => {
  it('null/undefined/empty give null', () => {
    expect(ageDays(null, NOW)).toBeNull()
    expect(ageDays(undefined, NOW)).toBeNull()
    expect(ageDays('', NOW)).toBeNull()
  })

  it('an unparseable timestamp gives null, not 0', () => {
    // `new Date('nonsense').getTime()` is NaN, and NaN arithmetic floors to NaN —
    // which would have been reported as a number. 0 here would read as "brand new".
    expect(ageDays('not a date', NOW)).toBeNull()
  })

  it('a FUTURE timestamp gives null, not a negative or a 0', () => {
    expect(ageDays(new Date(NOW + 86_400_000).toISOString(), NOW)).toBeNull()
  })

  it('a row with no usable timestamp is excluded, and does not become the minimum', () => {
    const s = summarisePlanAges([
      { created_at: null, updated_at: null },
      { created_at: daysAgo(50), updated_at: daysAgo(50) },
    ], NOW)
    expect(s.newest_invalid_plan_age_days).toBe(50)
  })
})
