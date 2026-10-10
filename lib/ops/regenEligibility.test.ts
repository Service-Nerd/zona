// REGEN-LIVE-PLAN-GUARD-01 — the two guards that were missing when a live plan was rewritten.
//
// 🔴 THE INCIDENT, 2026-10-10. The fleet regen script rewrote plan `8333720c` — a real
// runner in **week 8 of 14 with a race five and a half weeks away**. It passed every guard
// the script had. The founder approved the run on my briefing that "none of these plans has
// started", which was true of the five I measured and false of the seventh. Restored from
// `plan_archive` byte-for-byte; six other repairs stood.
import { describe, it, expect } from 'vitest'
import { regenRefusalReason, type RegenCandidate } from './regenEligibility'

const TODAY = '2026-10-10'

/** The safe case: a future race AND a future start, no activity of any kind. */
const safe = (over: Partial<RegenCandidate> = {}): RegenCandidate => ({
  planStart: '2026-12-07', raceDate: '2027-04-24', hasGeneratorInput: true,
  isAdmin: false, hasCompletions: false, hasRunAnalysis: false, hasActivities: false,
  ...over,
})

describe('REGEN-LIVE-PLAN-GUARD-01', () => {
  it('1. the five §93 marathons remain eligible — not a wall', () => {
    // Vacuity arm. If this refuses, every arm below passes for the wrong reason.
    expect(regenRefusalReason(safe(), TODAY)).toBeNull()
  })

  it('2. 🔴 THE REAL RUNNER: week 8 of 14, race 18 Nov — now REFUSED', () => {
    // `8333720c` exactly as it was: race in the future, block already under way.
    expect(regenRefusalReason(
      safe({ planStart: '2026-08-17', raceDate: '2026-11-18', hasActivities: true }), TODAY,
    )).toBe('plan-already-started')
  })

  it('3. 🔴 a future RACE is not a future START — the guard that did not exist', () => {
    // The old script tested only `raceDate >= today`. This is the gap, isolated: no
    // activity at all, so the activity fix alone would NOT have caught it.
    expect(regenRefusalReason(safe({ planStart: '2026-10-09' }), TODAY)).toBe('plan-already-started')
    expect(regenRefusalReason(safe({ planStart: TODAY }), TODAY),
      'a block starting TODAY is under way').toBe('plan-already-started')
    expect(regenRefusalReason(safe({ planStart: '2026-10-11' }), TODAY),
      'tomorrow has not started').toBeNull()
  })

  it('4. 🔴 STRAVA ACTIVITY COUNTS — the signal the old filter could not see', () => {
    // This runner syncs runs and never taps "done". The old check tested
    // session_completions and run_analysis only, so they read as dormant.
    expect(regenRefusalReason(safe({ hasActivities: true }), TODAY)).toBe('has-activities')
    // ...and the other two still count, so this is an addition, not a replacement.
    expect(regenRefusalReason(safe({ hasCompletions: true }), TODAY)).toBe('has-completions')
    expect(regenRefusalReason(safe({ hasRunAnalysis: true }), TODAY)).toBe('has-run-analysis')
  })

  it('5. ⚠️ BOTH UNKNOWNS REFUSE — a missing field is never read as permission', () => {
    // The cost of declining a repair is a line in a report. The cost of rewriting a
    // live block is a runner's training. So absence must not mean "safe".
    for (const start of [undefined, null, '']) {
      expect(regenRefusalReason(safe({ planStart: start }), TODAY),
        `planStart=${JSON.stringify(start)} must be treated as STARTED`).toBe('plan-already-started')
    }
    for (const race of [undefined, null, '']) {
      expect(regenRefusalReason(safe({ raceDate: race }), TODAY),
        `raceDate=${JSON.stringify(race)} must be treated as PAST`).toBe('past-race')
    }
  })

  it('6. the pre-existing guards are intact', () => {
    expect(regenRefusalReason(safe({ raceDate: '2026-09-01' }), TODAY)).toBe('past-race')
    expect(regenRefusalReason(safe({ hasGeneratorInput: false }), TODAY)).toBe('no-generator-input')
    expect(regenRefusalReason(safe({ isAdmin: true }), TODAY)).toBe('is-admin')
  })

  it('7. a past race is reported before anything else — cheapest, most absolute fact', () => {
    // Order matters for the REPORT: "this plan is in the past" beats "this user is busy".
    expect(regenRefusalReason(
      safe({ raceDate: '2026-01-01', planStart: '2025-09-01', hasActivities: true, isAdmin: true }),
      TODAY,
    )).toBe('past-race')
  })
})
