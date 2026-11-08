import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PlanMetaSchema } from './schema'

/**
 * 🔴 TWO ENRICHMENT VALUES WERE IN THE ZOD ENUM AND IN PRODUCTION ROWS AND NOT IN THE
 * TYPESCRIPT UNION, one of them for a month (code review, 2026-11-08).
 *
 * `skipped_plan_kind` has been written by `stagedRacePlan.ts`, `getRunningPlan.ts` and the
 * staged producer since 2026-10-10. `skipped_rebuild` arrived with
 * `REBUILD-STAMP-ENRICHMENT-01`. The schema accepted both, the database holds both, and
 * `EnrichmentStatus` said neither existed.
 *
 * 🔑 WHAT VIOLATION CLASS THIS FINDS, and it is not hypothetical: a consumer writing
 * `plan.meta.enrichment === 'skipped_plan_kind'` fails `tsc` against a value that is LIVE, and
 * an exhaustive `switch` quietly has no arm for it. It is also what forced five
 * `as never as { meta: Record<string, unknown> }` casts at the stamp call sites — a type that
 * understates reality does not stop the write, it just removes the compiler from the
 * conversation. **The absence seam, in a type.**
 *
 * ⚠️ BOTH DIRECTIONS. A union member with no schema entry is the opposite defect: a value the
 * code may construct and the parser will REFUSE, so a plan carrying it fails to validate.
 *
 * ⚠️ WHAT IT DOES NOT PROVE: that any producer writes a sensible value, or that a reader
 * handles every case. `enrichHealth.test.ts` owns the eligibility semantics.
 */
const TYPES = join(process.cwd(), 'types/plan.ts')

/** The `EnrichmentStatus` union's members, bounded to the declaration — never grepped from
 *  the whole file, which would also collect the schema's own strings and every comment.
 *  `bound the region, never grep the file`. */
function unionMembers(): string[] {
  const src = readFileSync(TYPES, 'utf8')
  const at = src.indexOf('export type EnrichmentStatus =')
  expect(at, 'the EnrichmentStatus declaration must exist').toBeGreaterThan(-1)
  // The declaration ends at the first blank line followed by a non-continuation line.
  const rest = src.slice(at)
  const end = rest.search(/\n\s*\n(?!\s*(\||\/\/))/)
  const decl = end < 0 ? rest : rest.slice(0, end)
  // Comment lines inside the union carry quoted value names (this file's own explanation
  // does), so strip them before collecting. HOOK-RGBA-COMMENTS-01, in a type declaration.
  const code = decl.replace(/\/\/[^\n]*/g, '')
  return Array.from(code.matchAll(/\|\s*'([^']+)'/g)).map(m => m[1]!)
}

/** The schema's enum options, read from the live Zod object rather than from its source. */
function schemaOptions(): string[] {
  const field = (PlanMetaSchema.shape as Record<string, { unwrap?: () => { options?: string[] } }>).enrichment
  const inner = field?.unwrap?.()
  const opts = inner?.options
  expect(Array.isArray(opts), 'PlanMetaSchema.enrichment must be an optional z.enum').toBe(true)
  return opts as string[]
}

describe('EnrichmentStatus and the plan schema agree', () => {
  it('population: both lists are non-empty and sized like each other', () => {
    // An empty list renders as "no disagreement" — the shape every gate in this repo has
    // failed on at least once.
    expect(unionMembers().length).toBeGreaterThan(8)
    expect(schemaOptions().length).toBeGreaterThan(8)
  })

  it('🔴 every value the SCHEMA accepts is in the union — the direction that was broken', () => {
    const missing = schemaOptions().filter(o => !unionMembers().includes(o))
    expect(
      missing,
      'These values parse and reach production rows while `EnrichmentStatus` denies they '
      + 'exist, so a consumer comparing against one fails tsc and an exhaustive switch has '
      + `no arm for it. Add them to types/plan.ts: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('…and every union member is a value the schema accepts', () => {
    const unparseable = unionMembers().filter(m => !schemaOptions().includes(m))
    expect(
      unparseable,
      'The type permits a value the parser REFUSES, so a plan carrying it fails to validate: '
      + unparseable.join(', '),
    ).toEqual([])
  })

  it('the two values the review found are both present', () => {
    for (const v of ['skipped_plan_kind', 'skipped_rebuild']) {
      expect(unionMembers(), `${v} in the union`).toContain(v)
      expect(schemaOptions(), `${v} in the schema`).toContain(v)
    }
  })
})
