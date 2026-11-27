import { describe, it, expect } from 'vitest'
import { validatePlan } from './invariants'
import { auditPlanQuality } from './planQuality'
import { verifyPlan } from '@/lib/engine/verifier/verifyPlan'
import { buildRunnerProfile, factsFromInput } from '@/lib/engine/profile/buildRunnerProfile'
import { GENERATION_CONFIG as G } from './generationConfig'
import { runEngine } from './engine'
import { sessionKmSelfPaced } from './sessionDistance'
import { isLongRun } from './sessionRole'
import type { Plan, GeneratorInput, Session, Week } from '@/types/plan'

/**
 * B14 (Coaching Board `ADR027-B3-RAISED-LIST-01`, 2026-11-22) — §117 Am. 2's bound reads the peak
 * LONG RUN, not the largest session of any kind.
 *
 * The sitting ruled it **CORRECT WITH AMENDMENT**, conditional on the builder confirming §117's
 * reading. ✅ Confirmed: Am. 2's text says *"whose peak long run falls below"* twice, the constant
 * is `FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM`, and the registry row says "peak long run".
 *
 * ── WHY THESE ARMS EXIST, GIVEN THE CHANGE IS MEASURED INERT ────────────────────────────────────
 * 📐 0 of 37 corpus plans and 0 of 44 live plans differ between the two readings, and
 * `finish_goal_run_walk` is unset on all 44, so the invariant has never fired for a runner. The two
 * readings coincide because the long run is normally the longest run — and **nothing asserts that**:
 * §9's `INV-PLAN-LONG-IS-LONGEST` bounds the long run against EASY runs only, so a longer QUALITY
 * session is forbidden by no rule at all. That is the gap these arms occupy: a plan the engine would
 * not build today, but that no invariant refuses either.
 *
 * 🔻 WHAT THEY DO NOT CHECK: that 17 km is the right floor (§9's, via §117 Am. 2), and that any of
 * this reaches a runner — it does not, and the fixture is hand-built precisely because no corpus
 * plan can reach it.
 */

const FLOOR = G.FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM   // 17

const session = (over: Partial<Session>): Session => ({
  type: 'easy', label: 'Easy run', distance_km: 6, duration_mins: 40,
  zone: 'Zone 2', pace_target: '6:30–7:00 /km', coach_notes: [], ...over,
} as Session)

/** A marathon plan whose LONG RUN is below the floor while a QUALITY session is well above it.
 *  §9's ratio rule compares the long run to EASY runs only, so nothing here is illegal to §9. */
function planWithBigQuality(longRunKm: number, qualityKm: number): Plan {
  const week = (n: number): Week => ({
    n, phase: 'build', type: 'normal', weekly_km: longRunKm + qualityKm + 6,
    sessions: {
      tue: session({ type: 'quality', label: 'Marathon-pace blocks', distance_km: qualityKm, duration_mins: qualityKm * 6 }),
      thu: session({ distance_km: 5, duration_mins: 33 }),
      sun: session({ type: 'easy', label: 'Long run', distance_km: longRunKm, duration_mins: longRunKm * 7 }),
    },
  } as unknown as Week)
  return {
    meta: { finish_goal_run_walk: true, run_walk_prescribed: true, vdot: 35 },
    weeks: [week(1), week(2), week(3)],
  } as unknown as Plan
}

const input = {
  race_distance_km: 42.2, goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 10,
  days_per_week: 3, plan_weeks: 3, injury_history: [],
} as unknown as GeneratorInput

const codes = (p: Plan) => validatePlan(p, input).map(v => v.code)
const verifierCodes = (p: Plan) => {
  const profile = buildRunnerProfile(factsFromInput(input), { asOf: '2026-11-27', timezone: null })
  // 🔴 THREE arguments, and the policy is the third. The first cut smuggled it in as a `rules` key
  // `VerifyContext` does not have, so `tsc` failed (the repo's ONE type error, which blocks every
  // push) while `vitest run` passed 4/4 — vitest does not typecheck. Found by code review.
  return verifyPlan(p, { input, profile }, 'saved').map(f => f.rule_id)
}

describe('B14 — §117 Am. 2 reads the peak LONG RUN', () => {
  it('🔴 a short long run beside a BIGGER quality session is caught — the old reading missed it', () => {
    // long run 12 km (below the 17 km floor), quality 20 km (above it). Reading every session takes
    // the max as 20 and the rule says nothing; reading the long run takes 12 and it fires.
    const plan = planWithBigQuality(12, 20)
    expect(codes(plan), 'validatePlan').toContain('INV-PLAN-RUNWALK-ADEQUATE')
    expect(verifierCodes(plan), 'the verifier agrees').toContain('INV-PLAN-RUNWALK-ADEQUATE')
  })

  it('🔴 and the RUBRIC scores it, which is the site the item did not name', () => {
    // `planQuality`'s `peakLR` fed `adequate` and both LONG-RUN-SHORT branches off every run.
    // With the long-run reading the plan is below the floor, so it is SCORED rather than exempt.
    const plan = planWithBigQuality(12, 20)
    const f = auditPlanQuality(plan, input)
    expect(f.map(x => x.code)).toContain('LONG-RUN-SHORT')
    const short = f.find(x => x.code === 'LONG-RUN-SHORT')!
    expect(short.watched, 'below the floor it is scored, not watched — Willy\'s condition').toBeFalsy()
    expect(short.detail, 'it reports the LONG RUN, not the quality session').toMatch(/12\.0km/)
  })

  it('a long run at or above the floor does NOT fire, however small the rest of the week', () => {
    // The other direction: the rule must not fire on a plan that satisfies §117 Am. 2.
    const plan = planWithBigQuality(FLOOR + 1, 8)
    expect(codes(plan)).not.toContain('INV-PLAN-RUNWALK-ADEQUATE')
    expect(verifierCodes(plan)).not.toContain('INV-PLAN-RUNWALK-ADEQUATE')
  })

  it('🔴 and the PRODUCER\'s refusal gate reads the long run too — the fourth site', () => {
    // 🔴 Code review found this one after the record claimed three. It is the site that DECIDES:
    // the gate's own comment says an invariant only LOGS in production, so the refusal is the real
    // guard — and with the three checkers corrected and this left alone the producer would SHIP a
    // plan the checker then flags, which is worse than both agreeing on the wrong reading.
    //
    // ⚠️ IT CANNOT BE ASSERTED BY REFUSAL, because the engine does not build such a plan: measured
    // over a cohort constructed to reach §117 (the `fitness_level` override is the only path — the
    // corpus, the parity grid and the targeted grid all leave it unset), **54 run-walk plans and 0
    // where the two readings differ, before or after.** So this arm asserts the COINCIDENCE the
    // four sites relied on, over engine output: the biggest long run IS the biggest session. The
    // day that stops being true this goes red, which is the only thing worth asserting here.
    const inputs = [8, 12, 20].flatMap(vol => [5, 10].map(longest => ({
      race_distance_km: 42.2, goal: 'finish', current_weekly_km: vol, longest_recent_run_km: longest,
      days_per_week: 3, fitness_level: 'beginner', race_date: '2027-06-01', age: 40, injury_history: [],
    } as unknown as GeneratorInput)))
    let runWalkPlans = 0
    for (const inp of inputs) {
      let o
      try { o = runEngine({ input: inp, tier: 'paid', displayUnits: 'km', planStart: '2027-01-04', today: '2026-11-27' }) }
      catch { continue }   // generateRulePlan throws on its own error-severity findings under test
      if (o.kind !== 'plan' || !o.plan.meta.finish_goal_run_walk) continue
      runWalkPlans++
      const main = o.plan.weeks.filter(w => w.n > 0 && w.type !== 'race' && w.type !== 'deload')
      let any = 0, lr = 0
      for (const w of main) for (const s of Object.values(w.sessions ?? {})) {
        const km = sessionKmSelfPaced(s as Session) ?? 0
        if (km > any) any = km
        if (s && isLongRun(s as Session) && km > lr) lr = km
      }
      expect(lr, `${inp.current_weekly_km}km/wk, longest ${inp.longest_recent_run_km}: the biggest long run is the biggest session`).toBeCloseTo(any, 5)
    }
    // The population must be non-empty or the loop proves nothing — the §117 gate is easy to miss.
    expect(runWalkPlans, 'no §117 run-walk plan generated: this arm is over an empty population').toBeGreaterThan(0)
    // 🔻 AND THE LIMIT, STATED BECAUSE A MUTATION PROVED IT: reverting the producer's own
    // `.filter(isLongRun)` leaves every arm in this file GREEN. It has to — the arm above asserts a
    // property of engine OUTPUT, which holds under either reading, and the producer's gate is not
    // exported, so nothing here can reach it directly. **The producer's change is correct and
    // UNGATED**, and the honest reason is that it is unobservable through `runEngine`: the engine
    // never builds the plan the two readings disagree about. Writing a source assertion instead
    // would pass on a comment (SHEET-RAF-FALLBACK-01's recorded lesson), so the limit is written
    // here rather than dressed up as coverage.
  })

  it('🔴 a plan with NO stamped long run raises no long-run bar, and does not lose the later checks', () => {
    // 🔴 THE ARM I DID NOT WRITE WHEN I ADDED THE GUARD, and removing the guard stayed green.
    // With `lrKmsIn` a plan carrying no session the classifier calls a long run yields 0, and 0
    // under the 55% bar reads as a hard objection stating "peak long run 0.0km = 0% of race".
    // Absence is not a value: no long run at all is §9's finding, not this bar's.
    const week = (n: number): Week => ({
      n, phase: 'build', type: 'normal', weekly_km: 18,
      sessions: {
        tue: session({ type: 'quality', label: 'Marathon-pace blocks', distance_km: 9, duration_mins: 54 }),
        thu: session({ distance_km: 9, duration_mins: 60 }),
      },
    } as unknown as Week)
    const plan = { meta: { run_walk_prescribed: true, vdot: 35 }, weeks: [week(1), week(2), week(3)] } as unknown as Plan
    const f = auditPlanQuality(plan, input)
    expect(f.map(x => x.code), 'no long run is not a 0 km long run').not.toContain('LONG-RUN-SHORT')
    expect(f.map(x => x.code)).not.toContain('LONG-RUN-SHORT-RUNWALK')
    // 🔴 AND THE LATER CHECKS MUST STILL RUN. My first guard was `if (peakLR <= 0) return f` inside
    // a MARATHON-ONLY block, which would have skipped P8 and everything after it — `tsc` was happy
    // and the whole suite stayed green, because no corpus plan reaches `peakLR === 0`.
    expect(f.map(x => x.code), 'P8 still runs: three identical weeks never build').toContain('NEVER-BUILDS')
  })

  it('🔻 and §9 forbids none of this, which is why the coincidence was load-bearing', () => {
    // The arm that states the gap rather than leaving it to a comment. `INV-PLAN-LONG-IS-LONGEST`
    // compares the long run to EASY runs; a quality session nearly twice its size breaks no rule.
    const plan = planWithBigQuality(12, 20)
    expect(codes(plan), '§9 does not object to a quality session longer than the long run')
      .not.toContain('INV-PLAN-LONG-IS-LONGEST')
  })
})
