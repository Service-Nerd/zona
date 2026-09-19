import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { raceDistanceKey } from './generationConfig'
import { InputFieldError } from './inputs'
import type { GeneratorInput } from '@/types/plan'

// RACE-DIST-UNVALIDATED-01 — a missing race distance silently built an ULTRA.
//
// ⚠️ THE FIRST TEST HERE IS THE ONE THAT MATTERS AND IT IS NOT ABOUT THE FIX.
// It pins the SILENT-FALLBACK MECHANISM: `raceDistanceKey` is a ladder of `<=`
// with no lower bound and no NaN arm, so every comparison against a non-number
// is false and it returns its LAST bucket, '100K'. That behaviour is unchanged
// by this fix — the ladder is still wrong for junk input, it simply can no
// longer be reached with junk. If someone later adds a caller that bypasses
// `validateInputFields`, this test says out loud what they will get.

const BASE = {
  athlete_name: 'A', age: 34, race_name: 'T', primary_metric: 'distance',
  race_distance_km: 21.1, race_date: '2027-04-18', plan_start: '2026-11-02',
  goal: 'finish', fitness_level: 'intermediate', training_age: '2-5yr',
  resting_hr: 55, max_hr: 186, current_weekly_km: 35, longest_recent_run_km: 16,
  days_available: 4, injury_history: [], hard_session_relationship: 'neutral',
  recent_quality_training: 'occasional',
} as unknown as GeneratorInput

const withDistance = (km: unknown) =>
  ({ ...BASE, race_distance_km: km }) as unknown as GeneratorInput

describe('RACE-DIST-UNVALIDATED-01', () => {
  it('1. the fallback is real: junk still keys to the ULTRA bucket, not an error', () => {
    expect(raceDistanceKey(undefined as never)).toBe('100K')
    expect(raceDistanceKey(NaN as never)).toBe('100K')
    expect(raceDistanceKey('abc' as never)).toBe('100K')
    // and below the ladder it silently keys to the SHORTEST
    expect(raceDistanceKey(0)).toBe('5K')
    expect(raceDistanceKey(-5)).toBe('5K')
  })

  it.each([
    ['absent', undefined],
    ['NaN', NaN],
    ['a string', '21.1'],
    ['null', null],
    ['zero', 0],
    ['negative', -5],
    ['absurd', 5000],
  ])('2. %s is refused at the boundary rather than built into a plan', (_label, km) => {
    // ⚠️ MATCHED ON THE CLASS, NEVER THE MESSAGE. `InputFieldError`'s text is
    // runner-facing copy ("One of your answers was outside what we can build
    // for...") and names no field on purpose. The first cut of this test
    // asserted on /race_distance_km/ and failed against a guard that was
    // working — the refusal-matching trap this repo has already recorded.
    let thrown: unknown
    try { generateRulePlan(withDistance(km), 'paid') } catch (e) { thrown = e }
    expect(thrown).toBeInstanceOf(InputFieldError)
    expect((thrown as InputFieldError).field).toBe('race_distance_km')
  })

  it('3. every distance the engine actually supports still generates', () => {
    for (const km of [5, 10, 21.1, 42.2, 50, 100]) {
      const plan = generateRulePlan(withDistance(km), 'paid')
      expect(plan.weeks.length).toBeGreaterThan(0)
    }
  })

  it('4. no plan can ship a literal undefined or NaN in runner-facing copy', () => {
    const plan = generateRulePlan(BASE, 'paid')
    const text = JSON.stringify(plan)
    expect(text).not.toMatch(/undefined km/)
    expect(text).not.toMatch(/NaN/)
  })
})
