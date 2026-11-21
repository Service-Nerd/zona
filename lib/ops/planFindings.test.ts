import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GeneratorInput, Plan } from '@/types/plan'

/**
 * ADR027-B0-PROD-FINDINGS — the event's shape, with the validator injected. The route arms
 * (`lib/api/generatePlanRoute.test.ts` § J) prove it is WIRED; these prove what it RECORDS:
 * error + warn only, deduped, capped at 40, counts that are violation counts, and a validator
 * that throws becoming a finding rather than a rejection.
 */
const V = vi.hoisted(() => ({
  violations: [] as { code: string; severity: string }[],
  throws: false,
  written: [] as { kind: string; detail: Record<string, unknown>; userId: string | null }[],
}))

vi.mock('@/lib/plan/validateStoredPlan', () => ({
  validateSavedPlan: () => {
    if (V.throws) throw new Error('validator exploded\nsecond line')
    return V.violations
  },
}))
vi.mock('./recordOpsEvent', () => ({
  recordOpsEvent: async (kind: string, detail: Record<string, unknown>, userId: string | null) => {
    V.written.push({ kind, detail, userId })
  },
}))

const plan = (meta: Record<string, unknown> = {}) => ({ meta: { generator_version: '2.0', ...meta }, weeks: [] }) as unknown as Plan
const input = { race_distance_km: 10 } as GeneratorInput

beforeEach(() => { V.violations = []; V.throws = false; V.written = [] })

describe('planFindingsDetail', () => {
  it('counts errors and warns, drops info, dedupes codes', async () => {
    const { planFindingsDetail } = await import('./planFindings')
    V.violations = [
      { code: 'A', severity: 'error' }, { code: 'A', severity: 'error' },
      { code: 'B', severity: 'warn' }, { code: 'C', severity: 'info' },
    ]
    expect(planFindingsDetail(plan(), input)).toEqual({
      codes: ['A', 'B'], errors: 2, warns: 1, kind: 'race', engine_version: '2.0', race_distance_km: 10,
    })
  })

  it('caps codes at 40 and keeps the counts whole', async () => {
    const { planFindingsDetail, PLAN_FINDINGS_CODE_CAP } = await import('./planFindings')
    V.violations = Array.from({ length: 55 }, (_, i) => ({ code: `E${i}`, severity: 'error' }))
    const d = planFindingsDetail(plan({ plan_kind: 'base_build' }), input)
    expect(PLAN_FINDINGS_CODE_CAP).toBe(40)
    expect(d.codes).toHaveLength(40)
    expect(d.errors).toBe(55)
    expect(d.kind).toBe('base_build')
  })

  it('omits engine_version when the plan carries none, rather than writing a placeholder', async () => {
    const { planFindingsDetail } = await import('./planFindings')
    expect('engine_version' in planFindingsDetail(plan({ generator_version: undefined }), input)).toBe(false)
  })
})

describe('recordPlanFindings', () => {
  it('writes exactly one plan_findings row', async () => {
    const { recordPlanFindings } = await import('./planFindings')
    await recordPlanFindings(plan(), input, 'u1')
    expect(V.written.map(w => [w.kind, w.userId])).toEqual([['plan_findings', 'u1']])
  })

  it('never rejects: a throwing validator is recorded as VERIFIER_THREW', async () => {
    const { recordPlanFindings } = await import('./planFindings')
    V.throws = true
    await expect(recordPlanFindings(plan(), input, 'u1')).resolves.toBeUndefined()
    expect(V.written).toHaveLength(1)
    expect(V.written[0].detail).toMatchObject({ codes: ['VERIFIER_THREW'], message: 'validator exploded' })
  })

  it('does not validate synchronously: nothing runs before the caller yields', async () => {
    const { recordPlanFindings } = await import('./planFindings')
    let called = false
    V.violations = new Proxy([], { get: (t, k) => { called = true; return Reflect.get(t, k) } }) as never
    const p = recordPlanFindings(plan(), input, null)
    expect(called).toBe(false)
    await p
    expect(called).toBe(true)
  })
})
