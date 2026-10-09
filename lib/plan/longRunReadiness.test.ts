import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { assessLongRunReadiness, minLongestRunKm, weeksToReachFloor, LongRunReadinessError } from './longRunReadiness'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

// CoachingPrinciples §113 — the enforcement artifact.
//
// A named test, not an invariant, for the same structural reason as §112: this
// refuses BEFORE a plan exists, so there is no Plan for validatePlan() to
// inspect. Unlike the route gate it replaces, the sweep now sees it.

const base = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.2, race_date: '2027-04-25', goal: 'finish',
  current_weekly_km: 25, longest_recent_run_km: 10, days_available: 3,
  fitness_level: 'beginner', training_age: '<6mo', age: 38, injury_history: [],
  recent_quality_training: 'none', hard_session_relationship: 'neutral',
  plan_start: '2026-10-05', ...o,
} as unknown as GeneratorInput)

describe('§113 — long-run readiness', () => {
  it('the floor is NOT a second copy of the number', () => {
    // The route used to hardcode `5`. Change the engine's floor and the gate
    // must follow it — which is exactly what did not happen before.
    expect(minLongestRunKm()).toBe(GENERATION_CONFIG.MIN_SESSION_DISTANCE_KM.long)
  })

  it('refuses below the floor, on a governed distance', () => {
    const r = assessLongRunReadiness(base({ longest_recent_run_km: 3 }))
    expect(r.ok).toBe(false)
    expect(r.message).toContain('3 km')
    expect(r.message).toContain(String(minLongestRunKm()))
  })

  it('permits AT the floor — the boundary is inclusive', () => {
    expect(assessLongRunReadiness(base({ longest_recent_run_km: minLongestRunKm() })).ok).toBe(true)
  })

  it('🔴 names the lever — §44 requires alternatives, not a full stop', () => {
    // The old gate returned a bare string. §44's own text: "Return error
    // explaining why and listing alternatives."
    const r = assessLongRunReadiness(base({ longest_recent_run_km: 2 }))
    expect(r.alternatives.length).toBeGreaterThan(0)
    expect(r.alternatives.join(' ')).toMatch(/build up to/i)
  })

  it('🔴 offers a 10K to a refused marathoner, and NEVER the half', () => {
    // ⚠️ THIS TEST PINNED THE DEFECT. It used to assert the opposite — that a
    // refused marathoner IS offered "a half marathon plan, which asks less of
    // your longest run". It asks exactly the same: §113's floor governs every
    // race at or above LONG_RUN_READINESS_MIN_RACE_KM (21 km), so the half
    // refuses the same runner identically. The suggestion spent a first-timer's
    // one retry and sent them away (REFUSAL-ALT-REACHABLE-01, 2026-09-18).
    const m = assessLongRunReadiness(base({ longest_recent_run_km: 2, race_distance_km: 42.2 }))
    const h = assessLongRunReadiness(base({ longest_recent_run_km: 2, race_distance_km: 21.1 }))
    expect(m.alternatives.join(' '), 'the half carries the SAME floor').not.toMatch(/half marathon/i)
    expect(m.alternatives.join(' '), 'offer a distance that actually opens').toMatch(/10K/i)
    expect(h.alternatives.join(' '), 'do not offer a half to someone already running one')
      .not.toMatch(/half marathon/i)
  })

  // 🔴 EVERY CASE HERE USES 42.2 AND THE BRANCH IS `raceDistanceKm >= 42`, so mutating
  // it to `> 42` changed nothing any test could see. A boundary tested only from well
  // inside it is not tested: the number could be anything from 22 to 42 and these
  // assertions stay green.
  //
  // ⚠️ THIS IS NOT THE MUTANT `test-liveness` REPORTED, AND I INITIALLY THOUGHT IT WAS.
  // The harness scopes mutations to the bodies of the symbols the test IMPORTS, and
  // `alternativesFor` is private — so this `>=` is outside every span and the harness
  // never touches it. The reported survivor was the admission boundary below. Verified
  // by hand instead: flipping this one red-fails the case below, which is why it stays.
  //
  // ⚠️ AND THE `42` IS A HARDCODED COACHING NUMERIC IN `lib/plan/`, which the
  // Configuration Singularity forbids — the same function reads `21` from
  // `GENERATION_CONFIG.LONG_RUN_READINESS_MIN_RACE_KM` four lines up. Filed as
  // LR-ALT-42-CONFIG-01 rather than moved here, because relocating it is a
  // `generationConfig.ts` edit and convenes the Coaching Board.
  it('the 10K alternative appears AT the marathon boundary, not only above it', () => {
    const at    = assessLongRunReadiness(base({ longest_recent_run_km: 2, race_distance_km: 42 }))
    const below = assessLongRunReadiness(base({ longest_recent_run_km: 2, race_distance_km: 41.9 }))
    expect(at.alternatives.join(' '), 'a 42 km race is a marathon and earns the 10K door')
      .toMatch(/10K/i)
    expect(below.alternatives.join(' '), 'below the boundary the marathon-specific door is not offered')
      .not.toMatch(/10K/i)
  })

  // 🔴 WHY `Number.isFinite` IS THERE, ASSERTED. `typeof w === 'number'` alone admits
  // NaN and Infinity, and `Infinity >= rampWeeks + blockWeeks` is TRUE — so a runner
  // below the floor with an unparseable runway would be ADMITTED on a runway that does
  // not exist. Flipping the `&&` to `||` in the source reproduces exactly that, and
  // nothing noticed (test-liveness, 2026-09-30: `flip first && to ||` SURVIVED).
  //
  // ⚠️ NaN alone is NOT enough to prove the guard: `NaN >= n` is false, so it falls
  // through to the same refusal either way. **Infinity is the case that separates them**
  // — which is the difference between a test that kills a mutant and a test that only
  // looks like it should.
  it('an unparseable runway does not admit a runner below the floor', () => {
    const below = { longest_recent_run_km: 2, race_distance_km: 42.2 }
    for (const w of [Number.POSITIVE_INFINITY, Number.NaN]) {
      expect(assessLongRunReadiness(base(below), w).ok,
        `weeksAvailable=${w} must be treated as absent, never as unlimited runway`).toBe(false)
    }
    // And the guard has not broken the real admission it exists to allow.
    expect(assessLongRunReadiness(base(below), 40).ok,
      'a genuine long runway still admits — otherwise this test passes for the wrong reason').toBe(true)
  })

  // 🔴 THE MUTANT `test-liveness` ACTUALLY REPORTED (2026-09-30, `flip second >= to >`).
  // In-span, the second `>=` is `weeksAvailable >= rampWeeks + blockWeeks` — §113
  // Amendment 1's admission boundary. Flipped to `>`, a runner whose runway is EXACTLY
  // enough is refused, and nothing noticed: every existing case sits well clear of the
  // line (29 weeks admitted, 8 refused).
  //
  // ⚠️ THE BOUNDARY IS DERIVED FROM DOCTRINE, NOT SEARCHED FOR. A test that finds the
  // smallest admitting value and then asserts around it is mutation-BLIND: under `>` the
  // search simply returns one week later and the assertions still hold. So the expected
  // week count is composed from the same two published quantities the principle names —
  // `weeksToReachFloor` (§45's governed ramp) and `PREP_TIME_THRESHOLDS.MARATHON.block`
  // (§44's minimum block) — and the comparison is what is under test.
  it('a runway of EXACTLY ramp + block admits; one week less does not', () => {
    const longest  = 2
    const ramp     = weeksToReachFloor(longest, minLongestRunKm())
    const block    = GENERATION_CONFIG.PREP_TIME_THRESHOLDS.MARATHON.block
    const boundary = ramp + block
    const below    = base({ longest_recent_run_km: longest, race_distance_km: 42.2 })

    expect(assessLongRunReadiness(below, boundary).ok,
      `${boundary} weeks (ramp ${ramp} + block ${block}) is exactly enough, and exactly enough is enough`)
      .toBe(true)
    expect(assessLongRunReadiness(below, boundary - 1).ok,
      'one week short of the governed ramp plus the minimum block is a refusal').toBe(false)
  })

  // 🔴 SURFACED BY FIXING THE ONE ABOVE, AND THAT IS THE HARNESS WORKING.
  // `test-liveness` scopes mutations to the bodies of the symbols the test IMPORTS, so
  // importing `weeksToReachFloor` for the boundary test WIDENED the attack surface into
  // a function nothing tested directly — and two mutants immediately survived
  // (`flip first >= to >`, `flip first || to &&`), both on its single guard line.
  //
  // ⚠️ Worth stating because it looks like a regression and is the opposite: the set of
  // mutable spans is DERIVED FROM THE IMPORTS, so a test that reaches further is
  // measured further. Fixing one survivor legitimately reveals more.
  //
  // This is §45's governed ramp, and my admission test above now leans on it, so it
  // needs to be right rather than merely present.
  describe('weeksToReachFloor — §45s governed ramp', () => {
    const floor = minLongestRunKm()

    // `longestKm >= floorKm` → `>`: a runner ALREADY AT the floor needs no ramp. Flipped,
    // they are handed a ramp to a distance they can already run.
    it('a runner already AT the floor needs no ramp', () => {
      expect(weeksToReachFloor(floor, floor), 'at the floor is not below it').toBe(0)
      expect(weeksToReachFloor(floor + 1, floor)).toBe(0)
    })

    // `!(longestKm > 0) ||` → `&&`: absence and zero must short-circuit. Flipped, a 0 km
    // runner falls through to `Math.log(floor / 0)` = Infinity, and `Math.ceil(Infinity)`
    // is Infinity — a ramp no runway can ever satisfy, which silently converts
    // "we do not know your longest run" into a permanent refusal.
    // ⚠️ `0` HAS LEFT THIS SET (§10 Amendment, Coaching Board 2026-10-09,
    // `WIZARD-ZERO-VOLUME-REFUSAL-01` Am.3). The comment above is still exactly
    // right about ABSENCE and garbage — inventing an unsatisfiable ramp would
    // turn an unanswered question into a permanent refusal. A DECLARED zero is
    // not an unanswered question: it is an answer, and compounding from it never
    // reaches a positive floor, so Infinity is the arithmetic rather than a
    // policy. Returning 0 there read as "no weeks needed" for a runner who has
    // not run, and it ADMITTED a declared-zero half-marathoner while refusing a
    // declared 1 km.
    it('a negative or unparseable longest run yields no ramp, never an infinite one', () => {
      for (const km of [-1, Number.NaN]) {
        const w = weeksToReachFloor(km, floor)
        expect(w, `longest=${km} must not produce an unsatisfiable ramp`).toBe(0)
        expect(Number.isFinite(w)).toBe(true)
      }
    })

    it('🔴 a DECLARED zero yields an infinite ramp, because compounding from zero never arrives', () => {
      expect(weeksToReachFloor(0, floor)).toBe(Number.POSITIVE_INFINITY)
    })

    it('below the floor yields a finite ramp that shortens as the runner gets closer', () => {
      const far   = weeksToReachFloor(1, floor)
      const near  = weeksToReachFloor(floor - 0.5, floor)
      expect(far).toBeGreaterThan(0)
      expect(Number.isFinite(far)).toBe(true)
      expect(near, 'a closer runner needs no more weeks than a further one')
        .toBeLessThanOrEqual(far)
    })
  })

  it('does not govern shorter races', () => {
    for (const km of [5, 10]) {
      expect(assessLongRunReadiness(base({ race_distance_km: km, longest_recent_run_km: 1 })).ok).toBe(true)
    }
  })

  it('🔴 a MISSING longest run passes — absence is not shortness', () => {
    // Turning an unanswered question into a rejection is a different defect.
    //
    // ⚠️ `0` USED TO BE IN THIS LIST. It is a DECLARATION, not a gap (§10
    // Amendment, Am.3) — and while it sat here, a declared-zero half-marathoner
    // was ADMITTED while a declared 1 km was REFUSED, so the honest answer
    // bought the worse outcome. Garbage still passes: `NaN` is not an answer.
    for (const v of [undefined, null, Number.NaN, -1]) {
      expect(assessLongRunReadiness(base({ longest_recent_run_km: v as never })).ok,
        `longest=${String(v)}`).toBe(true)
    }
  })

  it('🔴 a DECLARED zero does NOT pass — zero is an answer, and it is the lowest one', () => {
    expect(assessLongRunReadiness(base({ longest_recent_run_km: 0 })).ok).toBe(false)
    // And no runway rescues it, unlike every other sub-floor value.
    expect(assessLongRunReadiness(base({ longest_recent_run_km: 0 }), 200).ok).toBe(false)
    expect(assessLongRunReadiness(base({ longest_recent_run_km: 1 }), 200).ok).toBe(true)
  })

  it('the ENGINE throws it, so the sweep and the route both see it', () => {
    // The whole governance point: in the route it was invisible to every check
    // that starts inside the engine.
    //
    // ⚠️ RUNWAY ADDED 2026-09-18 (§113 Am.1). This case used to pass a 2 km
    // longest run with the base fixture's 2027-04-25 race — a 29-week runway —
    // and that runner is now ADMITTED, which is the entire point of the
    // amendment. A refusal now requires a runway too short to build them:
    // 6 ramp weeks (2 km -> the 5 km floor at §45's 20%) + §44's 10-week
    // marathon block = 16, so a ~12-week runway refuses.
    expect(() => generateRulePlan(
      base({ longest_recent_run_km: 2, race_date: '2026-12-28' }), 'paid', '2026-10-05',
    )).toThrow(LongRunReadinessError)
  })

  it('🔴 and ADMITS the same runner when the runway is long enough', () => {
    // §113 Am.1's positive case. The Coaching Board vetoed refusing a 3 km
    // runner with seven months because of a constant; this is that veto,
    // asserted. Same runner, same longest run, different runway.
    expect(() => generateRulePlan(
      base({ longest_recent_run_km: 2, race_date: '2027-04-25' }), 'paid', '2026-10-05',
    )).not.toThrow()
  })

  it('and still builds for a runner at the floor', () => {
    expect(() => generateRulePlan(base({ longest_recent_run_km: 5 }), 'paid', '2026-10-05')).not.toThrow()
  })
})

describe('§113 — the route holds no coaching number any more', () => {
  const route = readFileSync(join(process.cwd(), 'app/api/generate-plan/route.ts'), 'utf8')
  const code = route.split('\n').filter(l => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n')

  it('the hardcoded longest-run gate is gone', () => {
    expect(code, 'a second copy of the floor cannot live in the boundary')
      .not.toMatch(/longest_recent_run_km\s*<\s*\d/)
  })

  it('the hardcoded volume gate stayed gone (§111)', () => {
    expect(code).not.toMatch(/current_weekly_km\s*<\s*\d/)
  })

  it('the refusal renders with the same 422 shape as its siblings', () => {
    expect(route).toMatch(/LongRunReadinessError/)
    expect(route).toMatch(/reason: 'long_run_readiness'/)
  })
})
