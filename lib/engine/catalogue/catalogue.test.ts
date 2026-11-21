// ADR027-B3-CATALOGUE (B3 step 1) — the rule catalogue is complete, well-formed and traceable.
//
// 🔑 THE POPULATION IS READ FROM THE CHECKERS, never listed here: `INVARIANT_CODES` for validatePlan,
// and every `code: 'S-…'` the strength validator can push. A rule with no check, or a check with no
// rule, fails the build, so the next invariant added to the old engine cannot skip the catalogue.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RULES } from './rules'
import { RuleSchema, resolveRuleConfigKey } from '@/lib/engine/contracts/rule'
import { INVARIANT_CODES } from '@/lib/plan/invariants'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const STRENGTH_CODES = Array.from(new Set(
  Array.from(read('packages/strength/validate.ts').matchAll(/code:\s*'(S-[A-Z0-9-]+)'/g), m => m[1])))
const COACHING = read('docs/canonical/CoachingPrinciples.md')
const STRENGTH = read('docs/canonical/StrengthPrinciples.md')
const REGISTRY = read('docs/canonical/plan-invariants.md')

/** Rules allowed to trace to no principle and no ADR. Named, so the list cannot grow silently. */
const STRUCTURAL = ['INV-PLAN-CATALOGUE-ELIGIBLE', 'INV-PLAN-NO-PLACEHOLDER-COPY']

describe('ADR027-B3-CATALOGUE — every check has exactly one rule', () => {
  const ids = RULES.map(r => r.id)

  it('ids are unique', () => {
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('🔴 the INV rules are exactly validatePlan\'s INVARIANT_CODES', () => {
    const inv = ids.filter(i => i.startsWith('INV-')).sort()
    expect(inv).toEqual([...INVARIANT_CODES].sort())
  })

  it('🔴 the S rules are exactly the codes the strength validator can push', () => {
    expect(STRENGTH_CODES.length, 'the strength scrape found nothing').toBeGreaterThan(0)
    expect(ids.filter(i => i.startsWith('S-')).sort()).toEqual([...STRENGTH_CODES].sort())
  })
})

describe('ADR027-B3-CATALOGUE — every rule is well-formed and traceable', () => {
  it('every rule parses against the contract', () => {
    for (const r of RULES) expect(RuleSchema.safeParse(r).success, r.id).toBe(true)
  })

  it('🔴 every § and S reference names a section that exists', () => {
    for (const r of RULES) {
      for (const ref of [r.principle_ref, ...(r.related_refs ?? [])]) {
        const cp = /^§(\d+[a-z]?)/.exec(ref)
        // Two heading styles are live: `## 12. Title` and `## §121 — Title`.
        if (cp) expect(new RegExp(`^## (${cp[1]}\\.|§${cp[1]}) `, 'm').test(COACHING), `${r.id} → ${ref}`).toBe(true)
        const sp = /^(S\d+)/.exec(ref)
        if (sp) expect(new RegExp(`^## ${sp[1]}\\. `, 'm').test(STRENGTH), `${r.id} → ${ref}`).toBe(true)
      }
    }
  })

  it('every config key exists in the config it names', () => {
    for (const r of RULES) expect(resolveRuleConfigKey(r), `${r.id} → ${r.config_key?.key}`).toBe(true)
  })

  it('only the named structural rules trace to no principle', () => {
    expect(RULES.filter(r => r.principle_ref === 'structural').map(r => r.id).sort()).toEqual([...STRUCTURAL].sort())
  })

  it('🔴 an INV rule\'s kind agrees with the registry\'s severity (error = hard, warn = soft)', () => {
    for (const r of RULES.filter(x => x.id.startsWith('INV-'))) {
      // The MAIN row: the code cell is exactly the code (amendment rows carry a suffix such as "(extended)").
      // One rule (INV-PLAN-RACE-SPECIFIC-EXPOSURE) has only its "(extended)" row, so fall back to that.
      const row = new RegExp('^\\| `' + r.id + '` \\| [^|]* \\| ([^|]*) \\|', 'm').exec(REGISTRY)
        ?? new RegExp('^\\| `' + r.id + '` \\([^)]*\\) \\| [^|]* \\| ([^|]*) \\|', 'm').exec(REGISTRY)
      expect(row, `${r.id} has no main registry row`).not.toBeNull()
      const sev = row![1].replace(/[*`]/g, '').trim().toLowerCase()
      expect(r.kind, `${r.id}: registry says "${sev}"`).toBe(sev.startsWith('warn') ? 'soft' : 'hard')
    }
  })
})
