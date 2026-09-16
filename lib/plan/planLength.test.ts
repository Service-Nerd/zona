import { describe, it, expect } from 'vitest'
import { calcPlanLength, planWeekCap, getDistanceConfig } from './length'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import { PLAN_SIGNATURES } from './planSignatures'
import { raceDistanceKey } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

/**
 * CoachingPrinciples §97 Amendment (LONG-RUNWAY-EARNS-PLAN-01, Coaching Board
 * 2026-09-16) — the plan-length headroom §17 declares is granted on SURPLUS, not
 * on §89's readiness gate.
 *
 * WHY THIS FILE EXISTS AT ALL. `length.ts` owns every plan-date arithmetic in the
 * engine and had NO test file before this change — `calcPlanLength` was covered
 * only incidentally, through whole-plan assertions that would not say which of
 * its three outputs had moved. `verify:parity` cannot cover it either: the parity
 * grid pins `plan_start`, so it contains no surplus-runway cases at all and came
 * back byte-identical on a change that moves 24% of plans (the same blindness
 * FOUNDATION-LONG-RUNWAY-01 recorded on 2026-09-15).
 */

const TODAY = '2026-09-21'   // a Monday. PINNED, never the wall clock (SWEEP-VACUOUS-01).

/** Race `weeks` out, landing on the Sunday that ends that week. */
const raceIn = (weeks: number): string =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + (weeks * 7 - 1) * 86_400_000)
    .toISOString().slice(0, 10)

/** M1's shape — the charity cohort's first-time marathoner, and the persona the
 *  board ruled on. Ungated by construction: `<6mo` + no recent quality. */
const m1 = (raceDate: string, over: Record<string, unknown> = {}): GeneratorInput => ({
  athlete_name: 'A', race_name: 'C', primary_metric: 'distance',
  race_distance_km: 42.2, goal: 'finish', current_weekly_km: 15,
  longest_recent_run_km: 8, days_available: 4, age: 38, training_age: '<6mo',
  recent_quality_training: 'none', fitness_level: 'beginner',
  hard_session_relationship: 'neutral', injury_history: [],
  resting_hr: 55, max_hr: 184, race_date: raceDate, plan_start: TODAY,
  foundation_decision: 'add', ...over,
} as unknown as GeneratorInput)

const mainWeeks = (p: { weeks: Array<{ n: number }> }) => p.weeks.filter(w => w.n >= 1).length

describe('planWeekCap — the single owner of the length bound (D-08)', () => {
  it('never exceeds the signature\'s own declared max_weeks (§17)', () => {
    for (const km of [5, 10, 21.1, 42.2, 50, 100]) {
      const sig = PLAN_SIGNATURES[raceDistanceKey(km)].max_weeks
      expect(planWeekCap(km)).toBeLessThanOrEqual(sig)
    }
  })

  it('never falls below idealWeeks — the cap can only add, never truncate', () => {
    for (const km of [5, 10, 21.1, 42.2, 50, 100]) {
      expect(planWeekCap(km)).toBeGreaterThanOrEqual(getDistanceConfig(km).idealWeeks)
    }
  })

  it('respects MAX_PLAN_EXTENSION_WEEKS', () => {
    for (const km of [5, 10, 21.1, 42.2, 50, 100]) {
      const ideal = getDistanceConfig(km).idealWeeks
      expect(planWeekCap(km) - ideal).toBeLessThanOrEqual(GENERATION_CONFIG.MAX_PLAN_EXTENSION_WEEKS)
    }
  })

  /**
   * FALSIFICATION GUARD, and the reason it is written as an assertion rather than
   * a comment. §97's own config note claimed the headroom was "4 for
   * MARATHON/50K/100K" — arithmetic against `PLAN_SIGNATURES.ideal_weeks`, a field
   * `calcPlanLength` has never read. If someone raises a `max_weeks` by more than
   * MAX_PLAN_EXTENSION_WEEKS, this test tells them the bound has started binding
   * and that the "does not bind today" note in generationConfig.ts is now stale.
   */
  it('DOCUMENTS that the extension bound does not currently bind at any distance', () => {
    const binding = [5, 10, 21.1, 42.2, 50, 100].filter(km => {
      const ideal = getDistanceConfig(km).idealWeeks
      const sig = PLAN_SIGNATURES[raceDistanceKey(km)].max_weeks
      return sig - ideal > GENERATION_CONFIG.MAX_PLAN_EXTENSION_WEEKS
    })
    expect(binding).toEqual([])
  })
})

describe('§97 Am. — the headroom is granted on SURPLUS, not on §89', () => {
  it('an UNGATED runner reaches the cap when the calendar has surplus', () => {
    const plan = generateRulePlan(m1(raceIn(25)), 'paid', TODAY, undefined, TODAY)
    expect(plan.meta.early_quality_onset).not.toBe(true)   // genuinely ungated
    expect(mainWeeks(plan)).toBe(planWeekCap(42.2))        // 20, was 18
  })

  /**
   * THE BOARD'S SCOPING CONDITION, asserted rather than trusted: "scoped to
   * runners who would otherwise idle. If it reaches runners who would not, it does
   * not ship." `min(weeksAvailable, weekCap)` makes that structural, and this is
   * the test that would catch it stopping being structural.
   */
  it('changes NOTHING for a runner with no surplus — the calendar still binds', () => {
    for (const runway of [14, 16, 18]) {
      const r = calcPlanLength(42.2, raceIn(runway), TODAY)
      expect(r.totalWeeks).toBe(runway)
      expect(r.weeksAvailable).toBe(runway)
    }
  })

  it('never invents weeks the calendar does not contain', () => {
    for (const runway of [3, 8, 12, 19, 21, 30, 52]) {
      const r = calcPlanLength(42.2, raceIn(runway), TODAY)
      expect(r.totalWeeks).toBeLessThanOrEqual(r.weeksAvailable)
      expect(r.totalWeeks).toBeLessThanOrEqual(planWeekCap(42.2))
    }
  })

  /** Willy's binding condition of approval: the extra weeks are NOT bought by
   *  shortening base. §97's own version shortens base for a gated runner; this
   *  amendment changes no phase percentage. */
  it('does not shorten base to pay for the extension (Willy, binding)', () => {
    const short = generateRulePlan(m1(raceIn(18)), 'paid', TODAY, undefined, TODAY)
    const long  = generateRulePlan(m1(raceIn(25)), 'paid', TODAY, undefined, TODAY)
    const baseOf = (p: typeof short) => p.weeks.filter(w => w.n >= 1 && w.phase === 'base').length
    expect(baseOf(long)).toBeGreaterThanOrEqual(baseOf(short))
  })

  /** §76 still holds: the race is still in the final week, whatever the cap did. */
  it('keeps race week last (§76)', () => {
    for (const runway of [19, 20, 25, 40]) {
      const r = calcPlanLength(42.2, raceIn(runway), TODAY)
      expect(r.raceWeekStartIso >= r.planStartIso).toBe(true)
    }
  })
})

describe('§57 Am. — the uncovered-runway note still binds after the extension', () => {
  it('shrinks the uncovered gap by the extension but does not close it', () => {
    const input = m1(raceIn(25))
    const { plan } = composePlanWithFoundation(
      generateRulePlan(input, 'paid', TODAY, undefined, TODAY), input, TODAY, 'add')
    expect(plan.meta.uncovered_runway_weeks).toBe(2)       // was 4
    expect(plan.meta.uncovered_runway_note).toBeTruthy()   // still at threshold
  })

  it('a 40-week runway is still mostly uncovered — length cannot fix it', () => {
    const input = m1(raceIn(40))
    const { plan } = composePlanWithFoundation(
      generateRulePlan(input, 'paid', TODAY, undefined, TODAY), input, TODAY, 'add')
    expect(plan.meta.uncovered_runway_weeks).toBeGreaterThan(10)
    expect(plan.meta.uncovered_runway_note).toBeTruthy()
  })
})

describe('the extended plans are valid plans', () => {
  it('no error violations across the surplus band, both deload cadences', () => {
    for (const age of [38, 58]) {
      for (const runway of [19, 21, 25, 30, 40]) {
        const input = m1(raceIn(runway), { age })
        const { plan, violations } = composePlanWithFoundation(
          generateRulePlan(input, 'paid', TODAY, undefined, TODAY), input, TODAY, 'add')
        const errors = violations.filter(v => v.severity === 'error')
        expect(errors, `age ${age} runway ${runway}: ${errors.map(e => e.code).join()}`).toHaveLength(0)
        // Sims's condition: §3's cadence must not degrade at the longer lengths.
        const deloads = plan.weeks.filter(w => w.n >= 1 && w.badge === 'deload').map(w => w.n)
        const adjacent = deloads.some((n, i) => i > 0 && n - deloads[i - 1] === 1)
        expect(adjacent, `adjacent deloads at age ${age} runway ${runway}`).toBe(false)
      }
    }
  })

  it('INV-PLAN-SURPLUS-IN-PLAN does not fire on a plan that used its headroom', () => {
    const input = m1(raceIn(25))
    const plan = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
    const fired = validatePlan(plan, input).filter(v => v.code === 'INV-PLAN-SURPLUS-IN-PLAN')
    expect(fired).toHaveLength(0)
  })
})
