import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from './charityCohort'

// CHARITY-COHORT-01 (2026-09-13) — durable, named coverage for the charity
// referral (10K / HM / marathon; first-timers, injured, masters, low base,
// compressed). Marathon had 0 real-input-corpus cases and the golden set had no
// injury personas, so this pins the exact population the partner sends.
//
// The contract is deliberately the constitution, not a snapshot: every persona
// either generates a plan with ZERO error-severity violations, or is a by-design
// refusal (prep-time / days-minimum honesty). Warn residuals are tolerated here
// the same way the property sweep tolerates its baselined register — they are
// the subject of a Coaching Board review, not a build failure.
//
// vitest runs with NODE_ENV=test, so generateRulePlan THROWS on any error-
// severity violation; a persona that regresses into an error fails here twice
// over (the throw, and the explicit validatePlan assertion for the clean ones).

describe('charity cohort — every persona is valid or a by-design refusal', () => {
  for (const p of CHARITY_PERSONAS) {
    it(p.id, () => {
      const input = charityInput(p)
      if (p.expectRefusal) {
        expect(() => generateRulePlan(input, 'paid', CHARITY_PLAN_START))
          .toThrow(/preparation|days\/week|minimum|prep/i)
        return
      }
      const plan = generateRulePlan(input, 'paid', CHARITY_PLAN_START)
      const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
      expect(errors.map(e => `[${e.code}] wk${e.week ?? '—'} ${e.message}`)).toEqual([])
    })
  }

  it('covers all three charity distances', () => {
    const dists = new Set(CHARITY_PERSONAS.map(p => p.input.race_distance_km))
    expect(dists.has(10)).toBe(true)
    expect(dists.has(21.1)).toBe(true)
    expect(dists.has(42.2)).toBe(true)
  })
})
