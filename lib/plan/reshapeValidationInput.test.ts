import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validateReshapedPlan } from './invariants'
import { fitnessFromVolume, structuralLevelForCheck } from './fitnessAssessment'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * ADR-020 / CB-2 — validateReshapedPlan must use the PERSISTED generator input.
 *
 * It previously hand-rebuilt the input and zeroed `current_weekly_km`,
 * `longest_recent_run_km` and `days_cannot_train` with comments saying "not on
 * meta". Stale: PV2-A persists the full input at `meta.generator_input`. The
 * cost was three invariant families inert on EVERY reshape — an input the
 * checker never reads tests nothing (SWEEP-VACUOUS-01 class).
 */

const INPUT: GeneratorInput = {
  race_date: '2027-04-11', race_distance_km: 10, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, age: 40,
  days_cannot_train: ['monday', 'wednesday'],
  max_weekday_mins: 45, preferred_long_run_day: 'sun',
} as unknown as GeneratorInput

const plan = (): Plan => generateRulePlan(INPUT, 'trial', '2026-11-30')

describe('validateReshapedPlan — input source', () => {
  it('reads days_cannot_train from the persisted input', () => {
    const p = plan()
    expect(p.meta.generator_input?.days_cannot_train).toEqual(['monday', 'wednesday'])

    // Plant a session on a blocked day. The blocked-days invariant can only see
    // it if the real input reached the validator.
    const wk = p.weeks.find(w => w.n === 3)!
    ;(wk.sessions as Record<string, unknown>).mon = {
      type: 'easy', label: 'Easy run', detail: null, distance_km: 6, zone: 'Zone 2',
    }

    const codes = validateReshapedPlan(p).map(v => v.code)
    expect(codes).toContain('INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS')
  })

  it('reads max_weekday_mins from the persisted input', () => {
    const p = plan()
    const wk = p.weeks.find(w => w.n === 3)!
    ;(wk.sessions as Record<string, { duration_mins?: number }>).tue = {
      type: 'easy', label: 'Easy run', detail: null,
      distance_km: 12, duration_mins: 90, zone: 'Zone 2',
    } as never

    const codes = validateReshapedPlan(p).map(v => v.code)
    expect(codes).toContain('INV-PLAN-MAX-WEEKDAY-MINS')
  })

  it('falls back cleanly for a legacy plan with no persisted input', () => {
    const p = plan()
    delete (p.meta as { generator_input?: unknown }).generator_input

    // Must not throw, and must not invent violations from a missing input.
    expect(() => validateReshapedPlan(p)).not.toThrow()
    const codes = validateReshapedPlan(p).map(v => v.code)
    expect(codes).not.toContain('INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS')
  })

  it('keeps the engine-derived fitness level, not the raw input value (§79)', () => {
    // The assessed path leaves input.fitness_level undefined; meta carries what
    // the engine derived. Overriding meta with undefined would re-derive the
    // quality ceiling from the wrong level.
    const assessed = { ...INPUT, fitness_level: undefined } as GeneratorInput
    const p = generateRulePlan(assessed, 'trial', '2026-11-30')
    expect(p.meta.generator_input?.fitness_level).toBeUndefined()
    expect(p.meta.fitness_level).toBeTruthy()
    // A clean plan must stay clean — no quality-ceiling false positive.
    const errs = validateReshapedPlan(p).filter(v => v.severity === 'error')
    expect(errs.map(v => v.code)).not.toContain('INV-PLAN-QUALITY-PER-WEEK')
  })
})

/**
 * STRUCTURAL-LEVEL-LEGACY-ZERO-01 (code review, 2026-11-03) — the resolved STRUCTURAL
 * level must honour the legacy zeroed-field convention.
 *
 * 🔴 `validatePlan` resolves `structuralFitness` as
 * `plan.meta.fitness_level ?? resolveLevels(input).structural`, and the legacy branch
 * of `validateReshapedPlan` reconstructs an input with `current_weekly_km: 0` and
 * `longest_recent_run_km: 0` under the stated rule that *"the three zeroed fields
 * self-skip their dependent invariants"*. `fitnessFromVolume(0, 0)` returns
 * **beginner** — the arm is `weeklyKm < 20` — so without a guard every legacy
 * meta-less plan resolves as a beginner and every beginner-gated rule reading this
 * resolution fires on it.
 *
 * ⚠️ §117's gate escaped by accident (it early-returns on `longest <= 0`).
 * `INV-PLAN-BEGINNER-NEUROMUSCULAR` has no such guard, which is why this is asserted
 * on the RESOLUTION and not on one consumer.
 */
describe('the structural level honours the legacy zeroed-field convention', () => {
  // ⚠️ ASSERTED ON THE OWNER, NOT THROUGH AN INVARIANT. The first version of this
  // block asked whether a legacy plan raised `INV-PLAN-BEGINNER-NEUROMUSCULAR`, and
  // **two mutations of the guard left it green** — §28 places strides on 100% of plans,
  // so that invariant passes on its own merits and the gate's state is invisible to it.
  // An arm that cannot go red is not a check (AN ALLOW-BY-DEFAULT ARM IS NOT A CHECK).

  it('fitnessFromVolume(0, 0) is BEGINNER — the premise, stated so it cannot rot', () => {
    expect(fitnessFromVolume(0, 0)).toBe('beginner')
    // The direction the first version of the comment in `invariants.ts` claimed, kept
    // for contrast: `undefined` reads intermediate, `0` does not.
    expect(fitnessFromVolume(undefined as unknown as number, undefined as unknown as number))
      .toBe('intermediate')
  })

  const legacyInput = { current_weekly_km: 0, longest_recent_run_km: 0 } as never

  it('no volume signal resolves to UNDEFINED, so a beginner-gated checker self-skips', () => {
    expect(structuralLevelForCheck(undefined, legacyInput)).toBeUndefined()
  })

  it('a real volume signal still resolves — the guard is not a blanket skip', () => {
    // The opposite failure: a guard that skips everything is the rule switched off.
    expect(structuralLevelForCheck(undefined, { current_weekly_km: 30, longest_recent_run_km: 10 } as never))
      .toBe('intermediate')
    expect(structuralLevelForCheck(undefined, { current_weekly_km: 0, longest_recent_run_km: 10 } as never))
      .toBe('beginner')
    expect(structuralLevelForCheck(undefined, { current_weekly_km: 12, longest_recent_run_km: 0 } as never))
      .toBe('beginner')
  })

  it("the plan's own stamped level wins, so no engine-produced plan is affected", () => {
    expect(structuralLevelForCheck('experienced', legacyInput)).toBe('experienced')
  })

  it('end to end: a legacy meta-less plan reconstructs with the zeroed fields', () => {
    const p = plan() as unknown as { meta: Record<string, unknown> }
    delete p.meta.generator_input
    delete p.meta.fitness_level
    delete p.meta.fitness_intensity_level
    // The reconstruction this guard exists for, proven present rather than assumed.
    expect(validateReshapedPlan(p as unknown as Plan).map(v => v.code))
      .not.toContain('INV-PLAN-BEGINNER-NEUROMUSCULAR')
  })
})
