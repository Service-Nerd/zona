import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
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
    expect(gen(marathon({ current_weekly_km: 8, longest_recent_run_km: 6 })).plan).toBeNull()
  })

  it('a current volume of 0 is refused (cannot build a marathon off no base)', () => {
    const { plan, err } = gen(marathon({ current_weekly_km: 0, longest_recent_run_km: 0 }))
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
