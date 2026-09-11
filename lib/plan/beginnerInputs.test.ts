// UX-BEGINNER-01 — a first-time runner's honest answers must not be refused in
// schema language.
//
// The reported case, verbatim from a real device: a beginner dragged "longest
// recent run" to 0 — which the wizard's Ruler permits (LONGEST_RUN_KM_MIN: 0) —
// and got back:
//
//   "Invalid input: longest_recent_run_km=0 (acceptable range: 1–300).
//    Empty or out-of-range physiological inputs are rejected."
//
// Three faults in one: two owners disagreeing (the wizard offers a value the API
// refuses), an internal field name shown to a runner, and a voice belonging to
// no part of this brand. This cohort — first-time charity marathoners — is
// exactly who Make-A-Wish sends.

import { describe, it, expect } from 'vitest'
import { validateInputFields, InputFieldError } from './inputs'
import { generateRulePlan } from './ruleEngine'
import { validatePlan } from './invariants'
import { GENERATION_CONFIG } from './generationConfig'
import type { GeneratorInput } from '@/types/plan'

const beginner = (over: Record<string, unknown> = {}) => ({
  athlete_name: 'A', age: 38, race_name: 'Charity', primary_metric: 'distance',
  plan_start: '2026-04-27', race_distance_km: 42.2, race_date: '2026-10-05',
  goal: 'finish', current_weekly_km: 5, longest_recent_run_km: 0,
  fitness_level: 'beginner', recent_quality_training: 'none',
  hard_session_relationship: 'avoid', injury_history: [],
  days_available: 4, days_cannot_train: [],
  ...over,
}) as unknown as GeneratorInput

describe('a beginner who has never run', () => {
  it('is ACCEPTED with longest run = 0', () => {
    expect(() => validateInputFields(beginner())).not.toThrow()
  })

  // The wizard's Ruler goes to 0, so the API must too. A control that offers a
  // value the server rejects is the two-owner split this item is about.
  it('the wizard floor and the API floor agree', () => {
    expect(GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_MIN).toBe(0)
    expect(() => validateInputFields(
      beginner({ longest_recent_run_km: GENERATION_CONFIG.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_MIN }),
    )).not.toThrow()
  })

  // ⚠️ READ `weekly_km`, NOT a sum of `distance_km`. A beginner's plan is
  // DURATION-ANCHORED: sessions carry `duration_mins` with `distance_km` null,
  // because without pace data the engine prescribes time. A first draft of this
  // test summed distance, read 0, and reported an empty week 1 for a plan that
  // is four sessions of 32–44 minutes. The same flaw was in `cohortShape.ts`
  // and understated mean peak volume by 30%.
  it('generates a real plan, not an empty one', () => {
    const input = beginner()
    const plan = generateRulePlan(input, 'paid', '2026-04-27', undefined, '2026-04-27')
    const week1 = plan.weeks.find(w => w.n === 1)!
    expect(week1.weekly_km, 'week 1 must contain actual running').toBeGreaterThan(0)
    const sessions = Object.values(week1.sessions).filter(s => s && s.type !== 'rest')
    expect(sessions.length, 'week 1 must contain sessions').toBeGreaterThan(0)
    // Duration-anchored is CORRECT here — assert the runner gets a prescription
    // of some kind, not that it is expressed in kilometres.
    for (const s of sessions) {
      expect((s!.distance_km ?? 0) > 0 || (s!.duration_mins ?? 0) > 0,
        'every session must state a distance or a duration').toBe(true)
    }
    expect(validatePlan(plan, input).filter(v => v.severity === 'error')).toEqual([])
  })
})

describe('what a refused runner is told', () => {
  const refusalFor = (over: Record<string, unknown>) => {
    try { validateInputFields(beginner(over)); return null }
    catch (e) { return e as InputFieldError }
  }

  // "I run nothing at all" is ACCEPTED. Verified against the engine's own
  // `Week.weekly_km`: 0/0/beginner gives week 1 of 13–18km over 3–4 sessions,
  // zero invariant errors, at every distance. The engine applies a beginner
  // floor, so 0 and 1 produce the same plan — accepting zero changes no
  // prescription, it only stops us refusing the honest answer.
  it('ACCEPTS "I run nothing at all"', () => {
    expect(() => validateInputFields(beginner({ current_weekly_km: 0 }))).not.toThrow()
  })

  it('still refuses input that is broken rather than honest', () => {
    expect(refusalFor({ current_weekly_km: -1 })).toBeInstanceOf(InputFieldError)
    expect(refusalFor({ current_weekly_km: Number.NaN })).toBeInstanceOf(InputFieldError)
    expect(refusalFor({ longest_recent_run_km: Number.NaN })).toBeInstanceOf(InputFieldError)
  })

  // Tests the SHAPE of a leaked identifier, not the bare word: "age" is also
  // ordinary English and "your age" is exactly what a person should be told.
  // What must never appear is snake_case or a `field=value` fragment.
  it.each([
    ['current_weekly_km', { current_weekly_km: -1 }],
    ['age', { age: 3 }],
    ['resting_hr', { resting_hr: 5 }],
    ['max_hr', { max_hr: 5 }],
    ['longest_recent_run_km', { longest_recent_run_km: -4 }],
  ])('never shows the runner the %s field name', (field, over) => {
    const err = refusalFor(over)!
    expect(err, `expected a refusal for ${JSON.stringify(over)}`).toBeInstanceOf(InputFieldError)
    expect(err.message, `snake_case identifier in: "${err.message}"`).not.toMatch(/[a-z]+_[a-z_]+/)
    expect(err.message, `field=value fragment in: "${err.message}"`).not.toMatch(/\w+\s*=\s*-?\d/)
    // The structured payload keeps it — /api/generate-plan returns field/value/
    // range so the client can still highlight the offending input.
    expect(err.field).toBe(field)
  })

  it.each([
    ['current_weekly_km', { current_weekly_km: -1 }],
    ['age', { age: 3 }],
    ['longest_recent_run_km', { longest_recent_run_km: -4 }],
  ])('speaks plainly for %s — no schema words', (_f, over) => {
    const m = refusalFor(over)!.message
    for (const banned of ['Invalid input', 'physiological inputs are rejected', 'acceptable range', '_km', '=']) {
      expect(m, `"${banned}" in: ${m}`).not.toContain(banned)
    }
    expect(m.length, 'a refusal that says nothing is not an improvement').toBeGreaterThan(30)
  })

  it('tells a runner that zero is allowed, when their input was broken', () => {
    const m = refusalFor({ current_weekly_km: -1 })!.message
    expect(m.toLowerCase()).toContain('zero is fine')
  })
})
