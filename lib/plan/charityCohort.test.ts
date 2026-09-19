import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { isDesignedRefusal } from './designedRefusal'
import { validatePlan } from './invariants'
import { PLAN_PERSONAS, ENGINE_PERSONAS, CHARITY_PERSONAS, charityInput, CHARITY_PLAN_START } from './charityCohort'

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
        // REFUSAL-COPY-02 — assert the refusal TYPE, never the wording. This
        // matched prose and broke the moment the §52 message was voiced, which
        // is the tell that the copy was an undeclared wire format.
        let thrown: unknown = null
        try { generateRulePlan(input, 'paid', CHARITY_PLAN_START) } catch (e) { thrown = e }
        expect(thrown, `${p.id} was expected to be refused by design`).not.toBeNull()
        expect(
          isDesignedRefusal(thrown),
          `${p.id} threw something that is not a designed refusal: ${(thrown as Error)?.name} ${(thrown as Error)?.message}`,
        ).toBe(true)
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


describe('PERSONA-CORPUS-01 — the corpus is derived, not duplicated', () => {
  it('CHARITY_PERSONAS and ENGINE_PERSONAS partition PLAN_PERSONAS exactly', () => {
    // Two registers of the same objects with a human in between is how they
    // drift. Both are FILTERS of one array; this asserts they stay that way.
    expect(CHARITY_PERSONAS.length + ENGINE_PERSONAS.length).toBe(PLAN_PERSONAS.length)
    const ids = new Set(PLAN_PERSONAS.map(p => p.id))
    expect(ids.size, 'duplicate persona ids').toBe(PLAN_PERSONAS.length)
    for (const p of CHARITY_PERSONAS) expect(p.cohort).not.toBe('engine')
    for (const p of ENGINE_PERSONAS) expect(p.cohort).toBe('engine')
  })

  it('neither subset is empty — a corpus that silently empties passes everything', () => {
    expect(CHARITY_PERSONAS.length).toBeGreaterThanOrEqual(14)
    expect(ENGINE_PERSONAS.length).toBeGreaterThanOrEqual(6)
  })

  it('E4 is still the short-runway early-onset shape that found PHASE-EMPTY-01', () => {
    // If this persona is edited into something ordinary, the cell it covers is
    // lost and nothing says so. 0 of 45,764 grid plans reach it.
    const e4 = ENGINE_PERSONAS.find(p => p.id.startsWith('E4'))
    expect(e4, 'E4 removed from the corpus').toBeDefined()
    expect(e4!.weeks).toBeLessThanOrEqual(12)
    expect(e4!.input.fitness_level ?? 'experienced').not.toBe('beginner')
    expect(e4!.input.recent_quality_training).toBe('regular')
  })
})
