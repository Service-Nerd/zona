// ADR027-B3-VERIFIER — the verifier shares only what the HLD allows with the planner.
//
// HLD § Verifier independence: "Two kinds of shared code are allowed: the rule data and the metrics
// owner ... Predicates are never shared with construction logic." If the verifier reused a planner
// derivation (the floors, the level, the week builder), a bug there would be invisible to both: the
// plyo-dose case. This walks every non-test file under lib/engine/verifier and refuses any import
// outside the list.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
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

const sources = () => readdirSync(DIR).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'))

describe('ADR027-B3-VERIFIER — independence', () => {
  it('there is verifier source to check', () => expect(sources().length).toBeGreaterThan(0))

  it('🔴 every verifier import is on the allowed list (never validatePlan, never a planner derivation)', () => {
    const bad: string[] = []
    for (const f of sources()) {
      const src = readFileSync(join(DIR, f), 'utf8')
      for (const m of Array.from(src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm))) {
        const spec = m[1]
        if (spec.startsWith('./')) continue          // another verifier file, itself checked here
        if (!ALLOWED.has(spec)) bad.push(`${f}: ${spec}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('every ported rule is in the catalogue, so its severity comes from there', () => {
    const ids = new Set(RULES.map(r => r.id))
    expect(PORTED_RULES.filter(r => !ids.has(r))).toEqual([])
  })
})
