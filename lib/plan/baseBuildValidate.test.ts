import { describe, it, expect } from 'vitest'
import { assessOnRamp, generateBaseBuildPlan } from './baseBuildOnRamp'
import { validateBaseBuildBlock } from './baseBuildValidate'
import { GENERATION_CONFIG as C } from './generationConfig'
import type { GeneratorInput, Week } from '@/types/plan'

const input = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 42.195, race_date: '2027-04-25', days_available: 4,
  goal: 'finish', fitness_level: 'beginner', current_weekly_km: 8,
  longest_recent_run_km: 3, age: 32, injuries: [],
  recent_quality_training: 'none', training_age: '<6mo',
  ...over,
} as unknown as GeneratorInput)

const build = (over: Partial<GeneratorInput> = {}) => {
  const i = input(over)
  const a = assessOnRamp(i, 18, 29)
  return { a, plan: generateBaseBuildPlan(i, '2026-10-05', a) }
}
const clone = (w: Week[]) => JSON.parse(JSON.stringify(w)) as Week[]

describe('§116 — a generated on-ramp plan is valid', () => {
  it('generates a standalone plan: positive weeks, own kind, own phase', () => {
    const { plan } = build()
    expect((plan.meta as any).plan_kind).toBe('base_build')
    expect((plan.meta as any).base_build_onramp).toBe(true)
    // ⚠️ No race date. A base-build plan has no start line and a countdown
    // against one would be the plan claiming something it does not deliver.
    expect((plan.meta as any).race_date).toBe('')
    expect(plan.weeks[0].n).toBe(1)
    expect(plan.weeks.every(w => w.phase === 'base_build')).toBe(true)
  })

  // THE GATE. 36 of 36 generatable ramps were clean when this shipped; two
  // were NOT before §45's progression cap was applied to the ramp's long run.
  it('every generatable ramp validates clean', () => {
    const bad: string[] = []
    for (const cwk of [6, 7, 8, 10, 12, 15])
      for (const days of [3, 4, 5])
        for (const lvl of ['beginner', 'intermediate'] as const) {
          const { a, plan } = build({ current_weekly_km: cwk, days_available: days, fitness_level: lvl })
          if (a.outcome !== 'offered') continue
          const v = validateBaseBuildBlock(plan.weeks, a.startKm)
          if (v.length) bad.push(`cwk=${cwk} days=${days} ${lvl}: ${v[0].message}`)
        }
    expect(bad, bad.join('\n')).toEqual([])
  })
})

describe('§116 — each board amendment, falsified', () => {
  it('amendment 1: catches a FLAT ramp — the §57 defect this exists to close', () => {
    const { a, plan } = build()
    const w = clone(plan.weeks)
    for (const x of w) x.weekly_km = w[0].weekly_km
    const v = validateBaseBuildBlock(w, a.startKm)
    expect(v.map(x => x.code)).toContain('INV-PLAN-ONRAMP-CURVE-CLIMBS')
  })

  it('amendment 7: catches a handover on a deload week', () => {
    const { a, plan } = build()
    const w = clone(plan.weeks)
    w[w.length - 1].type = 'deload'
    expect(validateBaseBuildBlock(w, a.startKm).some(x =>
      /ends on a DELOAD/.test(x.message))).toBe(true)
  })

  it('amendment 6: catches quality in an all-easy block', () => {
    const { a, plan } = build()
    const w = clone(plan.weeks)
    ;(w[1].sessions as any).thu = { type: 'tempo', label: 'Tempo', distance_km: 6, duration_mins: 30 }
    expect(validateBaseBuildBlock(w, a.startKm).map(x => x.code))
      .toContain('INV-PLAN-ONRAMP-ALL-EASY')
  })

  // ⚠️ THE ONE THAT FOUND A REAL DEFECT. Amendment 2 was ratified, written into
  // §116, and had NO implementation until the first ramp plan was generated end
  // to end. It then fired on 4 of 36 ramps: the longest run jumped 4.3 -> 6.7 km
  // (+56%) the week the session count crossed the long-run threshold, while the
  // WEEKLY volume rose its lawful 10% throughout.
  it('amendment 2: catches a per-run step the weekly cap cannot see', () => {
    const { a, plan } = build()
    const w = clone(plan.weeks)
    for (const s of Object.values(w[2].sessions)) {
      if (s && s.type !== 'rest') { (s as any).distance_km = 40; break }
    }
    expect(validateBaseBuildBlock(w, a.startKm).map(x => x.code))
      .toContain('INV-PLAN-ONRAMP-PER-RUN-STEP')
  })

  it('the per-run cap is §2 Am.2s existing number, not a new one', () => {
    expect(C.WEEK1_PER_RUN_STEP_MAX_KM).toBe(1.5)
  })
})
