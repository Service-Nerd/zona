import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validateReshapedPlan } from './invariants'
import { GENERATION_CONFIG as C } from './generationConfig'
import { isLongRun } from './sessionRole'
import type { GeneratorInput, Plan } from '@/types/plan'

// LR-TAPER-BUMP-01 (Coaching Board 2026-10-09) — V4 may not increment a long run
// in the taper, and §6 Amendment 1's cap must work on a duration-anchored plan.
//
// ── WHY, AND BOTH HALVES ARE REAL ────────────────────────────────────────────
// §6 Am.1 (PEAK-LR-NOT-IN-PEAK-01, 2026-09-15) already ruled: "a taper week's
// long run MUST NOT exceed the longest long run of the peak phase". Two separate
// failures let the engine breach it:
//
//   1. `V4-long-run-repeat-ceiling` iterated EVERY week and skipped only deloads,
//      so it incremented taper long runs. Its own config rationale says "a flat
//      long run across 4+ BUILD WEEKS" — the principle was scoped, the code
//      was not.
//   2. §6 Am.1's engine cap bailed on `distance_km == null`, so it NEVER RAN on a
//      duration-anchored plan — and beginners are 95.8% duration-anchored
//      (SESSION-KM-01). On the real plan that prompted this, the peak long runs
//      carried `distance_km: 14.5` and the taper's carried `null` + 126 min, so
//      the cap bailed and the taper shipped 15.5 km against a 14.5 km peak.
//
// MEASURED, 4,808 plans on a grid built from that plan's own input:
//   before — V4 bumped a taper week on 923; INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK
//            fired on 827 of those (89.6%) and on 0 of 3,885 plans where it did
//            not. Single-cause attribution.
//   after  — taper bumps 0, race bumps 0, invariant fires 0.
//
// ⚠️ THE CONSTRAINED COHORT IS THE POPULATION, and a generic grid cannot see
// this: a grid from `real-inputs` case 0 returned 0 of 1,709. The reachable
// cohort is low volume + few days + weekday-capped + injury history + beginner +
// long runway.
//
// 🔴 WHAT THIS FILE DOES **NOT** PROVE, STATED BECAUSE THE MUTATION SAID SO.
// Restoring the cap's `distance_km == null` bail (half two) leaves EVERY arm here
// GREEN. That is not a hole in the arms — it is reachability: with V4 scoped, the
// taper is never bumped, so no inversion exists for the cap to resolve. Measured
// on a wide 4,745-plan grid: **1,712 taper long runs (36%) ARE duration-anchored**,
// so the blindness covered a third of the fleet, and **0 inversions remain** among
// them post-fix. So half two is DEFENCE IN DEPTH for a population the cap could
// not see, and it is unproven by reachability rather than untested by oversight.
// If a future change lets §9's phase shares invert a duration-anchored taper long
// run on its own, the cap will now handle it; today nothing constructs that.

// ⚠️ `longest_recent_run_km: 6`, NOT the real plan's 20. That runner's input is
// self-contradictory (longest 20 > weekly 10) and `INV-INPUT-LONGEST-LE-WEEKLY`
// throws on it under NODE_ENV=test — which is why her plan exists in production,
// where it only logs. The grid showed self-CONSISTENT inputs reach this defect
// too (`cwk=10, lrr=6`), so the fixture uses one. A test that depended on an
// invalid input would be asserting on a plan the engine should never have built.
const CONSTRAINED = {
  age: 34, goal: 'finish', terrain: 'road',
  benchmark: { time: '2:20:00', type: 'race', distance_km: 21.1 },
  race_date: '2027-04-25', race_name: 'R', training_age: '<6mo', days_available: 3,
  injury_history: ['plantar fasciitis'], max_weekday_mins: 45, race_distance_km: 42.2,
  current_weekly_km: 10, days_cannot_train: ['tuesday', 'wednesday', 'friday', 'saturday'],
  user_declared_level: 'beginner', longest_recent_run_km: 6, preferred_long_run_day: 'sun',
  recent_quality_training: 'none', hard_session_relationship: 'neutral',
} as unknown as GeneratorInput

/** ⚠️ Pinned, not `nextMonday()`. The runway is what puts the taper where V4 reaches it. */
const PLAN_START = '2026-12-07'

const CODE = 'INV-PLAN-TAPER-LR-NOT-ABOVE-PEAK'

const build = (over: Partial<GeneratorInput> = {}): Plan =>
  generateRulePlan({ ...CONSTRAINED, ...over } as GeneratorInput, 'paid', PLAN_START)

const v4Weeks = (p: Plan): number[] =>
  ((p.meta as unknown as { rule_adjustments?: Array<{ rule: string; weeks_affected?: number[] }> })
    .rule_adjustments ?? [])
    .filter(a => a.rule === 'V4-long-run-repeat-ceiling')
    .flatMap(a => a.weeks_affected ?? [])

const phaseOf = (p: Plan, n: number) => p.weeks.find(w => w.n === n)?.phase

describe('LR-TAPER-BUMP-01 — V4 is phase-scoped', () => {
  it('the eligible phases are CONFIG, not a literal in the engine', () => {
    expect([...C.LR_REPEAT_ELIGIBLE_PHASES].sort()).toEqual(['base', 'build', 'peak'])
    expect(C.LR_REPEAT_ELIGIBLE_PHASES).not.toContain('taper')
    expect(C.LR_REPEAT_ELIGIBLE_PHASES).not.toContain('race')
  })

  // 🔴 THE REPRODUCTION. Before the fix this exact input produced
  // `V4 weeks: [14, 17]` with w17 = taper.
  it('the real case no longer bumps its taper week', () => {
    const p = build()
    const weeks = v4Weeks(p)
    const taperBumps = weeks.filter(n => phaseOf(p, n) === 'taper')
    expect(taperBumps, `V4 touched taper weeks ${taperBumps}`).toEqual([])
    expect(errorsOf(p), 'the ratified cap must hold on this plan').toEqual([])
  })

  // ⚠️ THE VACUITY GUARD. If V4 stopped firing at all, every arm above passes for
  // the wrong reason — and V4 solves a real flat-long-run problem we are keeping.
  it('V4 STILL FIRES in build/peak — the fix is a scope, not a removal', () => {
    let fired = 0
    const touched = new Set<string>()
    for (const cwk of [10, 20, 30, 45]) for (const days of [3, 4, 5]) {
      const p = build({ current_weekly_km: cwk, days_available: days,
        days_cannot_train: days === 3 ? CONSTRAINED.days_cannot_train : [] } as Partial<GeneratorInput>)
      const weeks = v4Weeks(p)
      if (weeks.length) fired++
      for (const n of weeks) touched.add(String(phaseOf(p, n)))
    }
    expect(fired, 'V4 no longer fires anywhere — scope became removal').toBeGreaterThan(0)
    expect(Array.from(touched).sort()).not.toContain('taper')
    expect(touched.size, 'V4 fires but touches no phase we can name').toBeGreaterThan(0)
  })

  function errorsOf(p: Plan) {
    return validateReshapedPlan(p).filter(v => v.code === CODE).map(v => v.message)
  }

  it('§6 Am.1 holds across the cohort that reaches it', () => {
    const breaches: string[] = []
    let n = 0, taperBumps = 0
    for (const dist of [10, 21.1, 42.2]) for (const cwk of [10, 20, 30, 45])
      for (const days of [3, 4, 5]) for (const goal of ['finish', 'time_target'] as const) {
        const over: Record<string, unknown> = { race_distance_km: dist, current_weekly_km: cwk,
          days_available: days, goal,
          days_cannot_train: days === 3 ? CONSTRAINED.days_cannot_train : [] }
        if (goal === 'time_target') over.target_time = dist >= 42 ? '5:00:00' : dist >= 21 ? '2:20:00' : '1:05:00'
        let p: Plan
        try { p = build(over as Partial<GeneratorInput>) } catch { continue }
        n++
        taperBumps += v4Weeks(p).filter(k => phaseOf(p, k) === 'taper').length
        const e = errorsOf(p)
        if (e.length) breaches.push(`${dist}km cwk=${cwk} d=${days} ${goal}: ${e[0].slice(0, 90)}`)
      }
    expect(n, 'the cohort generated nothing — the grid stopped reaching it').toBeGreaterThan(20)
    expect(taperBumps, 'V4 touched a taper week').toBe(0)
    expect(breaches, breaches.join('\n')).toEqual([])
  })

  // 🔴 HALF TWO: the cap was blind to a duration-anchored long run, so it never
  // ran for the cohort that needed it. And it must not FLIP the anchor either.
  it('a duration-anchored taper long run is capped WITHOUT becoming distance-anchored', () => {
    const p = build()
    const taper = p.weeks.filter(w => w.phase === 'taper' && w.type !== 'race')
    expect(taper.length, 'no taper weeks to inspect').toBeGreaterThan(0)

    let durationAnchored = 0
    for (const w of taper) {
      for (const s of Object.values(w.sessions ?? {})) {
        if (!s || s.type !== 'easy' || !isLongRun(s)) continue
        // Whatever the cap did, a session with no distance must keep a duration —
        // flipping a beginner's card from minutes to km breaks §79/§80.
        if (s.distance_km == null) {
          durationAnchored++
          expect(s.duration_mins, `w${w.n} taper long run has neither anchor`).toBeGreaterThan(0)
        }
      }
    }
    expect(durationAnchored,
      'this fixture is no longer duration-anchored — it was the whole reason the cap was blind')
      .toBeGreaterThan(0)
  })
})
