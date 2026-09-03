import { describe, it, expect } from 'vitest'
import { generateRulePlan } from './ruleEngine'
import { validateReshapedPlan } from './invariants'
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
