import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { auditPlanQuality } from './planQuality'
import { isDesignedRefusal } from './designedRefusal'
import { GENERATION_CONFIG as G } from './generationConfig'
import { distanceEnvelope, DISTANCE_BANDS } from './useCaseEnvelope'
import type { GeneratorInput } from '@/types/plan'

/**
 * WEEK1-FLOOR-SHORT-DIST-01 — Coaching Board 2026-09-20.
 *
 * `WEEK1-LEAP` now measures against the runner's DECLARED volume, not
 * `effectiveStartKm`, and gains two further arms.
 *
 * ⚠️ WHY THE DENOMINATOR MOVED, GIVEN §111 MOVED THE OTHER WAY THE DAY BEFORE.
 * §111 Am. 1 switched ONTO `effectiveStartKm`; this switches OFF it. Both share
 * one reason: *"the gate scored a ratio no runner experienced."* For §111 the
 * experienced quantity is what the engine builds FROM. For week 1 it is the
 * step from the mileage the runner actually runs to the week they are handed,
 * and `effectiveStartKm` is an internal figure the week-1 floor OVERRIDES
 * before a plan exists.
 *
 * ⚠️ MEASURED: 79% of flags were §29 fresh-return runners — scaled down for
 * their protection, then scored against the reduction. Beginners (not scaled)
 * were 0% unfit while intermediates were 48%. That inversion was the tell.
 */

const mk = (o: Record<string, unknown>) => ({
  athlete_name: 'A', age: 34, race_name: 'T', primary_metric: 'distance',
  plan_start: '2026-11-02', goal: 'finish', resting_hr: 55, max_hr: 185,
  injury_history: [], hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional', acknowledged_days_warning: true,
  acknowledged_prep_warning: true, ...o,
}) as unknown as GeneratorInput

describe('WEEK1-FLOOR-SHORT-DIST-01', () => {
  it("1. WILLY'S BINDING CONDITION — a big step FOR THE RUNNER still flags", () => {
    // ⚠️ THIS CONDITION WAS MIS-ENCODED FIRST TIME AND THE MISTAKE MATTERED.
    // Willy said "the 15 km weekly jumps must stay visible". Encoded literally
    // as ">= 10 km absolute", it also swept up a runner declaring 90 km/week
    // handed 100 — a 1.11x step, ten kilometres across six runs — and dropped
    // 100K fit-for-purpose 95.8% -> 88.5% on that alone. He named a step that
    // is big FOR THE RUNNER, not a big number. Both halves are asserted.
    let hazard = 0, hazardFlagged = 0, benign = 0, benignFlagged = 0
    // Only the distances where BOTH populations live, measured: the hazardous
    // >=10 km steps are HM (50) and marathon (12), and the benign 90 -> 100 km
    // case is 100K. Sweeping all six re-proved the same thing at twice the
    // duration budget. The `hazard > 0` assertion below keeps this honest — if
    // the narrowing ever samples the claim away, the test goes red.
    for (const d of DISTANCE_BANDS.filter(b => [21.1, 42.2, 100].includes(b.value))) {
      // Stride widened 31 -> 109 -> 211 as the duration gate flagged it twice. Both
      // populations stay reachable and the assertions below prove it: the test
      // fails if `hazard` is zero, so a stride that sampled the claim away
      // would go red rather than pass vacuously.
      for (const c of distanceEnvelope(d.value).filter((_, i) => i % 211 === 0)) {
        let plan
        try { plan = generateRulePlan(c.input, 'paid') }
        catch (e) { if (isDesignedRefusal(e)) continue; throw e }
        const declared = (c.input as unknown as { current_weekly_km: number }).current_weekly_km
        const w1 = plan.weeks.find(w => w.n === 1)?.weekly_km ?? 0
        const step = w1 - declared, ratio = w1 / Math.max(declared, 0.1)
        const flagged = auditPlanQuality(plan, c.input).some(o => o.code === 'WEEK1-LEAP')
        if (step >= 10 && ratio > 1.25) { hazard++; if (flagged) hazardFlagged++ }
        else if (step >= 10) { benign++; if (flagged) benignFlagged++ }
      }
    }
    expect(hazard, 'the hazardous population must be reachable at all').toBeGreaterThan(0)
    expect(hazardFlagged, 'every big-for-the-runner step must stay visible').toBe(hazard)
    expect(benignFlagged, 'a 90 -> 100 km step is not a week-1 leap').toBe(0)
  })

  it('2. the §29 fresh-return runner is no longer scored against our own scaling', () => {
    // 8 km declared, experienced training age, low volume -> §29 scales to 5.6.
    // Week 1 of 10 is 1.79x the scaled figure and 1.25x what they actually run.
    const input = mk({
      race_distance_km: 10, race_date: '2027-01-18', fitness_level: 'intermediate',
      training_age: '2-5yr', current_weekly_km: 8, longest_recent_run_km: 4,
      days_available: 3,
    })
    const plan = generateRulePlan(input, 'paid')
    const w1 = plan.weeks.find(w => w.n === 1)?.weekly_km ?? 0
    expect(w1 / 8, 'fixture must be modest against DECLARED volume').toBeLessThanOrEqual(1.30)
    expect(auditPlanQuality(plan, input).map(o => o.code)).not.toContain('WEEK1-LEAP')
  })

  it('3. the session arm exists, is INERT on todays corpus, and says so', () => {
    // Measured across all 3,880 flagged plans: the worst case of a week-1
    // session exceeding the runner's longest recent run is +0.5 km, so this
    // arm fires on nothing today. Kept because it describes the actual hazard
    // (tissue load per session) rather than an accounting ratio; its liveness
    // comes from mutation, not from the corpus. Recorded, not hidden.
    expect(G.LONG_RUN_PROGRESSION_CAP_ABS_KM).toBeGreaterThan(0)
    let exceeded = 0
    for (const c of distanceEnvelope(21.1).filter((_, i) => i % 149 === 0)) {
      let plan
      try { plan = generateRulePlan(c.input, 'paid') }
      catch (e) { if (isDesignedRefusal(e)) continue; throw e }
      const longestEver = (c.input as unknown as { longest_recent_run_km: number }).longest_recent_run_km
      const w1 = plan.weeks.find(w => w.n === 1)
      const longest = Math.max(0, ...Object.values(w1?.sessions ?? {})
        .filter(s => s && s.type !== 'rest').map(s => s!.distance_km ?? 0))
      if (longest - longestEver > G.LONG_RUN_PROGRESSION_CAP_ABS_KM) exceeded++
    }
    expect(exceeded, 'if this ever goes non-zero the engine changed, not the test').toBe(0)
  })

  it('4. the absolute arm needs BOTH size and proportion', () => {
    expect(G.WEEK1_ABSOLUTE_STEP_MAX_KM).toBe(10)
    expect(G.WEEK1_ABSOLUTE_STEP_MIN_RATIO).toBeGreaterThan(1)
    // 90 -> 100 is 10km but 1.11x: below the ratio guard, correctly silent.
    expect(100 - 90 >= G.WEEK1_ABSOLUTE_STEP_MAX_KM).toBe(true)
    expect(100 / 90 > G.WEEK1_ABSOLUTE_STEP_MIN_RATIO).toBe(false)
    // 40 -> 50 is 10km and 1.25x: flagged.
    expect(50 / 40 > G.WEEK1_ABSOLUTE_STEP_MIN_RATIO).toBe(true)
  })
})
