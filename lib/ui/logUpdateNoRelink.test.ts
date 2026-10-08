// LOG-UPDATE-SILENT-RELINK-01 — "Update log" must never rewrite an existing link.
//
// 🔴 THE DEFECT. `handleMarkComplete` took its one-tap auto-match branch regardless of
// whether the session was already logged, and `saveCompletion` overwrites
// `strava_activity_id` / `apple_health_uuid`. So on an already-linked session the button
// wrote immediately with no picker, no confirmation and no visible change — and
// **silently relinked the session to a different run whenever the match resolved to a
// different activity.** The displaced record is unrecoverable from the UI.
//
// ⚠️ THE WINDOW IS NARROW AND THAT MAKES IT WORSE. `findMatchCandidates` matches within
// ±2 days of the session date, so this was reachable only while the session sat within
// two days of a pooled run — **exactly** the window in which a runner goes back in to
// add their RPE. The founder reproduced the PICKER path on 2026-10-08 on an older
// session, outside the window; inside it he would have seen nothing happen at all.
//
// ⚠️ AND THE BRANCH IS CORRECT WHEN UNLINKED, which is why the fix is a condition and
// not a deletion: it is the one-tap log path (POST-RUN-02 / AUTO-MATCH-02). **Both
// directions are asserted below**, because a gate that only proves the new behaviour
// would pass equally if the branch had been deleted outright.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveAutoMatch } from '@/lib/coaching/sessionAutoMatch'

const SRC = readFileSync('components/dashboard/SessionPopupInner.tsx', 'utf8')

/** The ±2 day window `findMatchCandidates` uses. */
const WEEK_START = '2026-10-05'      // Monday
const SESSION_KEY = 'wed'
const RUN_ON_THE_DAY = '2026-10-07T13:45:00.000Z'

const session = { type: 'easy', distance_km: 8, label: 'Easy run' }
const run = {
  id: 'run-A', type: 'Run', sport_type: 'Run',
  start_date: RUN_ON_THE_DAY, distance: 9880, moving_time: 3667,
}

describe('resolveAutoMatch cannot know the session is already logged', () => {
  // This is the root cause, asserted rather than described. If a completion argument is
  // ever added to the resolver, this arm is the one that should be revisited.
  it('matches a run inside the window with no knowledge of completion state', () => {
    const m = resolveAutoMatch(session, WEEK_START, SESSION_KEY, [run])
    expect(m).not.toBeNull()
    expect((m!.activity as { id: string }).id).toBe('run-A')
    // Its whole signature is session / week start / day key / activities.
    expect(resolveAutoMatch.length).toBe(4)
  })

  it('so the CALLER is the only place the completion state can be checked', () => {
    // Proving the resolver is innocent is half the claim; the other half is that the
    // caller now does the work. Asserted structurally below.
    expect(resolveAutoMatch(session, WEEK_START, SESSION_KEY, [])).toBeNull()
  })
})

describe('the caller gates on the existing link, in both directions', () => {
  it('the auto-match write is conditional on NOT already being linked', () => {
    expect(SRC).toContain('if (autoMatch && !isAlreadyLinked) {')
    // 🔴 The pre-fix form must not come back.
    expect(SRC).not.toMatch(/if \(autoMatch\) \{\s*\n\s*void saveCompletion\('complete', autoMatch\.activity\)/)
  })

  it('an already-linked session falls through to the picker instead of writing', () => {
    // The fall-through is the designed behaviour: show the runner the list rather than
    // changing their record behind them.
    const i = SRC.indexOf('if (autoMatch && !isAlreadyLinked) {')
    expect(i).toBeGreaterThan(-1)
    const after = SRC.slice(i, i + 220)
    expect(after).toContain("setView('complete')")
  })

  it('the UNLINKED one-tap path is preserved, not deleted', () => {
    // ⚠️ The arm that stops the fix becoming a regression. Removing the branch would
    // satisfy "never relinks" perfectly and would also remove the one-tap log.
    expect(SRC).toContain("void saveCompletion('complete', autoMatch.activity)")
  })

  it('the predicate reads BOTH id columns', () => {
    // ADR-011: HealthKit is the SOR and the common case. Reading only
    // `strava_activity_id` would leave every HK-linked session unguarded, which is the
    // same defect in a narrower population.
    const i = SRC.indexOf('const isAlreadyLinked')
    expect(i).toBeGreaterThan(-1)
    const decl = SRC.slice(i, SRC.indexOf('\n\n', i))
    expect(decl).toContain('strava_activity_id')
    expect(decl).toContain('apple_health_uuid')
  })

  it('the CTA above it stays gated on not-complete, which it always was', () => {
    // The button was never the problem; only this caller was ungated. If that guard
    // ever moves, the two paths disagree again.
    expect(SRC).toContain('if (!isComplete && !isSkipped) {')
  })
})
