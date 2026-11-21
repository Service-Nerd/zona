import { describe, it, expect } from 'vitest'
import { isDeepStrictEqual } from 'node:util'
import { cohortGrid, COHORT_PLAN_START } from '@/lib/plan/cohortGrid'
import { runEngine } from '@/lib/plan/engine'
import type { Plan, GeneratorInput } from '@/types/plan'
import { toV1, toV2, parsePlanV2, isPlanV2, carriedWeekKeys } from './planV1V2'
import { GeneratorInputV2Schema, type PlanV2 } from './planV2'

/**
 * ADR027-B1-CONTRACTS — `toV1(toV2(p))` deep-equals `p`, and `toV2(p)` parses strictly.
 *
 * CORPUS: `cohortGrid()` (41,472 rows = 2^9 x 3^4) at a stride of 431, a prime, so the
 * sample does not alias the grid's axes (an even stride once sampled 0 VDOT rows in
 * 1,260). Each row is put into PRODUCTION SHAPE first: a key that is not a
 * `GeneratorInput` field is removed, and the set removed is asserted, so a new one is noticed.
 *
 * The other half of B1's exit, every STORED plan, cannot run in CI (production is not
 * reachable from it). It was run read-only from a scratch script on 2026-11-21 and the
 * figures are in the commit; the legacy values it found are pinned in `planV2.test.ts`.
 */

const STRIDE = 431
const PRODUCT_KEYS = new Set(Object.keys(GeneratorInputV2Schema.shape))

function productionShape(row: GeneratorInput): { input: GeneratorInput; dropped: string[] } {
  const input: Record<string, unknown> = {}
  const dropped: string[] = []
  for (const [k, v] of Object.entries(row)) (PRODUCT_KEYS.has(k) ? (input[k] = v) : dropped.push(k))
  return { input: input as unknown as GeneratorInput, dropped }
}

const grid = cohortGrid()
const droppedKeys = new Set<string>()
const outcomes = new Map<string, number>()
const plans: Plan[] = []
let baseBuilds = 0
for (let i = 0; i < grid.length; i += STRIDE) {
  const { input, dropped } = productionShape(grid[i])
  dropped.forEach(k => droppedKeys.add(k))
  let o
  try {
    o = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: COHORT_PLAN_START })
  } catch (e) {
    // A genuine engine throw is the frozen engine's, not this adapter's; it is counted.
    outcomes.set('threw', (outcomes.get('threw') ?? 0) + 1)
    continue
  }
  outcomes.set(o.kind, (outcomes.get(o.kind) ?? 0) + 1)
  if (o.kind === 'plan') plans.push(o.plan, o.rulePlan)
  else if (o.kind === 'base_build') plans.push(o.plan)
  // The base-build plan kind (P-15's "give me the base build", a product path): the grid
  // alone yields none at this stride, and 4 of 43 live plans are base builds.
  try {
    const b = runEngine({ input, tier: 'paid', displayUnits: 'km', planStart: COHORT_PLAN_START, acceptBaseBuild: true })
    if (b.kind === 'base_build') { plans.push(b.plan); baseBuilds++ }
  } catch { outcomes.set('threw', (outcomes.get('threw') ?? 0) + 1) }
}

/** A stored plan is JSON: undefined-valued keys do not survive the save. */
const stored = (p: Plan): Plan => JSON.parse(JSON.stringify(p))

describe('ADR027-B1-CONTRACTS — v1 ↔ v2 adapter', () => {
  it('the corpus is real and production-shaped', () => {
    expect(grid.length).toBe(41_472)
    expect(plans.length).toBeGreaterThanOrEqual(150)
    expect(baseBuilds).toBeGreaterThanOrEqual(10)
    // The grid's two non-input keys. A third fails here rather than being stripped quietly.
    // `primary_metric` is a session/meta field no product path posts; `plan_start` is a
    // v2 request OPTION (`options.plan_start`), not a runner attribute.
    expect(Array.from(droppedKeys).sort()).toEqual(['plan_start', 'primary_metric'])
    expect(outcomes.get('threw') ?? 0).toBeLessThanOrEqual(3)
  })

  it('round-trips every corpus plan, in memory and as stored', () => {
    const bad = plans.filter(p => !isDeepStrictEqual(toV1(toV2(p)), p)).length
    const badStored = plans.map(stored).filter(p => !isDeepStrictEqual(toV1(toV2(p)), p)).length
    expect({ bad, badStored }).toEqual({ bad: 0, badStored: 0 })
  })

  it('every corpus plan parses as strict v2, and the parse changes nothing', () => {
    const failures: string[] = []
    for (const p of plans.map(stored)) {
      const r = parsePlanV2(toV2(p))
      if (!r.ok) failures.push(...r.issues)
      else if (!isDeepStrictEqual(toV1(r.plan), p)) failures.push('parse altered the plan')
    }
    expect(Array.from(new Set(failures))).toEqual([])
  })

  it('the engine puts nothing in v1_carry: every key it writes on a week is declared', () => {
    const carried = Array.from(new Set(plans.flatMap(p => carriedWeekKeys(toV2(stored(p))))))
    expect(carried).toEqual([])
  })

  it('a week key v2 does not declare is carried losslessly, and named', () => {
    const p = stored(plans[0])
    const legacy = { ...p, weeks: p.weeks.map((w, i) => i === 1 ? { ...w, retired_example: 'x' } : w) } as Plan
    const v2 = toV2(legacy)
    expect(carriedWeekKeys(v2)).toEqual(['retired_example'])
    expect((v2.weeks[1] as Record<string, unknown>).retired_example).toBeUndefined()
    expect(parsePlanV2(v2).ok).toBe(true)
    expect(isDeepStrictEqual(toV1(v2), legacy)).toBe(true)
  })

  it('🔴 falsified: an adapter that drops one field fails the round-trip', () => {
    const lossy = (p: Plan): PlanV2 => {
      const v = toV2(p)
      delete (v.meta as Record<string, unknown>).generator_input
      return v
    }
    const broken = plans.filter(p => !isDeepStrictEqual(toV1(lossy(p)), p)).length
    expect(broken).toBe(plans.length)
  })

  it('carries ADR-027 stamps: top level in v2, meta.engine_stamps in v1, both directions', () => {
    const stamps = { engine_version: 'v2.0.0', rules_version: 'abc123', as_of: '2026-11-21', input_hash: 'h1' }
    const v2 = { ...toV2(stored(plans[0])), stamps } as PlanV2
    const v1 = toV1(v2)
    expect((v1.meta as unknown as Record<string, unknown>).engine_stamps).toEqual(stamps)
    expect(isDeepStrictEqual(toV2(v1), v2)).toBe(true)
    expect(parsePlanV2(v2).ok).toBe(true)
    // An unstamped v1 plan gets no `stamps` key, not a null one.
    expect('stamps' in toV2(plans[0])).toBe(false)
  })

  it('is pure: neither direction mutates its input', () => {
    const p = stored(plans[0])
    const before = JSON.stringify(p)
    const v2 = toV2(p)
    toV1(v2)
    expect(JSON.stringify(p)).toBe(before)
    expect(isPlanV2(v2)).toBe(true)
    expect(isPlanV2(p)).toBe(false)
  })
})
