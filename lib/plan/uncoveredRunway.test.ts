import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { composePlanWithFoundation } from './foundationCompose'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

/**
 * CoachingPrinciples §57 Amendment / §76 Amendment (FOUNDATION-LONG-RUNWAY-01,
 * Coaching Board 2026-09-15).
 *
 * §76 says a runner handed an uncoached void "will fill it by guessing", and
 * asserted the pre-plan gap was "already owned by the foundation block".
 * `FOUNDATION_MAX_WEEKS` is 3, so for a charity runner with a months-long runway
 * it is not: 25 weeks out, a first-time marathoner gets 3 foundation + 18 main
 * and FOUR uncovered weeks, and was told nothing about them.
 */

const TODAY = '2026-09-21'

/** M1's shape — the charity cohort's first-time marathoner. */
const m1 = (raceDate: string): GeneratorInput => ({
  athlete_name: 'A', race_name: 'C', primary_metric: 'distance',
  race_distance_km: 42.2, goal: 'finish', current_weekly_km: 15,
  longest_recent_run_km: 8, days_available: 4, age: 38, training_age: '<6mo',
  recent_quality_training: 'none', fitness_level: 'beginner',
  hard_session_relationship: 'neutral', injury_history: [],
  resting_hr: 55, max_hr: 184, race_date: raceDate, plan_start: TODAY,
  foundation_decision: 'add',
} as unknown as GeneratorInput)

/** `weeks` from TODAY, landing on a Sunday — the convention charityCohort uses. */
const raceIn = (weeks: number): string =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + (weeks * 7 - 1) * 86_400_000)
    .toISOString().slice(0, 10)

const compose = (raceDate: string) => {
  const input = m1(raceDate)
  const plan = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
  return { input, ...composePlanWithFoundation(plan, input, TODAY, 'add') }
}

describe('§57 Am. / §76 Am. — the weeks the plan does not cover are declared', () => {
  it('the filed case reproduces: a 25-week runway leaves FOUR weeks uncovered', () => {
    const { plan } = compose(raceIn(25))
    expect(plan.weeks.filter(w => w.n < 1)).toHaveLength(3)   // FOUNDATION_MAX_WEEKS
    expect(plan.meta.uncovered_runway_weeks).toBe(4)
  })

  it('a long runway is DECLARED, not silent', () => {
    const { plan } = compose(raceIn(25))
    const note = plan.meta.uncovered_runway_note
    expect(note).toBeTruthy()
    expect(note).toContain('4 weeks')
  })

  it('the note does NOT sell the gap as preparation (CB-1, Sims)', () => {
    // CB-1: a foundation block is "habit and routine, not adaptation", and it
    // "must never be described as if it were". Unsupervised weeks even more so.
    const note = compose(raceIn(25)).plan.meta.uncovered_runway_note!
    // Bans the AFFIRMATIVE sale, not the word. An earlier version of this
    // assertion banned "training" outright and failed on the note's own DENIAL
    // ("we are not going to pretend they are training") — the check was wrong,
    // not the copy.
    expect(note.toLowerCase()).not.toMatch(
      /\b(fitter|head start|get ahead|build(ing)? (a |your )?base|prepares? you|sets? you up)\b/)
    // It must actively say the opposite, and say not to ramp.
    expect(note.toLowerCase()).toContain('not going to pretend')
    expect(note.toLowerCase()).toContain('do not use the time to ramp up')
  })

  it('no em dash — brand.md § Punctuation', () => {
    expect(compose(raceIn(25)).plan.meta.uncovered_runway_note).not.toContain('—')
  })

  it('states the mechanism CORRECTLY: surplus sits before the plan', () => {
    // A first draft said starting earlier "would just stretch the taper". It
    // would not — §76 lays the plan out backwards and §17 bounds its length, so
    // surplus weeks land BEFORE it. Naming the wrong reason in runner-facing
    // copy is the same defect as naming it in a comment.
    const note = compose(raceIn(25)).plan.meta.uncovered_runway_note!.toLowerCase()
    expect(note).toContain('backwards from race day')
    expect(note).not.toContain('taper')
  })

  it('no raw ISO date leaks into runner-facing copy (ADR-015)', () => {
    expect(compose(raceIn(25)).plan.meta.uncovered_runway_note).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('is SILENT when the foundation block covers the whole gap', () => {
    // 20 weeks out: gap 14d, foundation takes both. Nothing to declare, and a
    // note here would be noise (NOISE-GATE-01).
    const { plan, violations } = compose(raceIn(20))
    expect(plan.meta.uncovered_runway_weeks ?? 0).toBe(0)
    expect(plan.meta.uncovered_runway_note).toBeUndefined()
    expect(violations.filter(v => v.code === 'INV-PLAN-UNCOVERED-RUNWAY-DECLARED')).toHaveLength(0)
  })

  it('is SILENT one week below the threshold, and speaks at it', () => {
    // The boundary is the whole point of the constant: 1 uncovered week is a
    // rest-and-admin week, 2+ is a void.
    const below = compose(raceIn(22)).plan            // gap 28d - 3 foundation = 1
    expect(below.meta.uncovered_runway_weeks).toBe(GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD - 1)
    expect(below.meta.uncovered_runway_note).toBeUndefined()

    const at = compose(raceIn(23)).plan               // gap 35d - 3 foundation = 2
    expect(at.meta.uncovered_runway_weeks).toBe(GENERATION_CONFIG.FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD)
    expect(at.meta.uncovered_runway_note).toBeTruthy()
  })

  it('the void SCALES with the runway — this is not an edge case', () => {
    // A charity runner typically gets their place months out.
    expect(compose(raceIn(30)).plan.meta.uncovered_runway_weeks).toBe(9)
    expect(compose(raceIn(40)).plan.meta.uncovered_runway_weeks).toBe(19)
  })

  it('INV-PLAN-UNCOVERED-RUNWAY-DECLARED can go RED', () => {
    // Prove the check is not vacuous: strip the telling, keep the decision.
    const { input, plan } = compose(raceIn(25))
    const broken = { ...plan, meta: { ...plan.meta, uncovered_runway_note: undefined } }
    const fired = validatePlan(broken, input)
      .filter(v => v.code === 'INV-PLAN-UNCOVERED-RUNWAY-DECLARED')
    expect(fired).toHaveLength(1)
    expect(fired[0].severity).toBe('error')
  })

  it('is silent on a plan that never went through composition', () => {
    // generateRulePlan's own validation tail, and every script, sees no stamp.
    // Firing there would report the harness, not the plan.
    const input = m1(raceIn(25))
    const raw = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
    expect(raw.meta.uncovered_runway_weeks).toBeUndefined()
    expect(validatePlan(raw, input)
      .filter(v => v.code === 'INV-PLAN-UNCOVERED-RUNWAY-DECLARED')).toHaveLength(0)
  })
})
