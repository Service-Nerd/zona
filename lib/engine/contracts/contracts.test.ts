import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  REFUSAL_CODE_BY_ERROR_NAME, CHECKPOINT_REFUSAL_CODES, DESIGNED_REFUSAL_NAMES_OWNED,
  refusalCodeForErrorName, httpStatusFor, PlansCreateRequestSchema, ENGINE_OPERATIONS,
  type EngineResult,
} from './result'
import { RuleSchema, resolveRuleConfigKey } from './rule'
import { findingFromViolation, FindingSchema } from './decision'

/** ADR027-B1-CONTRACTS — the v2 request, result, rule and finding shapes. */

describe('refusal codes', () => {
  it('map exactly the designed refusals `isDesignedRefusal` owns, no more, no fewer', () => {
    expect(Object.keys(REFUSAL_CODE_BY_ERROR_NAME).sort()).toEqual([...DESIGNED_REFUSAL_NAMES_OWNED].sort())
  })

  it('every code is unique, and each names its principle', () => {
    const codes = [...Object.values(REFUSAL_CODE_BY_ERROR_NAME).map(r => r.code), ...CHECKPOINT_REFUSAL_CODES]
    expect(new Set(codes).size).toBe(codes.length)
    for (const r of Object.values(REFUSAL_CODE_BY_ERROR_NAME)) expect(r.principle_ref).toMatch(/^§\d+$/)
  })

  it('a name that is not a designed refusal has no code (a fault stays a fault)', () => {
    expect(refusalCodeForErrorName('BaseVolumeError')).toBe('base_volume')
    expect(refusalCodeForErrorName('InputFieldError')).toBeNull()
    expect(refusalCodeForErrorName('TypeError')).toBeNull()
  })

  it('the checkpoint codes are the reasons `evaluateCheckpoint` returns today', () => {
    const src = readFileSync('lib/plan/engine.ts', 'utf8')
    for (const c of CHECKPOINT_REFUSAL_CODES) expect(src).toContain(`reason: '${c}'`)
  })

  it('the contract names every code', () => {
    const doc = readFileSync('docs/contracts/engine.md', 'utf8')
    for (const r of Object.values(REFUSAL_CODE_BY_ERROR_NAME)) expect(doc).toContain(`\`${r.code}\``)
    for (const c of CHECKPOINT_REFUSAL_CODES) expect(doc).toContain(`\`${c}\``)
    for (const op of ENGINE_OPERATIONS) expect(doc).toContain(`\`${op}\``)
  })
})

describe('HTTP mapping', () => {
  const refused = (code: 'base_volume' | 'checkpoint_no_base_build'): EngineResult =>
    ({ ok: false, refused: true, code, reason: 'r', levers: [] })
  it('ok 200 · invalid_input 400 · refused 422 · checkpoint state conflict 409', () => {
    expect(httpStatusFor({ ok: false, invalid_input: true, field: 'age', why: 'range' })).toBe(400)
    expect(httpStatusFor(refused('base_volume'))).toBe(422)
    expect(httpStatusFor(refused('checkpoint_no_base_build'))).toBe(409)
  })
})

describe('plans.create request', () => {
  const ok = {
    operation: 'plans.create', as_of: '2026-11-21',
    input: { race_date: '2027-04-25', race_distance_km: 21.1, goal: 'finish', current_weekly_km: 25,
      longest_recent_run_km: 10, days_available: 4 },
    options: { display_units: 'km' },
  }
  it('accepts a minimal request', () => expect(PlansCreateRequestSchema.safeParse(ok).success).toBe(true))
  it('requires as_of (ARCH-ENG-005)', () => {
    const { as_of: _a, ...noDate } = ok
    expect(PlansCreateRequestSchema.safeParse(noDate).success).toBe(false)
  })
  it('refuses a tier: the engine is tier-blind (ADR-003)', () => {
    expect(PlansCreateRequestSchema.safeParse({ ...ok, tier: 'paid' }).success).toBe(false)
  })
})

describe('Rule (ARCH-ENG-003: reference, never copy)', () => {
  const rule = {
    id: 'INV-PLAN-WEEK-1-2-LONG-CAP', principle_ref: '§113 Am. 1', scope: 'session', kind: 'hard',
    config_key: { source: 'GENERATION_CONFIG', key: 'WEEK_1_2_LONG_RUN_CAP_MULTIPLIER' },
    explain: 'Your first long runs stay within {cap_pct} of your longest recent run (§9).',
  }
  it('accepts a referencing rule', () => expect(RuleSchema.safeParse(rule).success).toBe(true))
  it('refuses a value field', () => expect(RuleSchema.safeParse({ ...rule, value: 1.1 }).success).toBe(false))
  it('refuses a number copied into the explanation', () => {
    expect(RuleSchema.safeParse({ ...rule, explain: 'within 10% of your longest run' }).success).toBe(false)
  })
  it('resolves a real config key and refuses an invented one', () => {
    expect(resolveRuleConfigKey(rule as never)).toBe(true)
    expect(resolveRuleConfigKey({ config_key: { source: 'GENERATION_CONFIG', key: 'NOT_A_KEY' } })).toBe(false)
    expect(resolveRuleConfigKey({ config_key: null })).toBe(true)
  })
})

describe('Finding', () => {
  it('is built from a validatePlan violation; week 0 is plan-level', () => {
    const v = { code: 'INV-PLAN-TAPER', principle_ref: '§12', severity: 'warn' as const, week: 0,
      message: 'm', actual: 1, expected: 2 }
    expect(findingFromViolation(v, 'h')).toEqual({ rule_id: 'INV-PLAN-TAPER', severity: 'warn', week: null, detail: 'm', input_hash: 'h' })
    expect(findingFromViolation({ ...v, week: 3 }, null).week).toBe(3)
    expect(findingFromViolation({ ...v, week: -2 }, null).week, 'a foundation week keeps its n').toBe(-2)
  })
  it('refuses a finding without a rule id', () => {
    expect(FindingSchema.safeParse({ rule_id: 'taper', severity: 'warn', week: null, detail: '', input_hash: null }).success).toBe(false)
  })
})
