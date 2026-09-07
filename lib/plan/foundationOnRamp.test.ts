import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { plannedFoundationWeeks } from './foundationBlock'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §91 — the on-ramp is counted in weeks the runner RUNS, not weeks in an array.
 *
 * Board: CB-ONSET-02, 2026-09-07 — CORRECT WITH AMENDMENT.
 *
 * The defect this closes: §89 shortened the base phase so quality starts ~2 weeks
 * sooner, and it did — inside `plan.weeks`. `composePlanWithFoundation` then
 * prepended up to 3 all-easy §57 foundation weeks that `computePhases` had never
 * seen, putting the delivered onset back where §89 found it. Measured on the
 * founder's live input, delivered onset was calendar week 4/5/6/6 at 12/13/14/15
 * weeks-to-race, against week 3 for an identical runner with no block at all —
 * non-monotonic, so entering a race EARLIER made the plan more conservative.
 */

// Frozen so the gap to plan start — the axis that creates foundation weeks — is
// a property of the test, not of the day it runs (SWEEP-VACUOUS-01's lesson).
const FROZEN_NOW = new Date('2026-09-07T09:00:00Z')
const TODAY = '2026-09-07'

const race = (wk: number) => {
  const d = new Date(2026, 8, 7)
  d.setDate(d.getDate() + wk * 7)
  return d.toISOString().slice(0, 10)
}

/** The founder's live 2026-09-07 trial input — known to fire the §89 gate. */
const ready10k = (o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_date: race(14), race_distance_km: 10, goal: 'time_target',
  target_time: '0:45:00', benchmark: { type: 'race', distance_km: 10, time: '0:49:00' },
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 44,
  resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
  training_age: '2-5yr', user_declared_level: 'experienced',
  recent_quality_training: 'regular', ...o,
} as GeneratorInput)

const baseWeeks = (p: Plan) => p.weeks.filter(w => w.n >= 1 && w.phase === 'base').length
const hasQuality = (w: Plan['weeks'][number]) =>
  Object.values(w.sessions).some(s => s?.type === 'quality')
/** 1-indexed calendar week the runner's first quality session lands in. */
const calendarOnset = (p: Plan) => {
  const i = p.weeks.findIndex(hasQuality)
  return i === -1 ? null : i + 1
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§91 — foundation weeks are credited against the on-ramp floor', () => {
  it('delivers quality by calendar week 4 at every gap, and never later than the no-block case', () => {
    // The regression this locks: the measured "before" was 4/5/6/6/3/3/3.
    // The shape matters as much as the values — a runner entering their race
    // EARLIER must never wait LONGER.
    const onsets: number[] = []
    for (const weeksToRace of [12, 13, 14, 15, 16, 18, 20]) {
      const input = ready10k({ race_date: race(weeksToRace) })
      const plan = generateRulePlan(input, 'paid')
      const composed = composePlanWithFoundation(plan, input, TODAY)
      expect(plan.meta.early_quality_onset, `gate should fire at ${weeksToRace}w`).toBe(true)
      const onset = calendarOnset(composed.plan)
      expect(onset, `no quality at all at ${weeksToRace}w`).not.toBeNull()
      onsets.push(onset!)
    }
    // §89's own stated "before" number is week 5. Nothing may reach it.
    // §97 tightened this further — most gaps now deliver week 2 — but the
    // ceiling asserted here stays at 4, because a runner with an unusually long
    // runway still receives a foundation block once the plan has extended to
    // `max_weeks` and surplus weeks remain. See §97's recorded regression.
    for (const o of onsets) expect(o).toBeLessThanOrEqual(4)
  })

  it('credits the block: base shrinks by exactly the foundation weeks, floored at zero', () => {
    // §97 CHANGED THIS CASE and the change is the point. At 14 weeks out a
    // gated runner used to get a 12-week plan behind 3 foundation weeks; now
    // the plan extends to `max_weeks` and absorbs them, so the block is 1 week
    // and the surplus is trained inside the periodisation arc.
    const input = ready10k({ race_date: race(14) })
    const plan = generateRulePlan(input, 'paid')
    expect(plan.meta.foundation_weeks_planned).toBe(1)
    expect(plan.weeks.length).toBeGreaterThan(12)

    // No block at all → the GATED floor binds (1, §97), not the general one (2).
    const far = ready10k({ race_date: race(20) })
    const farPlan = generateRulePlan(far, 'paid')
    expect(farPlan.meta.foundation_weeks_planned).toBe(0)
    expect(baseWeeks(farPlan)).toBe(GENERATION_CONFIG.MIN_ONRAMP_WEEKS_GATED)
  })

  it('leaves every NON-gated runner untouched — the floor still binds on base alone', () => {
    // Willy's condition: the credit rides on the §89 gate, which carries an
    // absolute injury veto. Each of these fails the gate for a different reason.
    const notReady: [string, Partial<GeneratorInput>][] = [
      ['injury history',      { injury_history: ['Left knee, recurring'] }],
      ['no recent quality',   { recent_quality_training: 'none' }],
      ['shallow training age', { training_age: '<6mo' }],
    ]
    for (const [why, patch] of notReady) {
      const plan = generateRulePlan(ready10k(patch), 'paid')
      expect(plan.meta.early_quality_onset, `gate must not fire: ${why}`).toBeFalsy()
      expect(baseWeeks(plan), `full base retained: ${why}`)
        .toBeGreaterThanOrEqual(GENERATION_CONFIG.MIN_BASE_WEEKS_FLOOR)
    }
  })

  it('FALSIFICATION — INV-PLAN-ONRAMP-FLOOR goes RED when the on-ramp is short', () => {
    // A check that has never been observed failing is not evidence of anything.
    // Break the plan the way the engine could break it (base credited against a
    // block that is not actually coming) and prove the invariant fires.
    const input = ready10k({ race_date: race(14) })
    const plan = generateRulePlan(input, 'paid')
    expect(validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-ONRAMP-FLOOR')).toHaveLength(0)

    const sabotaged: Plan = { ...plan, meta: { ...plan.meta, foundation_weeks_planned: 0 } }
    const fired = validatePlan(sabotaged, input).filter(v => v.code === 'INV-PLAN-ONRAMP-FLOOR')
    expect(fired, 'invariant must catch a 0-week on-ramp').toHaveLength(1)
    expect(fired[0].severity).toBe('error')
  })

  it('FALSIFICATION — the old equality test would have missed a ZERO-week base', () => {
    // The arm §91 replaced read `baseWeeks === 1` exactly. Prove the new one
    // covers the case that used to slip through, which is the more dangerous one.
    const input = ready10k({ race_date: race(20) })   // no block → floor binds
    const plan = generateRulePlan(input, 'paid')
    const zeroBase: Plan = {
      ...plan,
      weeks: plan.weeks.map(w => w.phase === 'base' ? { ...w, phase: 'build' as const } : w),
      meta: { ...plan.meta, foundation_weeks_planned: 0 },
    }
    const fired = validatePlan(zeroBase, input).filter(v => v.code === 'INV-PLAN-ONRAMP-FLOOR')
    expect(fired, 'a zero-week on-ramp must be caught, not only a one-week one').toHaveLength(1)
  })
})

describe('§92 — strides in the foundation block, gated runners only', () => {
  const foundationSessions = (p: Plan) =>
    p.weeks.filter(w => w.n <= 0).flatMap(w => Object.values(w.sessions).filter(Boolean))
  const hasStrides = (p: Plan) =>
    foundationSessions(p).some(s => (s!.coach_notes ?? []).some(n => /strides/i.test(n ?? '')))

  it('a §89-gated runner gets strides — one run per foundation week', () => {
    const input = ready10k()
    const composed = composePlanWithFoundation(generateRulePlan(input, 'paid'), input, TODAY)
    expect(hasStrides(composed.plan), 'gated runner should get strides').toBe(true)
    for (const w of composed.plan.weeks.filter(w => w.n <= 0)) {
      const withStrides = Object.values(w.sessions)
        .filter(s => (s?.coach_notes ?? []).some(n => /strides/i.test(n ?? '')))
      expect(withStrides.length, `W${w.n} should have exactly one stride run`).toBe(1)
      // Never on the long run — strides belong on a midweek easy day (§28).
      expect(withStrides[0]!.role).not.toBe('long_run')
    }
  })

  it('an injury history vetoes strides — Willy condition of approval', () => {
    const input = ready10k({ injury_history: ['Left knee, posterior, recurring'] })
    const plan = generateRulePlan(input, 'paid')
    expect(plan.meta.early_quality_onset).toBeFalsy()
    const composed = composePlanWithFoundation(plan, input, TODAY)
    expect(foundationSessions(composed.plan).length, 'fixture must have foundation weeks')
      .toBeGreaterThan(0)
    expect(hasStrides(composed.plan), 'injured runner must get no strides').toBe(false)
  })

  it('strides do not turn a foundation week into a quality week (§57 still holds)', () => {
    const input = ready10k()
    const composed = composePlanWithFoundation(generateRulePlan(input, 'paid'), input, TODAY)
    for (const w of composed.plan.weeks.filter(w => w.n <= 0)) {
      for (const s of Object.values(w.sessions)) {
        expect(['easy', 'rest', 'cross_train']).toContain(s!.type)
      }
    }
    expect(composed.violations.filter(v => v.code === 'INV-PLAN-FOUNDATION-BLOCK')).toHaveLength(0)
  })
})

describe('FOUND-ROUND-01 — a foundation session states the distance it ships', () => {
  it('detail text and distance_km agree to the decimal', () => {
    // `detail` was built with toFixed(1) (rounds half-up) while `distance_km`
    // used floor1dp, so a 6.66 km run shipped `6.6` under the text "6.7km" — on
    // the first screen a new runner ever sees. Same class as §40b/§78.
    const input = ready10k()
    const composed = composePlanWithFoundation(generateRulePlan(input, 'paid'), input, TODAY)
    const foundation = composed.plan.weeks.filter(w => w.n <= 0)
    expect(foundation.length).toBeGreaterThan(0)
    for (const w of foundation) {
      for (const s of Object.values(w.sessions)) {
        const stated = (s!.detail ?? '').match(/([\d.]+)km/)
        expect(stated, `W${w.n} detail should state a distance`).not.toBeNull()
        expect(Number(stated![1]), `W${w.n} "${s!.detail}" vs distance_km ${s!.distance_km}`)
          .toBe(s!.distance_km)
      }
    }
  })
})

describe('§91 — plannedFoundationWeeks is the single owner', () => {
  it('agrees with the number of weeks composePlanWithFoundation actually builds', () => {
    // DELOAD-OWNER-01's lesson, applied before it can bite: two callers deriving
    // this number independently disagreed by a week whenever the plan was
    // generated ON a Monday, because one reasoned from nextMonday() and the
    // other from the real `today`.
    for (const weeksToRace of [12, 13, 14, 15, 16, 20]) {
      const input = ready10k({ race_date: race(weeksToRace) })
      const plan = generateRulePlan(input, 'paid')
      const composed = composePlanWithFoundation(plan, input, TODAY)
      const built = composed.plan.weeks.filter(w => w.phase === 'foundation').length
      const planned = plannedFoundationWeeks(TODAY, plan.meta.plan_start, input.foundation_decision)

      expect(built, `built vs planned at ${weeksToRace}w`).toBe(planned)
      expect(plan.meta.foundation_weeks_planned, `stamped vs built at ${weeksToRace}w`).toBe(built)
    }
  })

  it('returns zero when no block is coming', () => {
    // Gap < 7 days is a nudge, not a block (§57). Gap > 28 days is the runner's
    // choice, and an undecided choice builds nothing.
    expect(plannedFoundationWeeks('2026-09-07', '2026-09-10')).toBe(0)          // 3-day gap
    expect(plannedFoundationWeeks('2026-09-07', '2026-11-30')).toBe(0)          // > 28d, undecided
    expect(plannedFoundationWeeks('2026-09-07', '2026-11-30', 'start_now')).toBe(0)
    expect(plannedFoundationWeeks('2026-09-07', '2026-11-30', 'add')).toBe(
      GENERATION_CONFIG.FOUNDATION_MAX_WEEKS)                                    // > 28d, opted in
  })
})
