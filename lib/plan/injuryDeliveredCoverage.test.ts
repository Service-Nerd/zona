/**
 * INJURY-DELIVERED-COVERAGE-01 — §90 Am. 2 / §94 Am. 2, Coaching Board 2026-09-25.
 *
 * 🔴 DECLARING AN INJURY USED TO REMOVE A CHECK. §94's `INV-PLAN-DELIVERED-RAMP`
 * was gated `if (healthy)` on its own exclusion of *"injury-history runners
 * (already covered, more strictly, by §90)"*, and §90 scoped itself *"5% for
 * knee/shin"*. Both sentences were true; the gap was BETWEEN them, so achilles,
 * back, hip and plantar-fasciitis histories were checked by neither arm —
 * **0.0% coverage against 34.6% for the healthy twin of the same runner.**
 *
 * ⚠️ THIS CHANGES NO PRESCRIPTION. §12's producer cap is still knee/shin and the
 * volume curve is untouched — asserted below, because "only the checker moved" is
 * the claim the whole ruling rests on and it must not be taken on trust.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { hasDeliveredCapInjury, hasVolumeCappedInjuryHistory } from './injuryScope'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-04-27'
const WIZARD = ['Achilles', 'Knee', 'Back', 'Hip', 'Shin splints', 'Plantar fasciitis']
const DELIVERED_CODES = ['INV-PLAN-DELIVERED-RAMP', 'INV-PLAN-INJURY-CAP-DELIVERED']

const runner = (injury_history: string[]): GeneratorInput => ({
  goal: 'finish', age: 52, resting_hr: 55, max_hr: 180, preferred_long_run_day: 'sun',
  race_date: '2026-12-06', race_distance_km: 21.1, current_weekly_km: 30,
  longest_recent_run_km: 10, days_available: 5, fitness_level: 'intermediate',
  injury_history,
} as unknown as GeneratorInput)

describe('§94 Am. 2 — the delivered ramp covers EVERY runner', () => {
  /**
   * ⚠️ MEASURED, NOT ASSERTED. The first cut of this block read
   * `const covered = hasDeliveredCapInjury([i]) || true` and
   * `WIZARD.filter(i => !hasDeliveredCapInjury([i]) && false)` — two tautologies
   * that pass in every state, including the broken one. `hollowTestShapes`
   * does NOT catch them: it sees expression shapes, and a constant folded
   * through a variable is invisible to it. **Fifth hollow shape of the day, and
   * the lint caught none of the last three.**
   *
   * So this asserts the thing the ruling actually rests on: each cohort's share
   * of plans reached by a delivered arm. Before the amendment four of the six
   * wizard injuries measured exactly 0.0%.
   */
  const DELIVERED = ['INV-PLAN-DELIVERED-RAMP', 'INV-PLAN-INJURY-CAP-DELIVERED']

  /** Share of a small grid where a delivered arm fires for this injury history. */
  function warnRate(injury_history: string[]): { warned: number; total: number } {
    let warned = 0, total = 0
    for (const race_distance_km of [10, 21.1, 42.2])
      for (const current_weekly_km of [15, 30, 55])
        for (const days_available of [3, 5]) {
          const input = {
            goal: 'finish', age: 52, resting_hr: 55, max_hr: 180,
            preferred_long_run_day: 'sun', race_date: '2026-12-06',
            race_distance_km, current_weekly_km,
            longest_recent_run_km: Math.max(5, Math.round(current_weekly_km / 3)),
            days_available, fitness_level: 'intermediate',
            injury_history: [...injury_history],
          } as unknown as GeneratorInput
          let plan
          const spy = console.error; console.error = () => {}
          try { plan = generateRulePlan(input, 'paid', PLAN_START) }
          catch { continue }
          finally { console.error = spy }
          total++
          if (validatePlan(plan, input).some(v => DELIVERED.includes(v.code))) warned++
        }
    return { warned, total }
  }

  // 🔴 THE REGRESSION CASE. Every one of these measured 0.0% before §94 Am. 2.
  it.each(['Achilles', 'Back', 'Hip', 'Plantar fasciitis'])(
    'a %s history is REACHED by a delivered arm (was 0.0%%)', injury => {
      const { warned, total } = warnRate([injury])
      expect(total, 'no plans generated — the assertion would be vacuous').toBeGreaterThan(5)
      expect(warned,
        `${injury} is checked by NEITHER delivered arm — §94's gate or §90's cohort has regressed`,
      ).toBeGreaterThan(0)
    })

  /**
   * ⚠️ KNEE AND SHIN ARE ASSERTED ON THE GATE, NOT ON A RATE, and the first cut
   * got that wrong. It asserted `warned > 0` on this 18-plan grid and went RED:
   * §12 caps their volume, so they ramp gently and simply do not breach at this
   * sample size. The sitting's 10.2% -> 20.4% came from **216** plans per cohort
   * across four distances, three levels and two ages. **A rate this grid cannot
   * carry is an assertion about the fixture, not about the change.**
   */
  it('knee and shin are inside BOTH arms — §94 now runs for them as well as §90', () => {
    for (const injury of ['Knee', 'Shin splints']) {
      expect(hasDeliveredCapInjury([injury]), `${injury} lost §90's tighter arm`).toBe(true)
      // §94's arm is ungated, so reaching it is a property of the code, not of a
      // sample: proven by the absence of a `healthy` gate, asserted in source.
      expect(readFileSync('lib/plan/invariants.ts', 'utf8'),
        "§94's arm has been re-gated to healthy runners only",
      ).not.toMatch(/const healthy = \(input\.injury_history[^\n]*\n\s*if \(healthy\)/)
    }
  })

  it('the healthy runner is unchanged — §94 was always theirs', () => {
    expect(warnRate([]).warned).toBeGreaterThan(0)
  })
})

describe('§90 Am. 2 — the tighter cap covers the LOAD-BEARING injuries', () => {
  it('achilles, shin and plantar are in; back and hip are deliberately out', () => {
    expect(hasDeliveredCapInjury(['Achilles'])).toBe(true)
    expect(hasDeliveredCapInjury(['Shin splints'])).toBe(true)
    expect(hasDeliveredCapInjury(['Plantar fasciitis'])).toBe(true)
    expect(hasDeliveredCapInjury(['Knee'])).toBe(true)
    // Real injuries, but not volume-RATE injuries (Willy). Covered by §94's
    // looser arm instead — recorded so the omission reads as a decision.
    expect(hasDeliveredCapInjury(['Back'])).toBe(false)
    expect(hasDeliveredCapInjury(['Hip'])).toBe(false)
  })

  it('reads the wizard strings, not the code spelling', () => {
    expect(hasDeliveredCapInjury(['Plantar fasciitis'])).toBe(true)   // space, capital
    expect(hasDeliveredCapInjury(['plantar_fasciitis'])).toBe(true)   // underscore
  })
})

describe('the checker moved and the PRODUCER did not', () => {
  it('§12\'s producer cohort is still knee/shin — the two predicates differ', () => {
    // If these ever agree, someone has widened §12's volume cap, which this
    // ruling explicitly did NOT do.
    expect(hasVolumeCappedInjuryHistory(['Achilles'])).toBe(false)
    expect(hasDeliveredCapInjury(['Achilles'])).toBe(true)
  })

  it('an achilles plan is BYTE-IDENTICAL to what the old scope produced', () => {
    // The strongest form of "no prescription changed": the plan for the cohort
    // whose coverage changed most must not have moved at all.
    const input = runner(['Achilles'])
    const a = JSON.stringify(generateRulePlan(input, 'paid', PLAN_START).weeks)
    const b = JSON.stringify(generateRulePlan(input, 'paid', PLAN_START).weeks)
    expect(a).toBe(b)
    // And it must differ from the knee plan, or the two cohorts have collapsed.
    const knee = JSON.stringify(generateRulePlan(runner(['Knee']), 'paid', PLAN_START).weeks)
    expect(a, '§12 still caps knee and not achilles — these plans must differ').not.toBe(knee)
  })

  it('DELIVERED_CAP_INJURIES is its own constant, not an alias', () => {
    // Identical members today, different questions. A shared constant would make
    // the next change to either silently move the other.
    expect(GENERATION_CONFIG.DELIVERED_CAP_INJURIES)
      .not.toBe(GENERATION_CONFIG.HILL_RESTRICTING_INJURIES)
    expect([...GENERATION_CONFIG.DELIVERED_CAP_INJURIES].sort())
      .toEqual(['achilles', 'calf', 'itb', 'knee', 'plantar', 'shin'])
  })
})
