// ADR027-B3-CATALOGUE (B3 step 1) — the rule catalogue is complete, well-formed and traceable.
//
// 🔑 THE POPULATION IS READ FROM THE CHECKERS, never listed here: `INVARIANT_CODES` for validatePlan,
// and every `code: 'S-…'` the strength validator can push. A rule with no check, or a check with no
// rule, fails the build, so the next invariant added to the old engine cannot skip the catalogue.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { RULES, rulesSkippedBy } from './rules'
import { RuleSchema, resolveRuleConfigKey } from '@/lib/engine/contracts/rule'
import { INVARIANT_CODES, RESHAPE_SKIP_INVARIANTS } from '@/lib/plan/invariants'

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')
const STRENGTH_CODES = Array.from(new Set(
  Array.from(read('packages/strength/validate.ts').matchAll(/code:\s*'(S-[A-Z0-9-]+)'/g), m => m[1])))
const COACHING = read('docs/canonical/CoachingPrinciples.md')
const STRENGTH = read('docs/canonical/StrengthPrinciples.md')
const REGISTRY = read('docs/canonical/plan-invariants.md')

const LINES = COACHING.split('\n')
const sectionLines = (n: string) => {
  const start = LINES.findIndex(l => new RegExp(`^## (${n}\\.|§${n}) `).test(l))
  if (start < 0) return []
  const end = LINES.findIndex((l, i) => i > start && /^## (\d+[a-z]?\.|§\d+[a-z]?) /.test(l))
  return LINES.slice(start, end < 0 ? undefined : end)
}
/** `§n Am. k` resolves when a heading names it, or an `Amendment k` heading sits inside §n. */
const amendmentExists = (n: string, k: string) =>
  LINES.some(l => l.startsWith('#') && new RegExp(`§${n}\\s+(Amendment|Am\\.)\\s+${k}\\b`).test(l))
  // …unless the heading is LABELLED as another section's (`### §5 Amendment 1` nested under §52 is §5's).
  // A title that merely cites a section ("§52 prevails…") is still §n's amendment.
  || sectionLines(n).some(l => new RegExp(`^#+ .*\\bAmendment ${k}\\b`).test(l)
       && !(/^#+ §(\d+[a-z]?) /.exec(l) && /^#+ §(\d+[a-z]?) /.exec(l)![1] !== n))

/** 🔻 DEBT, measured 2026-11-21: amendment references the registry cites that cannot be traced to a
 *  heading. Three are filed under another section; three are not in CoachingPrinciples.md at all
 *  (§39 Am. 1, §44 Am. 3, §66 Am. 1). Resolved per rule when its predicate is ported (B3 step 2).
 *  An entry that starts resolving fails as stale, and a new miss fails as new. */
const UNTRACED_AMENDMENTS = [
  'INV-PLAN-EFFORT-GOVERNED-NO-INVENTED-BAND → §40b Am. 4',
  'INV-PLAN-LR-RACE-SEGMENT-PCT → §25 Am. 1',
  'INV-PLAN-LONG-RUN-HAS-AN-AXIS → §66 Am. 1',
  'INV-PLAN-NO-RACE-EVE-SESSION → §39 Am. 1',
  'INV-PLAN-GOAL-PAST-CV-DECLARED → §44 Am. 2',
  'INV-PLAN-GOAL-BELOW-EASY-DECLARED → §44 Am. 3',
]

/** The MAIN registry row: the code cell is exactly the code; one rule has only an "(extended)" row. */
const mainRow = (id: string) =>
  new RegExp('^\\| `' + id + '` \\| ([^|]*) \\| ([^|]*) \\| ([^\\n]*)$', 'm').exec(REGISTRY)
  ?? new RegExp('^\\| `' + id + '` \\([^)]*\\) \\| ([^|]*) \\| ([^|]*) \\| ([^\\n]*)$', 'm').exec(REGISTRY)

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
        const adr = /^ADR-(\d{3})$/.exec(ref)
        if (adr) expect(readdirSync(join(process.cwd(), 'docs/architecture')).some(f => f.startsWith(`ADR-${adr[1]}-`)), `${r.id} → ${ref}`).toBe(true)
      }
    }
  })

  it('🔴 every amendment reference resolves, apart from the named debt', () => {
    const untraced: string[] = []
    for (const r of RULES) for (const ref of [r.principle_ref, ...(r.related_refs ?? [])]) {
      const a = /^§(\d+[a-z]?) Am\. (\d+[a-z]?)$/.exec(ref)
      if (a && !amendmentExists(a[1], a[2])) untraced.push(`${r.id} → ${ref}`)
    }
    expect(untraced.sort()).toEqual([...UNTRACED_AMENDMENTS].sort())
  })

  it('every config key exists in the config it names', () => {
    for (const r of RULES) expect(resolveRuleConfigKey(r), `${r.id} → ${r.config_key?.key}`).toBe(true)
  })

  it('🔴 no INV rule claims a config key before its predicate is ported (code review 2026-11-21)', () => {
    // The registry's prose is not a reliable source for which tunable a check reads. Step 2 sets each
    // key from the check's own code; until then a key here would be an unverified claim.
    expect(RULES.filter(r => r.id.startsWith('INV-') && r.config_key).map(r => r.id)).toEqual([])
  })

  it('a strength reference names a section only, never an amendment (none is checked against S headings)', () => {
    for (const r of RULES.filter(x => x.id.startsWith('S-'))) expect(r.principle_ref, r.id).toMatch(/^S\d+$/)
  })

  it('only the named structural rules trace to no principle', () => {
    expect(RULES.filter(r => r.principle_ref === 'structural').map(r => r.id).sort()).toEqual([...STRUCTURAL].sort())
  })

  it('🔴 an INV rule\'s kind agrees with the registry\'s severity (error = hard, warn = soft)', () => {
    for (const r of RULES.filter(x => x.id.startsWith('INV-'))) {
      const row = mainRow(r.id)
      expect(row, `${r.id} has no main registry row`).not.toBeNull()
      const sev = row![2].replace(/[*`]/g, '').trim().toLowerCase()
      expect(sev, `${r.id}: a severity that is neither error nor warn`).toMatch(/^(error|warn)/)
      expect(r.kind, `${r.id}: registry says "${sev}"`).toBe(sev.startsWith('warn') ? 'soft' : 'hard')
      // A conditional severity must carry its condition, or it is lost when the predicate is ported.
      expect(!!r.severity_note, `${r.id}: severity "${sev}"`).toBe(!/^(error|warn)$/.test(sev))
    }
  })

  it('🔴 `skipped_by: stored` is the ONE list, and both checkers read it (VERIFIER-RESHAPE-POLICY-01)', () => {
    // 🔑 THE POINT OF THE FIELD IS THAT THERE IS NO SECOND LIST. `lib/plan/invariants.ts`'s
    // `RESHAPE_SKIP_INVARIANTS` is `rulesSkippedBy('stored')` and the verifier's `rulesFor` filters by
    // the same call, so the old checker and the verifier cannot come to disagree about what the audit
    // path asks. They already had, for a day: the verifier's first live shadow run reported 8 plans
    // gaining a code and 6 of them were these two rules, which the baseline drops on purpose.
    //
    // ⚠️ This asserts the CONTENT, not just the wiring. A derived export is identical to its source by
    // construction, so comparing them proves nothing on its own — what it would miss is somebody adding
    // a third rule to the field by accident, which is why the expected ids are written out here, and
    // why a rule joining the set has to come past this line and say why.
    expect(Array.from(rulesSkippedBy('stored')).sort()).toEqual([
      'INV-PLAN-COVERS-RACE-DATE',   // §76: does the plan reach race day — a whole-plan layout property
      'INV-PLAN-RACE-ON-RACE-DAY',   // §77: is the race on race day — likewise, fixed at generation
    ])
    expect(Array.from(RESHAPE_SKIP_INVARIANTS).sort(), 'the old checker reads the same list, not a copy')
      .toEqual(Array.from(rulesSkippedBy('stored')).sort())
    // And every marked rule is a PLAN-WIDE or WEEK-LAYOUT property, which is the reason the set exists:
    // a reshape moves sessions within a week and cannot change either.
    for (const id of Array.from(rulesSkippedBy('stored'))) {
      const r = RULES.find(x => x.id === id)!
      expect(['week', 'session', 'plan'], `${id}: scope ${r.scope}`).toContain(r.scope)
    }
  })
})
