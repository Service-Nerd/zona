// INTENSITY-FOUNDATION-BLIND-02 — §1 must be measured on the plan the runner
// receives, on the 'choice' band too.
//
// INTENSITY-FOUNDATION-BLIND-01 established the rule and added a defer keyed on
// `foundation_weeks_planned > 0`. That key only holds on the 7-28 day 'auto'
// band, where the block is decided at generation. On the >28 day 'choice' band
// the decision arrives later (POST /api/generate-plan/foundation) — the reason
// the band exists — so `plannedFoundationWeeks` returns 0, the defer never
// fired, and a plan that ships clean logged an error in prod and THREW here.
//
// The second half of these tests is the more important one: the widened defer
// must END at composition. A runner who picks 'skip' gets an assembled plan
// identical to the bare one, and if that state could not be told apart from
// "still undecided", the fix would have turned log noise into an unchecked plan.

import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { composePlanWithFoundation } from './foundationCompose'
import { plannedFoundationWeeks } from './foundationBlock'
import type { GeneratorInput, Plan } from '@/types/plan'

const TODAY = '2026-05-04'
const iso = (days: number) =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)

// 40-day gap => 'choice' band. 24 days => 'auto'. 3 days => 'none'.
const CHOICE_START = iso(40)
const AUTO_START = iso(24)
const NONE_START = iso(3)

/** A marathon shape that sits just above the 18% §1 ceiling on the bare plan
 *  and just under it once foundation weeks widen the denominator. Taken from
 *  the case the property sweep surfaced (13/69 running sessions = 18.8%). */
function marathon(planStart: string, decision?: 'add' | 'skip' | 'start_now'): GeneratorInput {
  // The race date is derived from THIS band's plan_start, not from a fixed
  // date, so every band generates the same-shaped 17-week plan and the gap is
  // the only variable. Pinning one literal race_date instead made the 'none'
  // band a longer plan with a lower quality share — confounding plan length
  // with the thing under test, and quietly turning a "the check still binds"
  // assertion into a plan that had nothing to fire on.
  const raceDate = new Date(new Date(`${planStart}T00:00:00Z`).getTime() + 17 * 7 * 86_400_000)
    .toISOString().slice(0, 10)
  return {
    athlete_name: 'Athlete', age: 35, race_name: 'Test', primary_metric: 'distance',
    injury_history: [], plan_start: planStart,
    race_distance_km: 42.2, race_date: raceDate, target_time: '3:45:00',
    current_weekly_km: 60, longest_recent_run_km: 30, days_available: 4,
    days_cannot_train: ['tue', 'thu'], fitness_level: 'intermediate',
    training_age: '5yr+', user_declared_level: 'experienced',
    hard_session_relationship: 'love', recent_quality_training: 'regular',
    max_weekday_mins: 30, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
    ...(decision ? { foundation_decision: decision } : {}),
  } as unknown as GeneratorInput
}

const dist = (plan: Plan, input: GeneratorInput) =>
  validatePlan(plan, input).filter(
    v => v.severity === 'error' && v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')

const gen = (input: GeneratorInput, planStart: string) =>
  generateRulePlan(input, 'trial', planStart, undefined, TODAY)

describe('INTENSITY-FOUNDATION-BLIND-02 — the choice band', () => {
  it('the band really does defer its decision (guards the premise)', () => {
    // If this ever returns non-zero the defect below cannot occur and the rest
    // of this file is testing nothing — the failure mode that made the sweep
    // vacuous for months.
    expect(plannedFoundationWeeks(TODAY, CHOICE_START, undefined)).toBe(0)
    expect(plannedFoundationWeeks(TODAY, CHOICE_START, 'add')).toBeGreaterThan(0)
  })

  it('does not fire on the bare plan while the foundation decision is outstanding', () => {
    const input = marathon(CHOICE_START)
    const plan = gen(input, CHOICE_START)

    expect(plan.meta.foundation_weeks_planned ?? 0).toBe(0)
    expect(plan.meta.foundation_decision_pending).toBe(true)
    expect(dist(plan, input)).toHaveLength(0)
  })

  it('generating on the choice band does not throw (it threw before this fix)', () => {
    // generateRulePlan runs enforceViolations on its own tail, which THROWS in
    // NODE_ENV=test. This is the user-visible half of the defect.
    expect(() => gen(marathon(CHOICE_START), CHOICE_START)).not.toThrow()
  })

  it('binds once the runner ADDS the block, measured on the delivered plan', () => {
    const input = marathon(CHOICE_START)
    const composed = composePlanWithFoundation(gen(input, CHOICE_START), input, TODAY, 'add')

    expect(composed.plan.weeks.some(w => w.n <= 0)).toBe(true)
    expect(composed.plan.meta.foundation_composed).toBe(true)
    // The verdict is now the delivered one — whatever it is, it was reached with
    // the foundation weeks in the denominator, which is what §1 asks for.
    expect(composed.violations.filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION')
      .every(v => v.week === 0)).toBe(true)
  })

  it('BINDS AGAIN when the runner SKIPS the block — the defer must not be terminal', () => {
    const input = marathon(CHOICE_START)
    const bare = gen(input, CHOICE_START)
    const composed = composePlanWithFoundation(bare, input, TODAY, 'skip')

    // No week was added, so the assembled plan is the bare plan...
    expect(composed.plan.weeks.some(w => w.n <= 0)).toBe(false)
    // ...but the question is settled, so the check is live again rather than
    // deferring forever. This is the masking hole the marker exists to close.
    expect(composed.plan.meta.foundation_composed).toBe(true)
    expect(dist(composed.plan, input).length)
      .toBe(dist({ ...bare, meta: { ...bare.meta, foundation_composed: true,
                                    foundation_decision_pending: false } } as Plan, input).length)
  })
})

describe('INTENSITY-FOUNDATION-BLIND-02 — the bands that must not change', () => {
  it('auto band still defers on the bare plan (BLIND-01 behaviour retained)', () => {
    const input = marathon(AUTO_START)
    const plan = gen(input, AUTO_START)
    expect(plan.meta.foundation_weeks_planned ?? 0).toBeGreaterThan(0)
    expect(plan.meta.foundation_decision_pending).toBeUndefined()
    expect(dist(plan, input)).toHaveLength(0)
  })

  it('none band binds in full — no block is coming, so bare IS delivered', () => {
    // Where INTENSITY-LONGDIST-LOWDAY-01's real breach has to keep firing.
    //
    // This fixture is deliberately a plan that DOES breach §1 without foundation
    // weeks (18.1%, 13/72), so "the check is live" is proved by generation
    // throwing — enforceViolations throws on error severity under NODE_ENV=test
    // — rather than by reading a silent zero as a pass. Same assertion, no
    // hand-mutated plan needed.
    expect(() => gen(marathon(NONE_START), NONE_START))
      .toThrow(/INV-PLAN-INTENSITY-DISTRIBUTION/)
  })

  it('an explicit skip AT generation binds immediately — nothing is pending', () => {
    // 'skip' supplied up front means no block is ever coming, so there is
    // nothing to defer to and the bare plan must be judged on the spot.
    expect(() => gen(marathon(CHOICE_START, 'skip'), CHOICE_START))
      .toThrow(/INV-PLAN-INTENSITY-DISTRIBUTION/)
  })
})

describe('INTENSITY-FOUNDATION-BLIND-02 — generation is deterministic in `today`', () => {
  // A plan comfortably inside its ceiling, so these assertions are about the
  // foundation arithmetic and cannot be perturbed by a §1 throw.
  const benign = (planStart: string): GeneratorInput => ({
    athlete_name: 'Athlete', age: 38, race_name: 'Test', primary_metric: 'distance',
    injury_history: [], plan_start: planStart,
    race_distance_km: 10, race_date: iso(40 + 14 * 7),
    current_weekly_km: 35, longest_recent_run_km: 14, days_available: 4,
    fitness_level: 'intermediate', training_age: '2-5yr',
    foundation_decision: 'add',
  } as unknown as GeneratorInput)

  it('the same inputs and the same `today` produce the same foundation plan', () => {
    const input = benign(CHOICE_START)
    expect(gen(input, CHOICE_START).meta.foundation_weeks_planned)
      .toBe(gen(input, CHOICE_START).meta.foundation_weeks_planned)
  })

  it('`today` actually drives the gap band rather than being decorative', () => {
    // The property the sweep needed and did not have. Before `today` was
    // injectable this could not be asserted at all: generation read the wall
    // clock, so a pinned plan_start silently produced gap 0 forever.
    //
    // Asserted as a RELATION rather than exact week counts: generation anchors
    // plan_start forward to a week boundary, so the effective gap is the
    // anchored start minus `today` and pinning literal band edges here would be
    // asserting the anchoring, not the injection.
    const input = benign(CHOICE_START)
    const near = generateRulePlan(input, 'trial', CHOICE_START, undefined, iso(40))
    const far = generateRulePlan(input, 'trial', CHOICE_START, undefined, TODAY)
    expect(far.meta.foundation_weeks_planned ?? 0)
      .toBeGreaterThan(near.meta.foundation_weeks_planned ?? 0)
  })
})
