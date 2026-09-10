import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { composePlanWithFoundation } from './foundationCompose'
import { plannedFoundationWeeks } from './foundationBlock'
import type { GeneratorInput } from '@/types/plan'

/**
 * `today` is an INPUT to plan generation, not an ambient fact
 * (INTENSITY-FOUNDATION-BLIND-02, 2026-09-10).
 *
 * `generateRulePlan` read `new Date()` internally. The property sweep pins
 * PLAN_START to a fixed date and `gapDays` clamps negatives to 0, so once that
 * date passed, generation saw gap 0 for EVERY swept plan: zero foundation weeks
 * planned, full base phase — while the sweep then composed real 3-week blocks
 * against its own synthetic `today`. Generation and composition were reasoning
 * about different calendars, which is the two-writer split §91's single-owner
 * note exists to prevent.
 *
 * Consequences, both measured: §91's on-ramp credit and the §1 foundation path
 * had ZERO sweep coverage across 16,038 plans, and the sweep's output drifted
 * with the wall clock despite a pinned seed — making "no NEW violations" a
 * comparison against a moving object. Injecting `today` put both halves on one
 * calendar and immediately surfaced a real delivered-plan §1 breach that had
 * never been visible (filed FOUNDATION-QUALITY-YIELD-01).
 *
 * Production passes nothing and keeps the wall clock.
 */

const TODAY = '2026-05-04'
const iso = (days: number) =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10)

const CHOICE_START = iso(40)   // > 28 days — the deferred-decision band

const benign = (planStart: string, decision?: 'add' | 'skip'): GeneratorInput => ({
  athlete_name: 'Athlete', age: 38, race_name: 'Test', primary_metric: 'distance',
  injury_history: [], plan_start: planStart,
  race_distance_km: 10, race_date: iso(40 + 14 * 7),
  current_weekly_km: 35, longest_recent_run_km: 14, days_available: 4,
  fitness_level: 'intermediate', training_age: '2-5yr',
  ...(decision ? { foundation_decision: decision } : {}),
} as unknown as GeneratorInput)

describe('`today` is injectable and actually drives generation', () => {
  it('the choice band really does defer its decision (guards the premise)', () => {
    // If this returns non-zero the divergence below cannot arise and the rest of
    // this file tests nothing — the failure mode that made the sweep vacuous.
    expect(plannedFoundationWeeks(TODAY, CHOICE_START, undefined)).toBe(0)
    expect(plannedFoundationWeeks(TODAY, CHOICE_START, 'add')).toBeGreaterThan(0)
  })

  it('the same inputs and the same `today` produce the same plan', () => {
    const input = benign(CHOICE_START, 'add')
    expect(generateRulePlan(input, 'trial', CHOICE_START, undefined, TODAY).meta.foundation_weeks_planned)
      .toBe(generateRulePlan(input, 'trial', CHOICE_START, undefined, TODAY).meta.foundation_weeks_planned)
  })

  it('moving `today` moves the foundation plan — the property the sweep lacked', () => {
    // Asserted as a RELATION, not literal week counts: generation anchors
    // plan_start forward to a week boundary, so pinning band edges here would be
    // asserting the anchoring rather than the injection.
    const input = benign(CHOICE_START, 'add')
    const near = generateRulePlan(input, 'trial', CHOICE_START, undefined, iso(40))
    const far = generateRulePlan(input, 'trial', CHOICE_START, undefined, TODAY)
    expect(far.meta.foundation_weeks_planned ?? 0)
      .toBeGreaterThan(near.meta.foundation_weeks_planned ?? 0)
  })

  it('omitting `today` falls back to the wall clock (production is unchanged)', () => {
    // The default must remain the ambient date, or every production caller
    // silently changes behaviour.
    const input = benign(CHOICE_START, 'add')
    expect(() => generateRulePlan(input, 'trial', CHOICE_START)).not.toThrow()
  })
})

describe('the choice band no longer changes the §1 verdict', () => {
  it('bare and delivered agree even when the block arrives after generation', () => {
    // CB-FOUNDATION-DENOM-01's payoff on the exact band that broke BLIND-01:
    // generation plans 0 weeks, the runner then adds 3, and §1 is unmoved.
    const input = benign(CHOICE_START)
    const bare = generateRulePlan(input, 'trial', CHOICE_START, undefined, TODAY)
    const dist = (vs: { code: string }[]) =>
      vs.filter(v => v.code === 'INV-PLAN-INTENSITY-DISTRIBUTION').length

    expect(bare.meta.foundation_weeks_planned ?? 0).toBe(0)

    const composed = composePlanWithFoundation(bare, input, TODAY, 'add')
    expect(composed.plan.weeks.some(w => w.n <= 0), 'block must actually be added').toBe(true)

    expect(dist(composed.violations)).toBe(dist(validatePlan(bare, input)))
  })
})
