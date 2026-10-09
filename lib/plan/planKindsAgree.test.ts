import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// BASEBUILD-SCHEMA-KIND-01 (2026-10-09) — `plan_kind` is declared TWICE, in a
// type and in a Zod schema, and they must admit the same values.
//
// 🔴 They did not. `types/plan.ts` had `'race' | 'maintenance'`, `schema.ts` had
// `z.enum(['race','maintenance'])`, and `generateBaseBuildPlan` had been writing
// `'base_build'` since §116 shipped — through an `as unknown as Plan['meta']`
// cast, which is why the compiler never asked.
//
// Measured against production: `SCHEMA:meta.plan_kind` appeared on **2 of 34
// plans, and they were exactly the two base-build ones.** The canonical runtime
// schema was rejecting a plan kind the engine emits, which SCHEMA-LIVE-01 records
// and (deliberately) never throws on, so it read as fleet schema debt.
//
// ⚠️ AND I FIXED ONE SIDE FIRST. The type union was widened so
// `validateStoredPlan` could narrow on the field; the Zod twin was found only by
// measuring the audit's output afterwards. "Fix the pair, not the instance."
//
// ⚠️ A SOURCE-TEXT COMPARISON, DELIBERATELY. `z.enum` does not expose its values
// as a type this test can diff against `PlanMeta`, and `zod`'s internals are not a
// contract. Both declarations are one line each and both are parsed here, so the
// check is narrow and the failure names the file that is behind.

const read = (...p: string[]) => readFileSync(join(__dirname, ...p), 'utf8')

/** The values in `plan_kind?: 'a' | 'b'` in types/plan.ts. */
function typeUnionValues(): string[] {
  const src = read('..', '..', 'types', 'plan.ts')
  const m = src.match(/^\s*plan_kind\?:\s*(.+)$/m)
  if (!m) return []
  return Array.from(m[1]!.matchAll(/'([^']+)'/g)).map(x => x[1]!).sort()
}

/** The values in `z.enum([...])` on schema.ts's plan_kind line. */
function schemaEnumValues(): string[] {
  const src = read('schema.ts')
  const m = src.match(/^\s*plan_kind:\s*z\.enum\(\[([^\]]*)\]\)/m)
  if (!m) return []
  return Array.from(m[1]!.matchAll(/'([^']+)'/g)).map(x => x[1]!).sort()
}

describe('BASEBUILD-SCHEMA-KIND-01 — the two plan_kind declarations agree', () => {
  // The vacuity arm. An unparsed declaration returns [] on both sides and would
  // compare EQUAL — the failure mode that makes a mirror test worthless.
  it('parses both declarations at all', () => {
    expect(typeUnionValues().length, 'types/plan.ts plan_kind not parsed').toBeGreaterThan(1)
    expect(schemaEnumValues().length, 'schema.ts plan_kind z.enum not parsed').toBeGreaterThan(1)
  })

  it('admit exactly the same values', () => {
    expect(schemaEnumValues(), 'add the value to BOTH, not one').toEqual(typeUnionValues())
  })

  // 🔴 The defect, pinned by name. A future narrowing that drops `base_build`
  // from either side is the original bug, and it must not pass quietly.
  it("both admit 'base_build' — the kind the engine has emitted since §116", () => {
    expect(typeUnionValues()).toContain('base_build')
    expect(schemaEnumValues()).toContain('base_build')
  })

  // The PRODUCERS, so the population is derived rather than assumed: every literal
  // assigned to `plan_kind` anywhere under lib/ must be an admitted value.
  it('every value any producer writes is admitted by both', () => {
    const written = new Set<string>()
    for (const f of ['baseBuildOnRamp.ts', 'getRunningPlan.ts', 'maintenance.ts', 'ruleEngine.ts']) {
      let src: string
      try { src = read(f) } catch { continue }
      for (const m of Array.from(src.matchAll(/plan_kind\s*[:=]\s*'([^']+)'/g))) written.add(m[1]!)
    }
    expect(written.size, 'no plan_kind writer found — re-point this arm').toBeGreaterThan(0)
    const admitted = new Set(typeUnionValues())
    expect(Array.from(written).filter(v => !admitted.has(v)),
      'a producer writes a plan_kind neither declaration admits').toEqual([])
  })
})
