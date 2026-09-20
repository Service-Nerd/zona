import { describe, it, expect } from 'vitest'
import { generateGetRunningPlan, getRunningWeeks, getRunningApplies } from './getRunningPlan'
import { validateBaseBuildBlock } from './baseBuildValidate'
import { GENERATION_CONFIG as G } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const mk = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 3,
  goal: 'finish', fitness_level: 'beginner', current_weekly_km: 5,
  longest_recent_run_km: 2, age: 32, injuries: [],
  recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

describe('§118 — the get-running plan', () => {
  it('is a plan with NO RACE, and says so in its own metadata', () => {
    const { plan } = generateGetRunningPlan(mk(), '2026-10-05', 29)
    // ⚠️ `base_build`, not `get_running` — SLT decision, and `plan_kind` is
    // PERSISTED so it had to be settled before any plan stored it.
    expect((plan.meta as any).plan_kind).toBe('base_build')
    expect((plan.meta as any).race_date).toBe('')
    // ⚠️ The §116 marker must be GONE. Leaving it would let a downstream reader
    // infer a marathon handover that does not exist — a plan claiming a
    // destination it has not got.
    expect((plan.meta as any).base_build_onramp).toBeUndefined()
  })

  it('serves every runner the race plans refuse', () => {
    for (const cwk of [2, 3, 4, 5, 6, 7, 8]) {
      const { plan } = generateGetRunningPlan(mk({ current_weekly_km: cwk }), '2026-10-05', 29)
      expect(validateBaseBuildBlock(plan.weeks, cwk), `cwk ${cwk}`).toEqual([])
    }
  })

  // ⚠️ AMENDMENT 1, AND THE NUMBER IS PHYSIOLOGICAL, NOT EDITORIAL. 16 weeks
  // was chosen for legibility and compounds to a 4.17x total build, above
  // §111's 4.0. Every week lawful, the sum not.
  it('never builds past §111s total-build ceiling, at any start', () => {
    for (const cwk of [2, 3, 5, 7, 8]) {
      const { plan, endsAtKm } = generateGetRunningPlan(mk({ current_weekly_km: cwk }), '2026-10-05', 29)
      const ratio = endsAtKm / cwk
      expect(ratio, `cwk ${cwk} builds ${ratio.toFixed(2)}x`).toBeLessThanOrEqual(G.MAX_BASE_BUILD_RATIO)
      expect(validateBaseBuildBlock(plan.weeks, cwk).map(v => v.code))
        .not.toContain('INV-PLAN-GET-RUNNING-BUILD-RATIO')
    }
  })

  // The ratio is a property of the CURVE, not the runner — which is why the fix
  // was one number and not a per-runner cap.
  it('builds by the same RATIO whatever the start — it is the curve, not the runner', () => {
    const ratios = [2, 3, 5, 7].map(cwk => {
      const { endsAtKm } = generateGetRunningPlan(mk({ current_weekly_km: cwk }), '2026-10-05', 29)
      return endsAtKm / cwk
    })
    for (const r of ratios) expect(r).toBeCloseTo(ratios[0], 1)
  })

  it('the invariant catches a build past the ceiling that no week-on-week rule can see', () => {
    const { plan } = generateGetRunningPlan(mk(), '2026-10-05', 29)
    // Inflate only the LAST week: every week-on-week check is blind to this.
    plan.weeks[plan.weeks.length - 1].weekly_km = 999
    expect(validateBaseBuildBlock(plan.weeks, 5).map(v => v.code))
      .toContain('INV-PLAN-GET-RUNNING-BUILD-RATIO')
  })

  it('sizes itself to the runway, between the declared bounds', () => {
    expect(getRunningWeeks(4)).toBe(G.GET_RUNNING_MIN_WEEKS)
    expect(getRunningWeeks(11)).toBe(11)
    expect(getRunningWeeks(40)).toBe(G.GET_RUNNING_MAX_WEEKS)
    expect(G.GET_RUNNING_MAX_WEEKS).toBe(15)
  })

  it('declines a runner with no base at all rather than inventing one', () => {
    expect(getRunningApplies(mk({ current_weekly_km: 0 }))).toBe(false)
  })
})
