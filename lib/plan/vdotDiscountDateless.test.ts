import { describe, it, expect } from 'vitest'
import { applyVdotDiscount } from './ruleEngine'
import { benchmarkFreshness } from './goalPaceReach'
import { validatePlan } from './invariants'
import { generateRulePlan } from './ruleEngine'
import { GENERATION_CONFIG as G } from './generationConfig'
import { slowGoalDates } from './slowGoalGrid'
import type { BenchmarkInput, GeneratorInput } from '@/types/plan'

/**
 * §10 Amendment (Coaching Board 2026-11-16, BENCHMARK-DATELESS-FRESH-01) — a benchmark with no
 * date is DECLARED, never priced.
 *
 * 📐 **8 of 23 live benchmark plans carry no date**, the founder's 2026 plan built on a 2024 10K
 * among them, and every one is priced at §10's 3% base — its LEAST conservative figure, for the
 * runner whose fitness the engine knows least about.
 *
 * 🔴 **THE OBVIOUS FIX WAS BUILT, MEASURED AND REVERTED THE SAME DAY, and this file is where that
 * is recorded.** Giving a dateless benchmark the ramp's ceiling fails on three counts:
 *   · §10's `VDOT-STALENESS-CURVE-01` (2026-11-07) holds the ramp's SHAPE to be INSUFFICIENT
 *     EVIDENCE — re-open trigger 20+ benchmarked runners at ≥ 8 weeks of logged runs, measured
 *     **10** — so pricing an unknown age through that curve is a NEW application of it;
 *   · measured on production, **all 8 dateless plans were built within 143 days, six within 54**,
 *     and the ceiling is the 964-day figure, so it is wrong IN FACT for six of eight;
 *   · ⚕️ Sims: it penalises a runner for a field the product never required.
 *
 * 🔑 So the engine declares the unknown and the real fix is upstream — `benchmarkFromFields` does
 * `v.date ? { benchmark_date: v.date } : {}` (`BENCHMARK-DATE-REQUIRED-01`).
 */

const RAW = 41.0
const TODAY = new Date('2026-11-16')
const ago = (days: number) => {
  const d = new Date(TODAY); d.setDate(d.getDate() - days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dated = (d: string): BenchmarkInput => ({ type: 'race', distance_km: 10, time: '0:52:00', benchmark_date: d })
const dateless: BenchmarkInput = { type: 'race', distance_km: 10, time: '0:52:00' }

describe('§10 Am. — the ramp is untouched, and a dateless benchmark is not priced', () => {
  it('🔴 a dateless benchmark keeps the BASE — no figure is invented for it', () => {
    expect(applyVdotDiscount(RAW, dateless, TODAY).discountPct).toBe(G.VDOT_CONSERVATIVE_DISCOUNT_PCT)
  })

  it('🔑 the ramp holds rung by rung, so a future change to the CURVE cannot hide behind this amendment', () => {
    const at = (days: number) => applyVdotDiscount(RAW, dated(ago(days)), TODAY).discountPct
    expect(at(7)).toBe(3)
    expect(at(37)).toBe(4)
    expect(at(64)).toBe(5)
    expect(at(92)).toBe(6)
    expect(at(120)).toBe(7)
    expect(at(964), 'the oldest live benchmark, 2024-03-27').toBe(7)
    expect(at(5000), 'the ceiling was NOT raised — VDOT-STALENESS-CURVE-01 stays insufficient').toBe(7)
    expect(G.VDOT_STALENESS_MAX_DISCOUNT_PCT, 'the vacated ruling would have made this 10').toBe(7)
  })

  it('🔑 `benchmarkFreshness` reads the unknown correctly, and always did', () => {
    // Two readings of one fact. The runner-facing LEVER has always treated a dateless benchmark as
    // stale-or-unknown; only the discount ever disagreed, and the resolution was to stop asking the
    // discount to answer a question it has no input for.
    expect(benchmarkFreshness({ hasDate: false, discountPct: G.VDOT_CONSERVATIVE_DISCOUNT_PCT })).toBe('stale_or_unknown')
    expect(benchmarkFreshness({ hasDate: true, discountPct: G.VDOT_CONSERVATIVE_DISCOUNT_PCT })).toBe('fresh')
  })
})

describe('§10 Am. — INV-PLAN-VDOT-DISCOUNT-DATELESS declares it on the plan', () => {
  const { planStart, benchmarkDate } = slowGoalDates()
  const raceIn = (weeks: number) => {
    const d = new Date(planStart); d.setDate(d.getDate() + weeks * 7)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const input = (b: BenchmarkInput): GeneratorInput => ({
    race_date: raceIn(16), race_distance_km: 21.1, goal: 'time_target', target_time: '2:00:00',
    benchmark: b, age: 40, resting_hr: 55, max_hr: 180, days_available: 4,
    current_weekly_km: 35, longest_recent_run_km: 15,
    preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  } as unknown as GeneratorInput)
  const fire = (b: BenchmarkInput) => {
    const i = input(b)
    const plan = generateRulePlan(i, 'trial', planStart, undefined, planStart)
    return validatePlan(plan, i).filter(v => v.code === 'INV-PLAN-VDOT-DISCOUNT-DATELESS')
  }

  it('🔴 fires on a dateless benchmark, at `warn`, naming the base it was priced at', () => {
    const v = fire({ type: 'race', distance_km: 10, time: '0:52:00' })
    expect(v.length, 'the unknown is not declared on the plan').toBe(1)
    expect(v[0].severity, 'an error would throw in dev and test on correct history').toBe('warn')
    expect(v[0].message).toContain('no date')
  })

  it('🔑 and is SILENT on a dated one — the arm that stops it firing on every plan', () => {
    expect(fire({ type: 'race', distance_km: 10, time: '0:52:00', benchmark_date: benchmarkDate })).toEqual([])
  })
})
