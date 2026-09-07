import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * §96 — `overdo` is a brake, not a preference (CB-HSR-01, 2026-09-07).
 *
 * The defect: `hard_session_relationship: 'overdo'` was byte-identical to
 * `neutral` in EVERY cell of training_age × distance × injury. Four wizard
 * options, one of which could never change anything for any runner.
 *
 * The tests below assert by DIFFING GENERATED PLANS rather than by asserting on
 * the branch, and that choice is the point. The original HSR-INERT-01 filing was
 * written from a static trace of consumers; three greps agreed and all three
 * found the wrong branch. A one-line diff found the truth immediately. Where the
 * question is "does this input change what a runner sees", generate two plans
 * and diff them — never read the code and conclude.
 */

const FROZEN_NOW = new Date('2026-09-07T09:00:00Z')

type HSR = NonNullable<GeneratorInput['hard_session_relationship']>

const input = (hsr: HSR, o: Partial<GeneratorInput> = {}): GeneratorInput => ({
  race_distance_km: 10, race_date: '2026-12-14', goal: 'time_target',
  target_time: '0:45:00', days_available: 5, age: 40, current_weekly_km: 55,
  longest_recent_run_km: 10, resting_hr: 50, max_hr: 186,
  preferred_long_run_day: 'sun', training_age: '5yr+',
  user_declared_level: 'experienced', recent_quality_training: 'regular',
  hard_session_relationship: hsr, ...o,
} as GeneratorInput)

/** Everything a runner can see. */
const visible = (p: Plan) => JSON.stringify(p.weeks.map(w => ({
  n: w.n, phase: w.phase, km: w.weekly_km,
  s: Object.entries(w.sessions).map(([d, s]) => [
    d, s?.type, s?.label, s?.distance_km, s?.zone, s?.pace_target, s?.coach_notes,
  ]),
})))

/** Structure only — what is prescribed, minus the copy layered over it. */
const structure = (p: Plan) => JSON.stringify(p.weeks.map(w => ({
  n: w.n, phase: w.phase, km: w.weekly_km,
  s: Object.entries(w.sessions).map(([d, s]) => [
    d, s?.type, s?.label, s?.distance_km, s?.zone, s?.pace_target,
  ]),
})))

const plan = (hsr: HSR, o: Partial<GeneratorInput> = {}) =>
  generateRulePlan(input(hsr, o), 'paid')

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(FROZEN_NOW) })
afterAll(() => { vi.useRealTimers() })

describe('§96 — overdo changes the delivered plan', () => {
  it('is no longer identical to neutral — the defect this closes', () => {
    expect(visible(plan('overdo'))).not.toBe(visible(plan('neutral')))
  })

  it('differs for a runner who would NOT have qualified for early onset either way', () => {
    // The onset veto alone would leave `overdo` inert for anyone the §89 gate
    // never reached — beginners included, who are arguably the cohort most
    // likely to say "I overdo it". The §24c cue arm is what covers them.
    const shallow = { training_age: '6-18mo' as const, recent_quality_training: 'none' as const }
    expect(plan('overdo', shallow).meta.early_quality_onset).toBeFalsy()
    expect(plan('neutral', shallow).meta.early_quality_onset).toBeFalsy()
    expect(visible(plan('overdo', shallow))).not.toBe(visible(plan('neutral', shallow)))
  })

  it('vetoes early quality onset even when every readiness signal passes', () => {
    // The control proves the fixture DOES otherwise qualify — without it this
    // assertion would pass on a plan that was never going to fire the gate.
    expect(plan('neutral').meta.early_quality_onset, 'fixture must otherwise qualify').toBe(true)
    expect(plan('overdo').meta.early_quality_onset, 'overdo must veto it').toBeFalsy()
  })

  it('puts the Z2-ceiling cue on long runs outside build phase', () => {
    const cues = (p: Plan) => p.weeks.filter(w =>
      Object.values(w.sessions).some(s =>
        (s?.coach_notes ?? []).some(n => /Zone 2 ceiling/i.test(n ?? '')))).length
    expect(cues(plan('overdo'))).toBeGreaterThan(cues(plan('neutral')))
  })

  it('returns the runner to the STANDARD plan — it declines to accelerate, it does not cut', () => {
    // This assertion replaced two that claimed the veto changed no sessions and
    // no tonnage. Both failed on first run, and they were right to: vetoing
    // early onset lengthens base, which is the entire point, and a longer base
    // means fewer build/peak weeks. The true property is better than the one
    // claimed — `overdo` lands exactly on the plan a runner who never passed the
    // gate would get, so the brake is bounded by the default, not below it.
    //
    // Compared on STRUCTURE — sessions, distances, zones, phases, volumes — and
    // deliberately not on coach_notes, because the Z2 cue is the one thing the
    // brake ADDS on top of the standard plan. Asserting full equality including
    // notes would have forced a choice between dropping the cue and weakening
    // the claim; separating the two lets both be asserted exactly.
    const nonGated = { recent_quality_training: 'occasional' as const }
    expect(plan('neutral', nonGated).meta.early_quality_onset, 'baseline must not be gated')
      .toBeFalsy()
    expect(structure(plan('overdo'))).toBe(structure(plan('neutral', nonGated)))
  })

  it('does NOT suppress quality the way `avoid` does — they are different asks', () => {
    // Conflating them would take work from a runner who asked to be PACED, not
    // spared. `overdo` keeps the standard quality count; `avoid` cuts below it.
    const q = (p: Plan) => p.weeks.flatMap(w =>
      Object.values(w.sessions).filter(s => s?.type === 'quality')).length
    const nonGated = { recent_quality_training: 'occasional' as const }
    expect(q(plan('overdo'))).toBe(q(plan('neutral', nonGated)))
    expect(q(plan('avoid', nonGated))).toBeLessThan(q(plan('neutral', nonGated)))
  })

  it('FALSIFICATION — INV-PLAN-OVERDO-BRAKE goes RED if the gate ever fires', () => {
    const i = input('overdo')
    const p = plan('overdo')
    expect(validatePlan(p, i).filter(v => v.code === 'INV-PLAN-OVERDO-BRAKE')).toHaveLength(0)

    const sabotaged: Plan = { ...p, meta: { ...p.meta, early_quality_onset: true } }
    const fired = validatePlan(sabotaged, i).filter(v => v.code === 'INV-PLAN-OVERDO-BRAKE')
    expect(fired, 'the veto must be mechanically checked, not just implemented').toHaveLength(1)
    expect(fired[0].severity).toBe('error')
  })
})

describe('§96 — the other three answers are unchanged', () => {
  it('love still reaches §47\'s exception for a 5yr+ uninjured runner', () => {
    expect(visible(plan('love'))).not.toBe(visible(plan('neutral')))
  })

  it('love remains INERT below 5yr+ — recorded, not fixed (§96 finding 2)', () => {
    // Not an assertion that this is RIGHT. It is the measured boundary, pinned
    // so that a future change to §35/§47's gates is visible rather than silent.
    // The founder is 2-5yr, which is why his plan showed no response.
    const mid = { training_age: '2-5yr' as const }
    expect(visible(plan('love', mid))).toBe(visible(plan('neutral', mid)))
  })

  it('an injury history vetoes love everywhere', () => {
    const inj = { injury_history: ['Left knee, posterior, recurring'] }
    expect(visible(plan('love', inj))).toBe(visible(plan('neutral', inj)))
  })
})
