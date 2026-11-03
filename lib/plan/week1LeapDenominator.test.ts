import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { auditPlanQuality, week1Leap } from './planQuality'
import { isDesignedRefusal } from './designedRefusal'
import { GENERATION_CONFIG as G } from './generationConfig'
import { distanceEnvelope, DISTANCE_BANDS } from './useCaseEnvelope'
import type { GeneratorInput, Week } from '@/types/plan'
// TEST-CLOCK-PINSWEEP-01 — pinned, or nextMonday() walks this fixture into §44.
import { PINNED_PLAN_START_0921 } from './__fixtures__/pinnedPlanStart'

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
  // 🔴 RESTRUCTURED 2026-11-03 (`ENVELOPE-UNSET-LEVEL-01`), AND THE REASON IS THE FINDING.
  //
  // This arm used to sweep `distanceEnvelope` for the hazardous population and assert
  // `hazard > 0` so that "a stride that sampled the claim away would go red rather than
  // pass vacuously". It went red — working exactly as designed — the moment the corpus
  // stopped setting `fitness_level`, a field no production path sets.
  //
  // 🔑 MEASURED, production shape, 4,379 plans across all six distances, no narrowing:
  // the hazardous population (step >= 10 km AND ratio > 1.25) is **0, everywhere**. The
  // largest week-1 step the engine produces is **6 km** (marathon and 50K), and the only
  // >= 10 km step is the BENIGN 90 -> 100 km case at 100K. The hazard existed in the old
  // corpus because forcing `fitness_level` upward gave a 10 km/week runner an
  // experienced PEAK, hence a big week 1 — and a declaration cannot raise structure in
  // production (§79, downward only). **So Willy's condition was ratified against a
  // hazard the product cannot build.** The condition is sound; its evidence was not.
  // Filed as `WEEK1-HAZARD-UNREACHABLE-01`.
  //
  // ⚠️ SO THE PREDICATE IS TESTED DIRECTLY AND THE POPULATION IS RECORDED, which is this
  // repo's own liveness pattern: a rule nothing wakes is UNPROVEN, not proven dead, and
  // lands in a register with a reason. `week1Leap` is already the single owner
  // (extracted for NO-RUNNER-TURNED-AWAY-01 C3), so the condition can be exercised on
  // constructed weeks instead of hoping a corpus emits the case. **Do not restore an
  // envelope sweep here without re-measuring the 0 above.**
  it("1. WILLY'S BINDING CONDITION — a big step FOR THE RUNNER still flags (on the predicate)", () => {
    // ⚠️ THIS CONDITION WAS MIS-ENCODED FIRST TIME AND THE MISTAKE MATTERED.
    // Willy said "the 15 km weekly jumps must stay visible". Encoded literally
    // as ">= 10 km absolute", it also swept up a runner declaring 90 km/week
    // handed 100 — a 1.11x step, ten kilometres across six runs — and dropped
    // 100K fit-for-purpose 95.8% -> 88.5% on that alone. He named a step that
    // is big FOR THE RUNNER, not a big number. Both halves are asserted.
    //
    // The numbers are substituted from config, not written out, so moving either
    // constant comes through this test.
    expect(G.WEEK1_ABSOLUTE_STEP_MAX_KM).toBe(10)
    expect(G.WEEK1_ABSOLUTE_STEP_MIN_RATIO).toBe(1.15)

    /** Week 1 with `runs` equal sessions summing to `km`, and no other week. */
    const weeksOf = (km: number, runs: number): Week[] => ([{
      n: 1, type: 'load', phase: 'base', weekly_km: km,
      sessions: Object.fromEntries(Array.from({ length: runs }, (_, i) =>
        [['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][i], { type: 'easy', distance_km: km / runs }])),
    }] as unknown as Week[])

    // HAZARDOUS: 20 km declared, handed 35 — a 15 km step at 1.75x. Willy's case.
    const hazardIn = mk({ race_distance_km: 42.2, race_date: '2027-04-18', current_weekly_km: 20,
      longest_recent_run_km: 10, days_available: 5, training_age: '2-5yr' })
    expect(week1Leap(weeksOf(35, 5), hazardIn, 35)).toContain('adds 15.0km')

    // BENIGN: 90 km declared, handed 100 — the same 10 km across six runs, 1.11x.
    const benignIn = mk({ race_distance_km: 100, race_date: '2027-06-20', current_weekly_km: 90,
      longest_recent_run_km: 35, days_available: 6, training_age: '5yr+' })
    expect(week1Leap(weeksOf(100, 6), benignIn, 100)).toBeNull()

    // THE BOUNDARY, both sides: at a 20 km base, 1.15x is 23 and the floor is 10,
    // so the absolute arm needs 30 and the ratio arm is what catches 23.
    expect(week1Leap(weeksOf(30, 5), hazardIn, 30)).toContain('adds 10.0km')
    expect(week1Leap(weeksOf(29, 5), hazardIn, 29)).not.toContain('adds')
  })

  it("1b. the BENIGN half holds on the real population — a 90 -> 100 km step is not a leap", () => {
    // The half the envelope CAN still prove: measured, 2 benign >= 10 km steps at 100K
    // in the production shape and neither is flagged. The hazardous half is 0 and is
    // asserted on the predicate above instead.
    let benign = 0, benignFlagged = 0
    for (const c of distanceEnvelope(100).filter((_, i) => i % 211 === 0)) {
      let plan
      try { plan = generateRulePlan(c.input, 'paid', PINNED_PLAN_START_0921) }
      catch (e) { if (isDesignedRefusal(e)) continue; throw e }
      const declared = (c.input as unknown as { current_weekly_km: number }).current_weekly_km
      const w1 = plan.weeks.find(w => w.n === 1)?.weekly_km ?? 0
      const step = w1 - declared, ratio = w1 / Math.max(declared, 0.1)
      if (step >= 10 && ratio <= 1.25) {
        benign++
        if (auditPlanQuality(plan, c.input).some(o => o.code === 'WEEK1-LEAP')) benignFlagged++
      }
    }
    expect(benign, 'the benign population must stay reachable').toBeGreaterThan(0)
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
    const plan = generateRulePlan(input, 'paid', PINNED_PLAN_START_0921)
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
      try { plan = generateRulePlan(c.input, 'paid', PINNED_PLAN_START_0921) }
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
