// ADR027-B3-VERIFIER — the verifier shares only what the HLD allows with the planner.
//
// HLD § Verifier independence: "Two kinds of shared code are allowed: the rule data and the metrics
// owner ... Predicates are never shared with construction logic." If the verifier reused a planner
// derivation (the floors, the level, the week builder), a bug there would be invisible to both: the
// plyo-dose case. This walks every non-test file under lib/engine/verifier and refuses any import
// outside the list.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { PORTED_RULES } from './verifyPlan'
import { RULES } from '@/lib/engine/catalogue/rules'

const DIR = join(process.cwd(), 'lib/engine/verifier')
const ALLOWED = new Set([
  '@/types/plan',                        // types only
  '@/lib/engine/contracts/rule',         // the rule contract
  '@/lib/engine/catalogue/rules',        // rule data
  '@/lib/plan/generationConfig',         // rule data (the numerics the rules reference)
  '@/lib/plan/sessionRole',              // the classification owner (INV-CLASS), fixture-tested
  '@/lib/plan/sessionDistance',          // the measurement owner (`sessionKm`), fixture-tested
])

/** Every non-test source file under the verifier, recursively. */
function sources(dir = DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? sources(join(dir, e.name))
      : e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [join(dir, e.name)] : [])
}

/** Every module specifier a file pulls in: static and type imports, re-exports, dynamic import, require. */
const specifiers = (src: string) => [
  ...Array.from(src.matchAll(/^\s*(?:import|export)\b[^'"]*?\bfrom\s*['"]([^'"]+)['"]/gm), m => m[1]),
  ...Array.from(src.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm), m => m[1]),
  ...Array.from(src.matchAll(/\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]/g), m => m[1]),
]

describe('ADR027-B3-VERIFIER — independence', () => {
  it('there is verifier source to check', () => expect(sources().length).toBeGreaterThan(0))

  it('🔴 every verifier import is on the allowed list (never validatePlan, never a planner derivation)', () => {
    const bad: string[] = []
    for (const f of sources()) {
      for (const spec of specifiers(readFileSync(f, 'utf8'))) {
        // A relative import must stay inside the verifier, where it is itself checked.
        if (spec.startsWith('.')) { if (!resolve(dirname(f), spec).startsWith(DIR)) bad.push(`${f}: ${spec}`); continue }
        if (!ALLOWED.has(spec)) bad.push(`${f}: ${spec}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('the specifier scan sees every form it must (falsified on a fixture string)', () => {
    const fx = [
      "import { a } from '@/lib/plan/invariants'", "import type { B } from '@/x'", "export { c } from '@/y'",
      "const d = await import('@/z')", "const e = require('@/w')", "import '@/side-effect'",
    ].join('\n')
    expect(specifiers(fx).sort()).toEqual(['@/lib/plan/invariants', '@/side-effect', '@/w', '@/x', '@/y', '@/z'])
  })

  it('every ported rule is in the catalogue, so its severity comes from there', () => {
    const ids = new Set(RULES.map(r => r.id))
    expect(PORTED_RULES.filter(r => !ids.has(r))).toEqual([])
  })
})
