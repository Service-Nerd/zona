import { describe, it, expect } from 'vitest'
import { validatePlan, validateReshapedPlan } from './invariants'
import type { Plan, Week, Session, GeneratorInput } from '@/types/plan'

// A LEGACY plan — generated before GEN-FIX-03, so it ends well before race day
// (the F2 defect). Week 2 also carries pre-GEN-FIX-06 stale copy: a label that
// promises a quality session over three easy runs. Neither is the reshaper's
// doing; a within-week reshape can neither cause nor fix them.
const easy = { type: 'easy', label: 'Easy', distance_km: 6 } as unknown as Session

function legacyPlan(): Plan {
  const mkWeek = (n: number, date: string, label: string): Week => ({
    n,
    date,
    phase: 'build',
    label,
    theme: '',
    weekly_km: 24,
    sessions: { mon: easy, wed: easy, sat: easy },
  } as unknown as Week)

  return {
    meta: {
      race_date:        '2026-11-15',
      race_distance_km: 21.1,
      goal:             'finish',
      days_available:   3,
      age:              40,
    },
    weeks: [
      mkWeek(1, '2026-10-19', 'Build'),
      mkWeek(2, '2026-10-26', 'Build — first quality session'), // stale copy, untouched
      mkWeek(3, '2026-11-02', 'Build'),                          // final week ends 2026-11-08 < race
    ],
  } as unknown as Plan
}

const RESHAPE_INPUT: GeneratorInput = {
  race_date:             '2026-11-15',
  race_distance_km:      21.1,
  goal:                  'finish',
  current_weekly_km:     0,
  longest_recent_run_km: 0,
  days_available:        3,
  age:                   40,
  days_cannot_train:     [],
} as unknown as GeneratorInput

describe('validateReshapedPlan scoping (legacy-plan reshape regression)', () => {
  it('the fixture genuinely trips the race-date invariant at generation time', () => {
    // Guards the test itself: prove the plan WOULD flag COVERS-RACE-DATE under
    // the full generation-time validator, so the reshape suppression below is
    // real and not a fixture that never triggered it.
    const codes = validatePlan(legacyPlan(), RESHAPE_INPUT).map(v => v.code)
    expect(codes).toContain('INV-PLAN-COVERS-RACE-DATE')
  })

  it('does NOT report race-date / race-day defects on a reshape', () => {
    // A within-week reshape cannot change whether the plan reaches race day —
    // enforcing it here made every legacy plan emit a spurious reshape_invalid.
    const codes = validateReshapedPlan(legacyPlan()).map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-COVERS-RACE-DATE')
    expect(codes).not.toContain('INV-PLAN-RACE-ON-RACE-DAY')
  })

  it('ignores stale copy on a week the reshape did not touch', () => {
    // Reshaping week 3 must not surface week 2's pre-existing stale copy.
    const errors = validateReshapedPlan(legacyPlan(), 3)
      .filter(v => v.code === 'INV-PLAN-COPY-MATCHES-SESSIONS')
    expect(errors).toEqual([])
  })

  it('still catches stale copy on the week the reshape DID touch', () => {
    // The backstop for refreshWeekCopyIfStale must remain live on the reshaped
    // week — that is the whole point of keeping this invariant on the path.
    const errors = validateReshapedPlan(legacyPlan(), 2)
      .filter(v => v.code === 'INV-PLAN-COPY-MATCHES-SESSIONS' && v.week === 2)
    expect(errors.length).toBeGreaterThan(0)
  })
})
