import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { generateFoundationBlock } from './foundationBlock'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * Coaching Board — Coaching-1: the foundation long run must not exceed
 * FOUNDATION_LONG_RUN_MAX_PCT (35%) of the week's volume. Previously 50%, which
 * §9 calls a within-week binge. Backs the config change + the new
 * INV-PLAN-FOUNDATION-BLOCK long-run arm.
 */

const FROZEN_NOW = new Date('2026-08-01T09:00:00Z')
const PLAN_START = '2026-09-07'   // ~37-day gap → a 3-week foundation block

const INPUT: GeneratorInput = {
  race_date: '2026-11-29', race_distance_km: 10, goal: 'time_target', target_time: '0:44:59',
  days_available: 4, age: 43, current_weekly_km: 40, longest_recent_run_km: 18,
  resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
  benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

function planWithFoundation(): { plan: Plan; foundationWeeks: Plan['weeks'] } {
  const main = generateRulePlan(INPUT, 'paid', PLAN_START)
  const fb = generateFoundationBlock({ input: INPUT, planStartDate: PLAN_START, today: '2026-08-01' })
  return { plan: { ...main, weeks: [...fb.weeks, ...main.weeks] }, foundationWeeks: fb.weeks }
}

function runKmsOf(w: Plan['weeks'][number]): number[] {
  return Object.values(w.sessions)
    .filter(s => s && s.type !== 'rest' && s.type !== 'cross-train')
    .map(s => s?.distance_km ?? 0)
}

describe('foundation long-run cap (Coaching-1)', () => {
  it('config is 35%, not the old 50%', () => {
    expect(GENERATION_CONFIG.FOUNDATION_LONG_RUN_MAX_PCT).toBe(35)
  })

  it('the generator keeps every foundation long run within 35% of the week', () => {
    const { foundationWeeks } = planWithFoundation()
    expect(foundationWeeks.length).toBeGreaterThan(0)
    for (const w of foundationWeeks) {
      const runs = runKmsOf(w)
      if (runs.length < 3) continue
      const longest = Math.max(...runs)
      expect(longest, `W${w.n} long run ${longest} vs 35% of ${w.weekly_km}`)
        .toBeLessThanOrEqual(w.weekly_km * 0.35 + 0.01)
    }
  })

  // Scoped to the long-run arm (message contains "long run") so this isolates the
  // Coaching-1 addition from a separate, pre-existing quirk of the invariant's
  // volume arm (it checks ≤ current_weekly_km, but §57 permits growth to
  // baseline × 1.10 — a distinct finding, out of scope here).
  const longRunErrs = (plan: Plan) =>
    validatePlan(plan, INPUT).filter(v =>
      v.code === 'INV-PLAN-FOUNDATION-BLOCK' && /long run/i.test(v.message))

  it('a compliant plan raises no foundation long-run violation', () => {
    const { plan } = planWithFoundation()
    const errs = longRunErrs(plan)
    expect(errs, errs.map(v => v.message).join('\n')).toHaveLength(0)
  })

  it('the volume arm accepts growth to baseline × 1.10 and rejects above it', () => {
    // Real foundation weeks grow to ~baseline × 1.10 (44km for a 40km baseline).
    // §57 permits this; the arm must NOT flag it (it used to, at the flat baseline).
    const { plan } = planWithFoundation()
    const volErr = (p: Plan) => validatePlan(p, INPUT)
      .filter(v => v.code === 'INV-PLAN-FOUNDATION-BLOCK' && /baseline ceiling/i.test(v.message))
    expect(volErr(plan), volErr(plan).map(v => v.message).join('\n')).toHaveLength(0)
    // Above the ceiling → flag.
    const fw = plan.weeks.find(w => w.phase === 'foundation')!
    fw.weekly_km = (INPUT.current_weekly_km ?? 40) * 1.5
    expect(volErr(plan).length).toBeGreaterThan(0)
  })

  it('the invariant catches a foundation long run inflated back to 50%', () => {
    const { plan } = planWithFoundation()
    // Inflate the longest run of the first ≥3-run foundation week to 50% of the week.
    const fw = plan.weeks.find(w => w.phase === 'foundation' && runKmsOf(w).length >= 3)!
    const longDay = Object.entries(fw.sessions)
      .filter(([, s]) => s && s.type !== 'rest' && s.type !== 'cross-train')
      .sort(([, a], [, b]) => (b?.distance_km ?? 0) - (a?.distance_km ?? 0))[0][0]
    ;(fw.sessions as Record<string, { distance_km?: number }>)[longDay].distance_km = fw.weekly_km * 0.5
    expect(longRunErrs(plan).length).toBeGreaterThan(0)
  })
})
