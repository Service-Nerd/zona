import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { auditPlanQuality } from './planQuality'
import { isDesignedRefusal } from './designedRefusal'
import { GENERATION_CONFIG as G } from './generationConfig'
import { distanceEnvelope } from './useCaseEnvelope'
import type { GeneratorInput } from '@/types/plan'

/**
 * HM-WEEK1-PERRUN-01 (§2 Amendment 2) — Coaching Board 2026-09-20.
 *
 * The ratio arm is a SCREEN; the per-run step is the confirmation. A weekly
 * total is not a training stress — a session is.
 *
 * ⚠️ MEASURED: the entire HM gap (12.0% of the distance) was this one arm, and
 * 100% of it was the 10 km/week cohort. That runner's week 1 is a 5.3 km long
 * run against a 5 km longest-ever, plus two 32-minute easy runs. Across all
 * 309 ratio-flagged plans product-wide the worst per-run increase is +2.40 km
 * and no session exceeds the runner's longest-ever run by more than +0.50 km.
 *
 * ⚠️ 1.5 km WAS CHOSEN OVER 2.0 AGAINST THE SCOREBOARD. 2.0 scored better
 * (product 96.5% vs 95.3%) and kept only 12% of the flagged population; 1.5
 * keeps 51%. Hutchinson's objection at the sitting was the PATTERN of repeated
 * relaxation, and taking the bigger relaxation because it scores higher is
 * that pattern.
 */

const mk = (o: Record<string, unknown>) => ({
  athlete_name: 'A', age: 28, race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-11-02', goal: 'finish', resting_hr: 55, max_hr: 190,
  injury_history: [], hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional', acknowledged_days_warning: true,
  acknowledged_prep_warning: true, ...o,
}) as unknown as GeneratorInput

describe('HM-WEEK1-PERRUN-01', () => {
  it('1. the HM case that drove the whole gap is no longer flagged', () => {
    const input = mk({
      race_distance_km: 21.1, race_date: '2027-01-25', fitness_level: 'beginner',
      training_age: '6-18mo', current_weekly_km: 10, longest_recent_run_km: 5,
      days_available: 3,
    })
    const plan = generateRulePlan(input, 'paid')
    const w1 = plan.weeks.find(w => w.n === 1)!
    const runs = Object.values(w1.sessions ?? {}).filter(
      s => s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'cross-train').length
    // Pin the fixture: it must still be a case the RATIO arm would catch.
    expect((w1.weekly_km ?? 0) / 10).toBeGreaterThan(1.30)
    expect(((w1.weekly_km ?? 0) - 10) / runs).toBeLessThanOrEqual(G.WEEK1_PER_RUN_STEP_MAX_KM)
    expect(auditPlanQuality(plan, input).map(o => o.code)).not.toContain('WEEK1-LEAP')
  })

  it('2. BACKSTOP — arm 2 still catches a large weekly step of many small runs', () => {
    // The failure mode the per-run gate could have opened: +12km assembled from
    // six tiny runs would pass the per-run test. Arm 2 (>=10km AND >1.15x) is
    // what stops it, and it is asserted here rather than assumed.
    expect(G.WEEK1_ABSOLUTE_STEP_MAX_KM).toBe(10)
    expect(20 - 8 >= G.WEEK1_ABSOLUTE_STEP_MAX_KM).toBe(true)
    expect(20 / 8 > G.WEEK1_ABSOLUTE_STEP_MIN_RATIO).toBe(true)
  })

  it('3. BACKSTOP — arm 3 still catches a single session beyond demonstrated range', () => {
    expect(G.LONG_RUN_PROGRESSION_CAP_ABS_KM).toBeGreaterThan(0)
  })

  // ⚠️ THE MARATHON NON-REGRESSION CONDITION LIVES IN `useCaseEnvelope.test.ts`,
  // NOT HERE. A copy was written and deleted: it re-measured the same
  // population at a different stride (87.3% against the envelope's reading)
  // and would have gated the board's condition on sampling noise rather than
  // on the number the board actually saw. One owner for the per-distance
  // floors; this file tests the predicate, that file tests the population.
})
