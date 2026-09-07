import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * §94 — §2 measured at delivery for healthy runners (CB-RAMP-02).
 * §95 — a deload may not fall on a phase's second week (CB-DELOAD-02).
 *
 * Both ship as CHECKS rather than producer changes, so the tests that matter
 * most are the falsification ones: an invariant nobody has watched go red is
 * not evidence of anything.
 */

const FROZEN_NOW = new Date('2026-09-07T09:00:00Z')

const tenK = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: '2026-12-12', race_distance_km: 10, goal: 'time_target',
  target_time: '0:45:00', benchmark: { type: 'race', distance_km: 10, time: '0:49:00' },
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 44,
  resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
  training_age: '2-5yr', user_declared_level: 'experienced',
  recent_quality_training: 'regular', ...o,
} as GeneratorInput)

const codes = (p: Plan, i: GeneratorInput, code: string) =>
  validatePlan(p, i).filter(v => v.code === code)

/** Add `km` to a week's easy sessions so the week's delivered volume rises. */
function inflateEasy(w: Week, km: number): Week {
  const sessions = { ...w.sessions }
  for (const [day, s] of Object.entries(sessions)) {
    if (s && s.type === 'easy' && s.distance_km != null) {
      sessions[day as keyof typeof sessions] = { ...s, distance_km: s.distance_km + km }
    }
  }
  return { ...w, sessions }
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§94 — INV-PLAN-DELIVERED-RAMP', () => {
  it('FALSIFICATION — goes RED on a hand-inflated week above chronic load', () => {
    const input = tenK()
    const plan = generateRulePlan(input, 'paid')

    // Find a normal, non-taper week whose predecessor is also normal, and make
    // it obviously too big. Both must sit above current_weekly_km for §94 to
    // bind at all — that is the scope, not an accident of the fixture.
    const idx = plan.weeks.findIndex((w, i) =>
      i > 0 && w.n >= 1 && w.type === 'normal' && w.phase !== 'taper' &&
      plan.weeks[i - 1].type === 'normal' && plan.weeks[i - 1].n >= 1)
    expect(idx, 'fixture must contain a normal->normal pair').toBeGreaterThan(0)

    const sabotaged: Plan = {
      ...plan,
      weeks: plan.weeks.map((w, i) => i === idx ? inflateEasy(w, 12) : w),
    }
    const fired = codes(sabotaged, input, 'INV-PLAN-DELIVERED-RAMP')
    expect(fired.length, 'a +12km easy inflation must be caught').toBeGreaterThan(0)
    expect(fired[0].severity).toBe('warn')
  })

  it('does NOT fire while the plan ramps up toward the runner stated volume', () => {
    // The scope that took the first draft from 44.4% of plans to 17.0%. A runner
    // on 70 km/wk given a conservative early block is not spiking anything, however
    // steep the week-on-week percentage looks.
    const input = tenK({ current_weekly_km: 70, longest_recent_run_km: 24, days_available: 5 })
    const plan = generateRulePlan(input, 'paid')
    const below = plan.weeks.filter(w => {
      const km = Object.values(w.sessions).reduce((a, s) => a + (s?.distance_km ?? 0), 0)
      return w.n >= 1 && km <= input.current_weekly_km
    })
    expect(below.length, 'fixture should contain weeks under stated volume').toBeGreaterThan(0)
    for (const v of codes(plan, input, 'INV-PLAN-DELIVERED-RAMP')) {
      const w = plan.weeks.find(x => x.n === v.week)!
      const km = Object.values(w.sessions).reduce((a, s) => a + (s?.distance_km ?? 0), 0)
      expect(km, `W${v.week} flagged while at/below chronic load`).toBeGreaterThan(input.current_weekly_km)
    }
  })

  it('leaves the post-deload bounceback alone — §2, settled 2026-09-06', () => {
    // The board built, measured and REJECTED a healthy bounceback cap. §94 must
    // not reintroduce it through the delivered door.
    const input = tenK()
    const plan = generateRulePlan(input, 'paid')
    for (const v of codes(plan, input, 'INV-PLAN-DELIVERED-RAMP')) {
      const i = plan.weeks.findIndex(w => w.n === v.week)
      const prev = plan.weeks[i - 1]
      expect(prev.type === 'deload' || prev.badge === 'deload',
        `W${v.week} is a post-deload bounceback and must be exempt`).toBe(false)
    }
  })

  it('never fires for an injury-history runner — §90 owns them, more strictly', () => {
    const input = tenK({ injury_history: ['Left knee, posterior, recurring'] })
    const plan = generateRulePlan(input, 'paid')
    expect(codes(plan, input, 'INV-PLAN-DELIVERED-RAMP')).toHaveLength(0)
  })
})

describe('§95 — INV-PLAN-DELOAD-PHASE-POSITION', () => {
  it('FALSIFICATION — goes RED when a deload sits at build position 2', () => {
    // §91 moved the phase boundary so this no longer reproduces from generation.
    // That is precisely why the check must be shown failing on a constructed
    // case: the defect is MASKED, not repaired (SC-10's lesson), and a check
    // that has only ever been observed green proves nothing.
    const input = tenK()
    const plan = generateRulePlan(input, 'paid')
    expect(codes(plan, input, 'INV-PLAN-DELOAD-PHASE-POSITION'),
      'the shipped plan is clean').toHaveLength(0)

    const buildWeeks = plan.weeks.filter(w => w.n >= 1 && w.phase === 'build')
    expect(buildWeeks.length, 'fixture needs a build phase of 2+ weeks').toBeGreaterThan(1)
    const secondBuildWeek = buildWeeks[1].n

    const sabotaged: Plan = {
      ...plan,
      weeks: plan.weeks.map(w =>
        w.n === secondBuildWeek ? { ...w, type: 'deload' as const } : w),
    }
    const fired = codes(sabotaged, input, 'INV-PLAN-DELOAD-PHASE-POSITION')
    expect(fired, 'position-2 deload must be caught').toHaveLength(1)
    expect(fired[0].week).toBe(secondBuildWeek)
    expect(fired[0].severity).toBe('warn')
  })

  it('does not fire on a deload at position 3 or later', () => {
    const input = tenK()
    const plan = generateRulePlan(input, 'paid')
    const buildWeeks = plan.weeks.filter(w => w.n >= 1 && w.phase === 'build')
    if (buildWeeks.length < 3) return
    const thirdBuildWeek = buildWeeks[2].n
    const shifted: Plan = {
      ...plan,
      weeks: plan.weeks.map(w =>
        w.n === thirdBuildWeek ? { ...w, type: 'deload' as const } : w),
    }
    expect(codes(shifted, input, 'INV-PLAN-DELOAD-PHASE-POSITION')).toHaveLength(0)
  })
})

describe('§94 — the cap it enforces is the declared one', () => {
  it('tracks MAX_WEEKLY_VOLUME_INCREASE_PCT rather than a literal', () => {
    // Configuration Singularity: the delivered check mirrors the curve
    // enforcement, so if §2's cap moves they must move together. Proved by
    // reading the threshold back out of a real violation message rather than by
    // asserting the constant against itself.
    const input = tenK()
    const plan = generateRulePlan(input, 'paid')
    const idx = plan.weeks.findIndex((w, i) =>
      i > 0 && w.n >= 1 && w.type === 'normal' && w.phase !== 'taper' &&
      plan.weeks[i - 1].type === 'normal' && plan.weeks[i - 1].n >= 1)
    const sabotaged: Plan = {
      ...plan,
      weeks: plan.weeks.map((w, i) => i === idx ? inflateEasy(w, 12) : w),
    }
    const fired = codes(sabotaged, input, 'INV-PLAN-DELIVERED-RAMP')
    expect(fired.length).toBeGreaterThan(0)
    expect(fired[0].expected).toContain(String(GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT))
  })
})
