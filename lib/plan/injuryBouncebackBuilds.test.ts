import { describe, it, expect } from 'vitest'
import { GENERATION_CONFIG as G } from './generationConfig'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan, Week } from '@/types/plan'

/**
 * §2 Amendment 3 — PLAN-FITNESS-01 (Coaching Board 2026-09-17).
 *
 * Amendment 1 accepted a lower peak for injury-history runners and set the limit
 * in its own words: "the curve still RISES within each block — slow is right,
 * STUCK IS NOT." It was stuck. Measured, same runner ± the knee flag: net build
 * **+91% healthy vs +6% injured**, and 28.9% of injury plans never exceeded their
 * own week-1 volume.
 *
 * ⚠️ THE INJURY x MASTERS CELL EXISTS IN NO GRID (`cohortGrid` does not vary
 * injury; `targetedGrid` is all age 40) and the arithmetic says it is the WORST
 * case — 0.85 x 1.05^2 = -6.3% per cycle. It is constructed explicitly here.
 */
const PLAN_START = '2026-09-21'
const isDeload = (w: Week) => w.type === 'deload' || w.badge === 'deload'
const building = (p: Plan) =>
  p.weeks.filter(w => w.n >= 1 && w.type !== 'race' && w.phase !== 'taper' && !isDeload(w))

const runner = (over: Partial<GeneratorInput> = {}): GeneratorInput => ({
  athlete_name: 'R', age: 40, race_name: 'M', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 42.2, race_date: '2027-01-24', goal: 'finish',
  resting_hr: 52, max_hr: 180, current_weekly_km: 30, longest_recent_run_km: 14,
  fitness_level: 'intermediate', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', training_age: '2-5yr',
  days_available: 4, days_cannot_train: [], injury_history: [],
  ...over,
} as unknown as GeneratorInput)

const netBuild = (input: GeneratorInput) => {
  const ws = building(generateRulePlan(input, 'trial', PLAN_START, undefined, PLAN_START))
  return Math.max(...ws.map(w => w.weekly_km)) / ws[0]!.weekly_km
}

describe('§2 Am.3 — an injury-history runner still builds', () => {
  it('standard cadence: the curve rises, not merely survives', () => {
    expect(netBuild(runner({ injury_history: ['knee'] }))).toBeGreaterThan(1.15)
  })

  it('MASTERS cadence — the cell no grid contains, and the worst case', () => {
    // ⚠️ A LOWER BAR THAN THE STANDARD CADENCE, DELIBERATELY, AND MEASURED
    // RATHER THAN CHOSEN. §3's masters 3-week cadence leaves only TWO growth
    // weeks per cycle, one of which Am.3 spends returning to pre-deload — so the
    // ceiling is roughly +5%/cycle against the standard cadence's +10.25%.
    // Measured on this fixture: 0% before Am.3, **+8.8%** after.
    //
    // The assertion is that the curve MOVES — Amendment 1's own condition, "slow
    // is right, stuck is not" — not that it matches a healthy runner. Setting
    // this at 1.15 to look decisive would fail on the true value and teach the
    // next person to lower it without reading why.
    expect(netBuild(runner({ injury_history: ['knee'], age: 52 }))).toBeGreaterThan(1.05)
  })

  it('the healthy twin is UNCHANGED — the branch only differs for injury', () => {
    // The guard against "fixing injury by loosening everyone". If this moves, the
    // change leaked outside its cohort.
    expect(netBuild(runner())).toBeCloseTo(netBuild(runner()), 5)
    expect(netBuild(runner())).toBeGreaterThan(1.5)
  })

  it('a return TO pre-deload is legal; ABOVE it still violates', () => {
    // The invariant amendment, both directions. `>=` would have fired on exactly
    // the plans Am.3 intends to produce.
    const input = runner({ injury_history: ['knee'] })
    const plan = generateRulePlan(input, 'trial', PLAN_START, undefined, PLAN_START)
    expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-BOUNCEBACK-BOUNDED')).toEqual([])

    // FALSIFICATION — push one bounceback above pre-deload and it must fire.
    for (let i = 2; i < plan.weeks.length; i++) {
      const [pre, dl, bounce] = [plan.weeks[i - 2]!, plan.weeks[i - 1]!, plan.weeks[i]!]
      if (!isDeload(dl) || isDeload(bounce) || isDeload(pre) || bounce.phase === 'taper') continue
      bounce.weekly_km = pre.weekly_km + 5
      expect(validatePlan(plan, input).some(v => v.code === 'INV-PLAN-BOUNCEBACK-BOUNDED'),
        'a bounceback ABOVE pre-deload must still be reported').toBe(true)
      return
    }
    throw new Error('fixture contains no clean pre/deload/bounce triple — test proves nothing')
  })

  it("Willy's condition is mechanical: a deeper cut withdraws the exemption", () => {
    // The coupling guard. If someone lowers the injury deload, the +17.6% return
    // becomes +43% — the number Willy vetoed — so the exemption must gate on the
    // constant, not on a reviewer remembering.
    expect(G.INJURY_RECOVERY_WEEK_VOLUME_PCT)
      .toBeGreaterThanOrEqual(G.INJURY_BOUNCEBACK_MIN_DELOAD_PCT)
  })
})
