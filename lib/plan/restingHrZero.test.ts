/**
 * PLAN-RESTING-HR-ZERO-01 — a resting HR of zero is ABSENT, not measured.
 *
 * 🔴 THE DEFECT, MEASURED ON PRODUCTION. **10 of 22 live plans** carry
 * `meta.resting_hr = 0` — written by `resting_hr: rhr ?? 0` in the engine when
 * the runner never gave one. `0` is a number, so every `rhr !== undefined` test
 * downstream took §14's KARVONEN branch with a zero baseline, making the heart-
 * rate reserve the entire max HR. All ten FAIL `PlanSchema`, which has always
 * said `.positive()`.
 *
 * ⚠️ THE SESSIONS THEMSELVES WERE FINE, AND THAT IS THE INTERESTING PART. At
 * generation the engine passed no resting HR at all, so the bands were computed
 * on %MaxHR and are correct. The `0` was written into `meta` AFTERWARDS, as a
 * record of a number nobody had. So the CHECKER derived an expected band from a
 * zero baseline and disagreed with a plan that was right — the same
 * producer/checker split as STRIDES-CHECKER-OWNER-01, one day apart.
 *
 * ⚠️ `verify:parity` CANNOT SEE THIS. Its 5,994-case grid pins `resting_hr: 55`
 * on every case, so the entire no-resting-HR cohort is outside it and it came
 * back IDENTICAL on the commit that fixed this. Green there means nothing here.
 */
import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { computeZones } from './zones'
import { PlanSchema } from './schema'
import type { GeneratorInput } from '@/types/plan'

const PLAN_START = '2026-04-27'

/** The live shape: a runner who gave a max HR and never gave a resting one. */
const NO_RHR = {
  athlete_name: 'Athlete', age: 41, race_name: 'Test', primary_metric: 'distance',
  plan_start: PLAN_START, race_distance_km: 21.1, race_date: '2026-08-01',
  goal: 'finish',
  max_hr: 187, current_weekly_km: 35, longest_recent_run_km: 14,
  fitness_level: 'intermediate', recent_quality_training: 'occasional',
  hard_session_relationship: 'neutral', injury_history: [],
  days_available: 4, days_cannot_train: ['mon', 'fri', 'wed'],
} as unknown as GeneratorInput

describe('PLAN-RESTING-HR-ZERO-01 — zero is absent, not measured', () => {
  it('computeZones treats 0 as ABSENT — the %MaxHR branch, not Karvonen-from-zero', () => {
    const absent = computeZones(187)
    expect(computeZones(187, 0)).toEqual(absent)
    for (const junk of [0, -5, NaN, Number.POSITIVE_INFINITY]) {
      expect(computeZones(187, junk)).toEqual(absent)
    }
  })

  it('REPRODUCES THE HARM: Karvonen-from-zero is a different, wrong band', () => {
    // Not merely "not equal" — pin the size of the error, so a fix that made the
    // two branches coincidentally agree could not pass this.
    const correct = computeZones(187)          // %MaxHR
    const hrr = (pct: number) => Math.round(0 + (pct / 100) * (187 - 0))
    expect(correct.zone2Floor).toBe(Math.round(187 * 0.70))   // 131
    expect(hrr(60)).toBe(112)                                 // what the bug produced
    expect(correct.zone2Floor - hrr(60)).toBe(19)             // 19 bpm too low
  })

  it('the PRODUCER omits the key rather than writing a zero', () => {
    const plan = generateRulePlan(NO_RHR, 'paid', PLAN_START)
    expect('resting_hr' in plan.meta).toBe(false)
    expect(plan.meta.resting_hr).toBeUndefined()
  })

  it('PlanSchema rejects the zero and accepts its absence', () => {
    const plan = generateRulePlan(NO_RHR, 'paid', PLAN_START)
    expect(PlanSchema.safeParse(plan).success).toBe(true)
    // The live shape of all ten affected plans.
    const withZero = { ...plan, meta: { ...plan.meta, resting_hr: 0 } }
    expect(PlanSchema.safeParse(withZero).success).toBe(false)
  })

  it('a runner WITH a resting HR still gets Karvonen — the fix narrows nothing', () => {
    const karvonen = computeZones(187, 55)
    expect(karvonen).not.toEqual(computeZones(187))
    expect(karvonen.zone2Floor).toBe(Math.round(55 + 0.60 * (187 - 55)))
  })

  it('the whole plan validates — §84 agrees with itself when no resting HR exists', () => {
    // The live consequence: with `resting_hr: 0` in meta the invariant derived its
    // expected band from a zero baseline and disagreed with correct sessions.
    const plan = generateRulePlan(NO_RHR, 'paid', PLAN_START)
    const v = validatePlan(plan, NO_RHR)
    expect(v.filter(x => x.code === 'INV-PLAN-DISPLAY-ZONE-MATCHES-WORK')).toEqual([])
    expect(v.filter(x => x.severity === 'error')).toEqual([])
  })
})
