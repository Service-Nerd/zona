import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { LongRunReadinessError } from './longRunReadiness'
import { assessBaseBuild, deliveredPeakKm, BaseVolumeError } from './baseVolume'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

// CoachingPrinciples §111 — the base-build ceiling (MARATHON-VOLUME-GATE-01).
// The old gate refused marathon current_weekly_km < 20 in the API route,
// ungoverned and non-monotonic, and refused the flagship charity persona M1
// (15 km/week) while every engine test passed. §111 refuses on delivered peak
// ÷ raw current volume for marathon/ultra, thrown from generateRulePlan.

const PLAN_START = '2026-10-05' // a Monday
function raceDate(weeks: number) {
  return new Date(Date.parse(PLAN_START) + weeks * 7 * 864e5).toISOString().slice(0, 10)
}

function marathon(over: Partial<GeneratorInput>): GeneratorInput {
  return {
    athlete_name: 'X', age: 35, race_name: 'London', primary_metric: 'distance',
    plan_start: PLAN_START, race_distance_km: 42.2, race_date: raceDate(24),
    goal: 'finish', resting_hr: 52, max_hr: 180, current_weekly_km: 20,
    longest_recent_run_km: 10, fitness_level: 'beginner',
    recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
    training_age: '<6mo', days_available: 4, days_cannot_train: [],
    injury_history: [],
    ...over,
  } as unknown as GeneratorInput
}

function gen(input: GeneratorInput): { plan: Plan | null; err: Error | null } {
  try { return { plan: generateRulePlan(input, 'trial', PLAN_START, undefined, PLAN_START), err: null } }
  catch (e) { return { plan: null, err: e as Error } }
}

describe('§111 base-build ceiling — the refusal', () => {
  it('refuses a reckless low base (5 km/week marathon) with a structured BaseVolumeError', () => {
    // ⚠️ `longest_recent_run_km` RAISED 4 -> 5 when §113 landed. At 4 this
    // fixture is refused by §113 (long-run readiness) BEFORE §111 is
    // reached, so it would have tested the wrong refusal. The runner under
    // test here is low-VOLUME, not long-run-unready; 5 keeps them at §113's
    // floor so §111 is the rule actually exercised.
    const { plan, err } = gen(marathon({ current_weekly_km: 5, longest_recent_run_km: 5 }))
    expect(plan).toBeNull()
    expect(err).toBeInstanceOf(BaseVolumeError)
    const base = (err as BaseVolumeError).base
    expect(base.current_weekly_km).toBe(5)
    expect(base.min_base_km).toBeGreaterThan(5)
    expect(base.ratio).toBeGreaterThan(GENERATION_CONFIG.MAX_BASE_BUILD_RATIO)
    // Names the lever, in "not yet" voice — not a bare stop (§44 obligation).
    expect(base.message).toMatch(/too low to build safely/)
    expect(base.alternatives.length).toBeGreaterThan(0)
    expect(base.alternatives.join(' ')).toMatch(new RegExp(`${base.min_base_km}`))
  })

  it('ADMITS the flagship first-time charity marathoner M1 (15 km/week) — the old route gate refused it', () => {
    // 15 km/week → peak ~47 = 3.13x, under the 4.0 cap. This is the case the
    // ungoverned `current_weekly_km < 20` gate wrongly refused.
    const { plan, err } = gen(marathon({ current_weekly_km: 15, longest_recent_run_km: 8 }))
    expect(err).toBeNull()
    expect(plan).not.toBeNull()
    const ratio = deliveredPeakKm(plan!) / 15
    expect(ratio).toBeLessThanOrEqual(GENERATION_CONFIG.MAX_BASE_BUILD_RATIO)
  })

  it('is monotonic: once a base generates, every higher base also generates', () => {
    const results = [12, 15, 20, 30, 40].map(v =>
      gen(marathon({ current_weekly_km: v, longest_recent_run_km: Math.min(v, 12) })).plan !== null)
    // No permitted base below a refused one (the non-monotonicity §111 fixes).
    expect(results).toEqual([true, true, true, true, true])
    // And a base below the floor is refused, so the boundary is real.
    // ⚠️ 8 -> 3 on 2026-09-20. §117 ADMITS 8 km/week: the finish-goal run-walk
    // shape drops the beginner marathon peak to 32, so ceil(32/4) = 8 is now
    // the door, not 13. The boundary is still real, it moved — and §111's
    // ratio cap is untouched at 4.0 (see §111 Amendment 3).
    expect(gen(marathon({ current_weekly_km: 3, longest_recent_run_km: 2 })).plan).toBeNull()
    // ⚠️ MONOTONICITY IS RE-ASSERTED ACROSS THE BOUNDARY WHEREVER IT SITS,
    // because a moved boundary is exactly where non-monotonicity hides — that
    // was the old route gate's second defect (refused 15, permitted 20).
    //
    // ⚠️ THE BOUNDARY IS DERIVED, NOT HARDCODED. §117 moves it from 13 to 8
    // when its flag is on, and a hardcoded volume here would be a second copy
    // of a number the engine computes — so this test would pass in one flag
    // state and fail in the other, which is how a flag becomes a liability.
    // Find the door by probing, then assert nothing above it is refused.
    const probe = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 20, 30].map(v => ({
      v, ok: gen(marathon({ current_weekly_km: v, longest_recent_run_km: Math.min(v, 6) })).plan !== null,
    }))
    const firstOk = probe.findIndex(x => x.ok)
    expect(firstOk, 'no volume in the probe generates at all').toBeGreaterThan(-1)
    expect(
      probe.slice(firstOk).every(x => x.ok),
      `non-monotonic: ${probe.map(x => `${x.v}:${x.ok ? 'y' : 'n'}`).join(' ')}`,
    ).toBe(true)
  })

  it('a current volume of 0 is refused (cannot build a marathon off no base)', () => {
    // ⚠️ THE REFUSAL HOLDS; WHICH GATE SPEAKS FIRST CHANGED (§10 Amendment,
    // `WIZARD-ZERO-VOLUME-REFUSAL-01` Am.3, 2026-10-09). §113 is an INPUT gate
    // and §111 is a PLAN-EXIT gate (`finalise`, after generation — it needs the
    // generated plan to assess), so §113 structurally speaks first. It used to
    // fall through on a declared zero because its guard read `!(longest > 0)`,
    // which treated the answer as a gap; now it refuses, so a zero/zero
    // marathoner gets §113's message instead of §111's.
    //
    // The runner is NOT worse off: both throw the same refusal shape and render
    // the same "not yet" screen, and §113's ask ("build up to one 5 km run,
    // then come back") is a smaller and clearer first step than a weekly base.
    // This arm therefore asserts the REFUSAL, which is what it was written for.
    const { plan, err } = gen(marathon({ current_weekly_km: 0, longest_recent_run_km: 0 }))
    expect(plan).toBeNull()
    expect(err).toBeInstanceOf(LongRunReadinessError)
  })

  it('§111 still owns the refusal when the longest run is adequate', () => {
    // The arm above no longer exercises §111, so this one does — a runner with a
    // real long run and no weekly base is §111's cohort alone. Without this,
    // moving the zero case to §113 would have quietly removed §111's only
    // zero-volume assertion.
    const { plan, err } = gen(marathon({ current_weekly_km: 0, longest_recent_run_km: 12 }))
    expect(plan).toBeNull()
    expect(err).toBeInstanceOf(BaseVolumeError)
  })

  it('does NOT govern shorter distances — a low-base 10K still generates', () => {
    const { plan } = gen(marathon({ race_distance_km: 10, current_weekly_km: 5, longest_recent_run_km: 4 }))
    expect(plan).not.toBeNull()
  })
})

describe('§111 — assessBaseBuild computation', () => {
  it('marks marathon/ultra as applicable and shorter distances as not', () => {
    const mPlan = gen(marathon({ current_weekly_km: 20 })).plan!
    expect(assessBaseBuild(mPlan, marathon({ current_weekly_km: 20 })).applies).toBe(true)
    const kPlan = gen(marathon({ race_distance_km: 10, current_weekly_km: 20 })).plan!
    expect(assessBaseBuild(kPlan, marathon({ race_distance_km: 10, current_weekly_km: 20 })).applies).toBe(false)
  })
})

describe('INV-PLAN-BASE-BUILD-RATIO — the backstop invariant', () => {
  it('fires (error) when a generated plan is mutated over the ceiling', () => {
    // A generated plan passes §111 (or it would have been refused). Inflate its
    // peak so peak/current exceeds the cap, exactly as the liveness mutation does.
    const input = marathon({ current_weekly_km: 20 })
    const plan = gen(input).plan!
    for (const w of plan.weeks) w.weekly_km = (w.weekly_km ?? 0) * 5
    const v = validatePlan(plan, input).find(x => x.code === 'INV-PLAN-BASE-BUILD-RATIO')
    expect(v).toBeDefined()
    expect(v!.severity).toBe('error')
  })

  it('does NOT fire on a clean generated plan (M1)', () => {
    const input = marathon({ current_weekly_km: 15, longest_recent_run_km: 8 })
    const plan = gen(input).plan!
    expect(validatePlan(plan, input).some(x => x.code === 'INV-PLAN-BASE-BUILD-RATIO')).toBe(false)
  })
})

/**
 * `REFUSAL-PLURAL-01` — "check back in 1 weeks" reached a refused runner.
 *
 * Found 2026-10-10 by READING THE MESSAGE OUT LOUD while measuring something else, not
 * by any check. The §111 message itself pluralises correctly one line up ("about 1 week
 * of steady easy running"), so **the two halves of the same refusal disagreed** and a
 * runner being told no was reading a grammar slip.
 */
describe('REFUSAL-PLURAL-01 — a refusal does not say "1 weeks"', () => {
  /**
   * 🔴 MY FIRST VERSION OF THIS ARM STAYED GREEN WHEN I RESTORED THE BUG, and the
   * reason is the class I had just cited one file over: **the population excluded the
   * case at risk.** It swept `current_weekly_km` 10..15 against this file's fixture,
   * where §117 puts §111's door at 8 km, so every refused case had `weeksToBase` of
   * 15/8/5/4/2 and **never 1**. A one-week ramp needs a fixture whose door sits
   * HIGHER, which is what `max_weekday_mins` does.
   *
   * So this arm PROVES it reaches the case before it asserts anything about it.
   */
  function refusalsMentioningWeeks() {
    const out: { cwk: number; message: string; alternatives: string[] }[] = []
    for (let cwk = 8; cwk <= 20; cwk++) {
      const { err } = gen(marathon({
        current_weekly_km: cwk,
        longest_recent_run_km: Math.min(8, cwk),
        max_weekday_mins: 45,
        // 🔴 `user_declared_level`, NOT this file's `fitness_level`. That is the
        // API-level STRUCTURAL override the wizard never sends (`types/plan.ts` says so
        // in as many words), and the two derive DIFFERENT levels, different peaks and a
        // different §111 door. With `fitness_level` the sweep produced **zero** §111
        // refusals and the arm failed honestly rather than passing on an empty set.
        // Searched: 17 input combinations yield a one-week ramp, all of them on
        // `user_declared_level`.
        user_declared_level: 'beginner',
        fitness_level: undefined,
      } as never))
      if (err instanceof BaseVolumeError) {
        out.push({ cwk, message: err.base.message, alternatives: err.base.alternatives })
      }
    }
    return out
  }

  it('the population actually contains a ONE-week ramp', () => {
    const hits = refusalsMentioningWeeks()
    expect(hits.length, 'no §111 refusal at all in the sweep').toBeGreaterThan(0)
    // Without this the arm below can pass by never meeting the case, which is exactly
    // how its first version stayed green on the restored bug.
    expect(
      hits.some(h => /\babout 1 week\b/.test(h.message)),
      `no one-week ramp in the sweep, so the pluralisation arm proves nothing. Messages: `
        + hits.map(h => `${h.cwk}:${h.message.slice(0, 60)}`).join(' | '),
    ).toBe(true)
  })

  it('never renders "1 weeks", in the message or any alternative', () => {
    for (const h of refusalsMentioningWeeks()) {
      expect(h.message, `cwk=${h.cwk}`).not.toMatch(/\b1 weeks\b/)
      for (const alt of h.alternatives) {
        expect(alt, `cwk=${h.cwk}: ${alt}`).not.toMatch(/\b1 weeks\b/)
      }
    }
  })

  /**
   * ⚠️ THE SIBLING COPY IS NOT FIXED BECAUSE IT IS NOT REACHABLE, AND THIS PINS WHY.
   * `baseBuildCopy.ts` renders `${o.weeks} weeks of base building` with no ternary,
   * which looks like the same defect. It is not: `baseBuildOfferLine` has exactly one
   * caller, with `weeks` from `generateGetRunningPlan`, floored at
   * `GET_RUNNING_MIN_WEEKS`. **A defensive ternary would be decoration; asserting the
   * floor catches the day somebody lowers it.**
   */
  it('the base-build offer copy cannot receive 1 week, and the floor is why', () => {
    expect(GENERATION_CONFIG.GET_RUNNING_MIN_WEEKS,
      'GET_RUNNING_MIN_WEEKS dropped below 2, so "1 weeks of base building" is now '
      + 'reachable and baseBuildCopy.ts needs the pluralisation it does not have')
      .toBeGreaterThanOrEqual(2)
  })
})

// ── §111 Amendment 4 — the half marathon is inside §111 (Coaching Board 2026-11-07, HM-BASE-RATIO-SCOPE-01) ──
//
// 🔴 WHY. The SAME runner — 5 km/week, 5 km longest run, declared beginner, 3 days — got a staged base-build block
// for the MARATHON and a 17-week RACE PLAN for the HALF at **6.80×**, week 1 at 14 km against the 5 they run
// (**+180%**). "Type the harder race, get the SAFER answer", the inverse of `STAGED-HM-DOOR-01` and the same root
// cause: a `>= 42` in `baseBuildRatioApplies` that §111's text never gave a reason for.
//
// Measured over 920 production-shaped inputs (4 distances × 12 volumes × 5 longest runs × 5 runways, longest ≤
// weekly), before and after: **80 changed, every one at 21.1 km**, and the transitions were
// `race:OVERCAP → base_build:ok` (51), `refused:long_run_readiness → base_build:ok` (**14 runners RESCUED from an
// outright refusal**), and 15 rows at `cw ≤ 2` whose ratio denominator is zero — a label artefact the marathon's own
// staged blocks already carried, and `INV-PLAN-STAGED-DOOR-RATIO` reports every one of those doors compliant.
// **SERVED → REFUSED: 0**, which was Willy's blocking condition.
//
// ⚠️ PRODUCTION SHAPE. These arms set `user_declared_level`, never `fitness_level` — the helpers above predate
// `COHORT-GRID-UNSET-LEVEL-01` and `fitness_level` is the structural override no wizard caller sends.
describe('§111 Am. 4 — the half marathon is governed, at the same 4.0 cap', () => {
  const hm = (over: Partial<Record<string, unknown>> = {}): GeneratorInput => ({
    age: 38, goal: 'finish', race_distance_km: 21.1, race_date: raceDate(20), days_available: 3,
    current_weekly_km: 5, longest_recent_run_km: 5, user_declared_level: 'beginner', training_age: '1-2yr',
    recent_quality_training: 'occasional', injury_history: [], acknowledged_prep_warning: true,
    max_hr: 185, resting_hr: 55, ...over,
  } as unknown as GeneratorInput)

  it('the scope: 21 km and up, and NOT the shorter distances', () => {
    expect(GENERATION_CONFIG.BASE_BUILD_RATIO_MIN_DISTANCE_KM).toBe(21)
    for (const d of [21, 21.1, 42.2, 50]) expect(assessBaseBuild({ weeks: [] } as unknown as Plan, hm({ race_distance_km: d })).applies, `${d} km`).toBe(true)
    // ⚠️ 5K and 10K are over the cap too — 45 and 57 of the 920 cases — and the board did NOT rule on them.
    // `SHORT-DISTANCE-RAMP-SCOPE-01`. §116 Am. 11's staged-door objection is now the ONLY ratio guard there.
    for (const d of [5, 10, 20.9]) expect(assessBaseBuild({ weeks: [] } as unknown as Plan, hm({ race_distance_km: d })).applies, `${d} km`).toBe(false)
  })

  it('🔴 the engine REFUSES the over-cap half, and the runner the board admitted still generates', () => {
    // The reckless end: the two LIVE half plans sat at 5.40× and 6.80×. This is the 6.80× runner's input.
    expect(() => generateRulePlan(hm(), 'paid', PLAN_START)).toThrowError(BaseVolumeError)
    // The admission floor the chair fixed for the HALF: the lowest documented HM persona in the repo is 10 km/week
    // = 3.40×. If this ever throws, the cap has stopped admitting a cohort we design for.
    const ok = generateRulePlan(hm({ current_weekly_km: 10 }), 'paid', PLAN_START)
    const a = assessBaseBuild(ok, hm({ current_weekly_km: 10 }))
    expect(a.exceeded, `10 km/week persona scored ${a.ratio?.toFixed(2)}× against the ${a.cap} cap`).toBe(false)
    expect(a.ratio!).toBeLessThan(GENERATION_CONFIG.MAX_BASE_BUILD_RATIO)
  })

  it('🔴 INV-PLAN-BASE-BUILD-RATIO IS SEEN TO FIRE AT THE HALF, not assumed to extend', () => {
    // The board's third amendment: the invariant reads `assessBaseBuild`, so it extends with the scope BY
    // CONSTRUCTION — "which is exactly why it must be falsified rather than assumed. A check that extends silently
    // is a check nobody has seen fire at the new distance."
    const input = hm({ current_weekly_km: 10 })
    const clean = generateRulePlan(input, 'paid', PLAN_START)
    expect(validatePlan(clean, input).map(v => v.code)).not.toContain('INV-PLAN-BASE-BUILD-RATIO')
    // Inflate one training week past the cap: 10 km/week × 4.0 = 40, so 45 is over by construction.
    const over = JSON.parse(JSON.stringify(clean)) as Plan
    const peakWeek = over.weeks.find(w => w.phase !== 'foundation' && w.n > 0 && w.type !== 'race')!
    peakWeek.weekly_km = 45
    expect(deliveredPeakKm(over)).toBe(45)
    expect(validatePlan(over, input).map(v => v.code),
      'the §111 backstop must fire on a half-marathon plan that reaches the validator over the ceiling')
      .toContain('INV-PLAN-BASE-BUILD-RATIO')
  })
})
