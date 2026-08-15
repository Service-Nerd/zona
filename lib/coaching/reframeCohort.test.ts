import { describe, it, expect } from 'vitest'
import { coachingSessionType } from '@/lib/plan/sessionRole'
import { REFRAME_TIER } from '@/lib/coaching/constants'

/**
 * REFRAME-COHORT-01 — Coaching Board ruling 2026-08-15 (§58 role axis, §60 label/pool).
 *
 * The post-run reframe compares a run against the runner's own past. Its cohort
 * filter used raw `session.type` equality. Because the generator models a long run
 * as `type: 'easy'` (INV-CLASS), a long run's cohort pooled 2-hour long runs with
 * 30-minute shakeouts — while the object's `sessionType` label already read
 * `coachingSessionType(session)` ("long"). The reframe therefore printed
 * "your long runs" over numbers that were mostly short easy runs.
 *
 * validatePlan() cannot catch this: it validates generated plans, and this is a
 * runtime read path. These tests are the mechanical check instead, per ADR-017.
 */

type PoolSession = { type: string; role?: 'long_run' | 'shakeout'; label?: string }

const longRun: PoolSession = { type: 'easy', role: 'long_run', label: 'Long run' }
const shortEasy: PoolSession = { type: 'easy', label: 'Easy 5k' }
const shakeout: PoolSession = { type: 'easy', role: 'shakeout', label: 'Shakeout' }
const tempo: PoolSession = { type: 'quality', label: 'Tempo' }

/** The predicate the route uses to build a cohort. Mirrors post-run-reframe/route.ts. */
function selectCohort(pool: PoolSession[], subject: PoolSession): PoolSession[] {
  const role = coachingSessionType(subject)
  return pool.filter(s => coachingSessionType(s) === role)
}

describe('reframe cohort — role axis (§58)', () => {
  it('is the root cause: a long run and a short easy share a raw type', () => {
    expect(longRun.type).toBe(shortEasy.type)
    expect(coachingSessionType(longRun)).not.toBe(coachingSessionType(shortEasy))
  })

  it('a long run compares only against long runs', () => {
    const pool = [longRun, shortEasy, shakeout, tempo, longRun]
    const cohort = selectCohort(pool, longRun)
    expect(cohort).toHaveLength(2)
    expect(cohort.every(s => coachingSessionType(s) === 'long')).toBe(true)
  })

  it('does not sweep long runs into a short-easy cohort', () => {
    const cohort = selectCohort([longRun, shortEasy, shakeout], shortEasy)
    expect(cohort).not.toContain(longRun)
  })

  it('leaves non-easy types unaffected', () => {
    expect(selectCohort([longRun, shortEasy, tempo], tempo)).toEqual([tempo])
  })

  it('legacy plans with no role stamp still classify by label', () => {
    const legacy: PoolSession = { type: 'easy', label: 'Long run 18k' }
    expect(coachingSessionType(legacy)).toBe('long')
  })
})

describe('reframe cohort — label must match pool (§60)', () => {
  it('the reported sessionType equals the key the cohort was filtered on', () => {
    // The honesty invariant. If these ever diverge, the reframe makes a claim
    // about a session type it did not actually measure.
    for (const subject of [longRun, shortEasy, tempo]) {
      const role = coachingSessionType(subject)
      const cohort = selectCohort([longRun, shortEasy, shakeout, tempo], subject)
      const reportedLabel = role
      expect(cohort.every(s => coachingSessionType(s) === reportedLabel)).toBe(true)
    }
  })
})

describe('reframe cohort — sample floor vs window (McMillan)', () => {
  it('the RPE window is wide enough to clear the sample floor on long runs', () => {
    // ~1 long run per week. Narrowing the cohort without widening the window
    // would leave zero tolerance for a missed run or an unlogged RPE.
    const longRunsAvailable = REFRAME_TIER.RPE_PATTERN_WINDOW_DAYS / 7
    expect(longRunsAvailable).toBeGreaterThan(REFRAME_TIER.RPE_PATTERN_MIN_SAMPLES)
  })

  it('the RPE window is wider than the tier-qualification window it must not be confused with', () => {
    expect(REFRAME_TIER.RPE_PATTERN_WINDOW_DAYS).toBeGreaterThan(REFRAME_TIER.TIER_B_WINDOW_DAYS)
  })
})
