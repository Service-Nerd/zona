// LOPSIDED-ORDER-01 (2026-09-20) — §52's lopsided-week detection must read the
// week the runner actually gets, not the week as it stood before §90
// Amendment 1's injury-quality yield pass shortened it.
//
// THE DEFECT. `lopsidedWeek` sat ~450 lines above the yield pass. That pass
// calls `applyWeekdayMinsCap` on the weeks it touches and then RECOMPUTES
// `w.weekly_km` from the surviving sessions. It trims easy runs and never
// trims the long run, so the long run's SHARE of the week can only rise. A
// week that read fine when §52 looked at it could cross the 60% cap
// afterwards — with the producer already committed to "not lopsided", so
// neither of §52's remedies fired and `INV-PLAN-LR-MAX-WEEKLY-PCT` reported
// the runner's plan as defective for a shape the engine had chosen.
//
// Measured on the 14,253-plan property sweep: 3 ERROR-severity violations,
// all three a Sunday long run at 61-62% of a week the yield pass had
// shortened. Distance-anchored on BOTH sides, which is what ruled out the
// other candidate divergence (the producer converts duration-anchored
// sessions at the runner's real easy pace, the checker self-paces them).
//
// ⚠️ WHY THIS TEST IS STRUCTURAL AND WHAT ALREADY COVERS THE BEHAVIOUR.
// The behavioural gate is `scripts/property-validate-plans.ts`, whose
// `INV-PLAN-LR-MAX-WEEKLY-PCT` baseline is now pinned at **0** — reintroducing
// the ordering fails the sweep, and the sweep runs inside `npm run verify`.
// What the sweep CANNOT do is say why, and its three cases come from a seeded
// random grid rather than a fixture anyone can read. This test names the
// invariant that must hold in the source so the next person moving code in
// `generateRulePlan` is told what the ordering is for, instead of finding out
// from a violation count three days later.
//
// ⚠️ IT ALSO RECORDS A VESTIGIAL CONSTRAINT. The yield pass still carries the
// comment "RUNS AFTER `finalVolumeProfile`, deliberately", because the
// invariant exempts maintenance plans. COMPLIANCE-FIX-3 (Coaching Board
// 2026-09-16) DELETED the `&& finalVolumeProfile !== 'maintenance'` gate that
// justified it. The reason outlived the code it protected, and on inspection
// it read as a circular dependency that would have blocked this fix. If the
// gate is ever restored, this test's premise changes and it should fail loudly
// rather than be deleted quietly.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'lib/plan/ruleEngine.ts'), 'utf8')

// The single site that re-states a week's volume after the yield trim.
const YIELD_RECOMPUTE = 'if (yieldedWeeks.includes(w.n)) w.weekly_km = sumWeeklyKm(w.sessions, pace)'
const LOPSIDED_DECL   = 'const lopsidedWeek = weeks.find(w => {'
const PROFILE_DECL    = "const finalVolumeProfile: 'build' | 'maintenance' | undefined ="

describe('LOPSIDED-ORDER-01 — §52 detection reads the delivered week', () => {
  it('both anchors still exist, so the test cannot pass by matching nothing', () => {
    // A source-shape assertion that silently stops matching is worse than no
    // assertion: it goes green forever. This repo has shipped that exact
    // failure (a guard iterating the same hand-written array it protected),
    // so the anchors are asserted present and unique before they are ordered.
    expect(SRC.split(YIELD_RECOMPUTE).length - 1).toBe(1)
    expect(SRC.split(LOPSIDED_DECL).length - 1).toBe(1)
    expect(SRC.split(PROFILE_DECL).length - 1).toBe(1)
  })

  it('lopsidedWeek is evaluated AFTER the yield pass recomputes weekly_km', () => {
    expect(SRC.indexOf(LOPSIDED_DECL)).toBeGreaterThan(SRC.indexOf(YIELD_RECOMPUTE))
  })

  it('finalVolumeProfile is derived AFTER it too, so the downgrade can still fire', () => {
    // Detecting the lopsided week is only half of §52's remedy. The profile
    // must be computed from the post-yield detection or the plan is correctly
    // identified and still labelled `build`.
    expect(SRC.indexOf(PROFILE_DECL)).toBeGreaterThan(SRC.indexOf(YIELD_RECOMPUTE))
    expect(SRC.indexOf(PROFILE_DECL)).toBeGreaterThan(SRC.indexOf(LOPSIDED_DECL))
  })

  it('the maintenance gate the old ordering existed to serve is still absent', () => {
    // If this comes back, the ordering above becomes a genuine circular
    // dependency and the fix needs rethinking rather than restoring.
    // Comment-only occurrences are expected and correct — the yield pass
    // DOCUMENTS the deleted gate, which is how the vestigial ordering was
    // traced. What must not come back is a LIVE read, so comment lines are
    // stripped before asserting rather than the whole string being banned.
    const code = SRC.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toContain("finalVolumeProfile !== 'maintenance'")
  })
})
