import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { RULES } from '@/lib/engine/catalogue/rules'
import { TRIGGER_RULES } from '@/lib/engine/catalogue/triggers'
import { TRIGGER_TYPES, DETECTED_TRIGGER_TYPES } from '@/lib/engine/contracts/triggers'
import { PORTED_RULES, UNVERIFIED_PREFIX } from '@/lib/engine/verifier/verifyPlan'

/**
 * `ENGINE-CONTRACT-V2-COVERAGE-01` — `docs/contracts/engine.md § v2` must still describe the v2 engine.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT AN `audit-docs.sh` ARM ───────────────────────────────────
 * 📐 **Measured 2026-11-26: `lib/engine` appears ZERO times in `scripts/audit-docs.sh`.** Every arm of
 * that script has a population — changed API routes, changed components, invariants, registry rows,
 * build-log entries, board rulings — and the v2 engine is in none of them. So `audit-docs.sh ALL CLEAN`,
 * which this project quotes on every ship and in every state block, **was silent about the entire new
 * engine by construction.** That is `CONTRACT-COVERAGE-01`'s population question one layer out.
 *
 * It lives here rather than in that script for two reasons, both measured rather than assumed:
 *  · `audit-docs.sh` is **diff-based** — it asks "did a changed route gain a contract?" — and the engine
 *    is not routed, so there is no diff to hang it on.
 *  · A gate in the suite runs in the **pre-push hook AND `verify:ci`**, both of which are read. This repo
 *    has recorded four times that a check depending on someone remembering is a check that does not run.
 *
 * 🔑 **AND WRITING THE CONTRACT WAS A CODE REVIEW, as it has been every time.** Three findings, all in
 * code or records the contract had to describe accurately:
 *  1. `UNVERIFIED_PREFIX` was **two independent literals** — a template literal in `verifyPlan` and a
 *     `startsWith('unverified:')` in `verifierShadow`, with no gate. Rewording it would have made the
 *     nightly run report **0 unverified** for ever, on the metric the cut-over rests on.
 *  2. `§ v2` asserted *"`Rule` and `Decision` have no producer"*. `Rule` gained one at B3 step 1 — 221 rows,
 *     read by L5. **A contract asserting a filled absence is exactly what a records audit cannot see.**
 *  3. ADR-027's *"207 of 221 ported"* is a **sum over two modules** (157 `INV-` + 50 `S-`), and
 *     `PORTED_RULES` is 159 (2026-11-27). Reasoning from that constant against the 221 denominator gives 62 held, not 12.
 *
 * 🔻 WHAT IT DOES NOT CHECK, stated rather than discovered later. It proves the contract MENTIONS each
 * module and that the NUMBERS it publishes are the live ones. **It cannot prove a section is correct** —
 * prose about a mechanism is not the mechanism, and `audit-docs.sh`'s own limit note says the same thing
 * about registry rows. The arms below are chosen as the subset that is mechanically decidable.
 */

/** Source with `//` line comments blanked, line numbers preserved. See the comment at the one call site:
 *  a check for a hardcoded string must not match the comment recording it. Deliberately simple — block
 *  comments and strings are not lexed, and the two call sites below are both `startsWith(` / backtick
 *  patterns that no block comment in either file contains. `scripts/lib/strip-comments.py` is the full
 *  version and its own suite documents why a general one needs a parser. */
const code = (src: string) => src.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

const DOC = readFileSync(join(process.cwd(), 'docs/contracts/engine.md'), 'utf8')
const V2 = DOC.slice(DOC.indexOf('## v2: the engine as a service'))

/** Every shipped module under `lib/engine`, walked — never a hand-written list, because a hand-written
 *  list was the finding. */
function engineModules(dir = join(process.cwd(), 'lib/engine'), acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) engineModules(p, acc)
    else if (/\.ts$/.test(e) && !/\.test\.ts$/.test(e)) acc.push(relative(process.cwd(), p))
  }
  return acc
}

/**
 * Modules the contract does not name, with a reason each. **The ratchet: it may shrink, never grow.**
 *
 * 🥇 **IT IS EMPTY, AND THAT IS WHAT PAYING IT DOWN LOOKED LIKE** — 7 of 20 were unnamed when this gate
 * was written (`catalogue/triggers.ts`, `contracts/events.ts`, `contracts/runOutcome.ts`,
 * `contracts/triggers.ts`, and **all three of L5**: `verifier/formulas.ts`, `verifier/verifyPlan.ts`,
 * `verifier/verifyStrength.ts`). The L5 half was the one that mattered: B3's exit asks the founder to sign
 * off the verifier replacing `validatePlan`, and the verifier had no written interface at all.
 */
const UNCONTRACTED_ENGINE_MODULES: Record<string, string> = {}

describe('ENGINE-CONTRACT-V2-COVERAGE-01 — every engine module is in the contract', () => {
  const modules = engineModules()

  it('🔴 the population is derived from the tree and is not empty', () => {
    // `CLEAN — 0 files` was a real answer this repo shipped once. A gate over nothing passes every rule.
    expect(modules.length, 'no modules found — the walker broke and every arm below is blind').toBeGreaterThan(15)
    expect(modules.every(m => m.startsWith('lib/engine/'))).toBe(true)
  })

  it('🔴 every module is named in docs/contracts/engine.md, or declared with a reason', () => {
    // ⚠️ FULL PATH, never the basename. The first cut matched `m.split('/').pop()`, so
    // `catalogue/triggers.ts` was satisfied by `contracts/triggers.ts` sharing a filename — erasing every
    // mention of the former reported `missing: []`. **This is `AUDIT-CONTRACT-MENTION-01`'s prefix bug,
    // cited four lines up in this very file, reproduced.** Found by code review, mutation-verified.
    const missing = modules.filter(m => !DOC.includes(m) && !(m in UNCONTRACTED_ENGINE_MODULES))
    expect(
      missing,
      `These lib/engine modules are in no contract. Write them into docs/contracts/engine.md § v2, or ` +
      `declare each in UNCONTRACTED_ENGINE_MODULES with a reason: ${missing.join(', ')}`,
    ).toEqual([])
  })

  it('the declared list does not go stale', () => {
    // A module that has since gained a contract must leave the list, or the list becomes a place to hide
    // new debt. Same discipline as `configPrincipleSync`'s stale-debt arm, which caught its own dead entry.
    const resolved = Object.keys(UNCONTRACTED_ENGINE_MODULES).filter(m => DOC.includes(m))
    expect(resolved, `now contracted — remove from UNCONTRACTED_ENGINE_MODULES: ${resolved.join(', ')}`).toEqual([])
  })
})

describe('ENGINE-CONTRACT-V2-COVERAGE-01 — the numbers it publishes are the live ones', () => {
  // ⚠️ A number in a doc drifts; a number a script checks does not. Each of these is a figure § v2 states
  // in prose, bound to the code it describes. Where a number is a DECOMPOSITION, every part is bound —
  // `207 of 221` was true only as a sum and nothing said so.
  const inv = RULES.filter(r => r.id.startsWith('INV-'))
  const strength = RULES.filter(r => r.id.startsWith('S-'))

  it('🔴 221 = 171 INV + 50 S, and PORTED_RULES is 159 of the INV family', () => {
    expect(RULES.length).toBe(221)
    expect(inv.length).toBe(171)
    expect(strength.length).toBe(50)
    // ⚠️ 157 → 159 on 2026-11-27: `DELIVERED-RAMP` and `TAPER-DELIVERED-DEPTH` left the held list
    // once their stated reason was re-derived (both "planner" helpers are `invariants.ts`'s own).
    // This number is PINNED on purpose — every port must come past this arm and the contract
    // together, so the published figure cannot drift from the code.
    expect(PORTED_RULES.length).toBe(159)
    expect(PORTED_RULES.filter(r => r.startsWith('S-')), 'no strength rule is in PORTED_RULES').toEqual([])
    // The held count the cut-over sign-off names, derived rather than typed.
    expect(inv.length - PORTED_RULES.length).toBe(12)
    // ⚠️ IN CONTEXT, not as bare digits. Code review mutation-verified that 2 of 5 were vacuous: `'50'`
    // matched the pre-existing `engine fault | 500` row and `'14'` matched `ARCH-ENG-013/014/019` and a
    // `**144**` cell — so **the 14-held figure the cut-over sign-off names was bound to nothing.**
    expect(V2, 'the catalogue total').toMatch(/\*\*221 entries\*\*/)
    expect(V2, 'the INV/S decomposition').toMatch(/221 = 171 `INV-` \+ 50 `S-`/)
    expect(V2, 'the ported count with its family').toMatch(/`PORTED_RULES` is 159, all `INV-`/)
    expect(V2, 'the 12 held rules, as a derivation not a bare number').toMatch(/12 are HELD/)
    expect(V2, 'and where the 12 comes from').toMatch(/171 . 159/)
  })

  it('🔴 the contract names the family with the number, so 207/221 cannot be misread', () => {
    // The whole point of the finding: `PORTED_RULES` against the 221 denominator gives 64 held, not 14.
    expect(V2).toMatch(/159 of 171/)
    expect(V2, 'the sum-over-two-modules reading must be stated').toMatch(/sum over both modules|SUM OVER BOTH MODULES/i)
  })

  it('🔴 ten trigger types, eight detected — the count the product may claim', () => {
    // `ADJUST-TRIGGER-MANUAL-DEAD-01`: a dead union member became a marketing claim. The honest number is 8.
    expect(TRIGGER_TYPES.length).toBe(10)
    expect(DETECTED_TRIGGER_TYPES.length).toBe(8)
    expect(TRIGGER_RULES.length).toBe(TRIGGER_TYPES.length)
    expect(V2).toMatch(/eight of which we DETECT|eight, not 10|8, not 10/)
  })

  it('names the three VerifierPolicy values and that the argument is required', () => {
    for (const v of ["'saved'", "'stored'", "'repaired'"]) expect(V2).toContain(v)
    expect(V2, 'a default would silently make a caller lenient').toMatch(/required and with no\s*\n?\s*default|required and without a default/)
  })
})

describe('ENGINE-CONTRACT-V2-COVERAGE-01 — the unverified contract, end to end', () => {
  it('🔴 one owner for the prefix, and the consumer classifies on IT', () => {
    expect(UNVERIFIED_PREFIX).toBe('unverified: ')
    // 🔴 The arm that would have caught the original defect: `verifierShadow` must not hold its own
    // string. It did — `startsWith('unverified:')` — and nothing bound the two.
    const shadow = readFileSync(join(process.cwd(), 'lib/ops/verifierShadow.ts'), 'utf8')
    // ⚠️ COMMENTS STRIPPED, and the first cut did not: it went red on the comment that RECORDS the old
    // literal, two lines above the fixed call. **Searching for the hardcoded thing finds the comment about
    // the hardcoded thing** — `HOOK-RGBA-COMMENTS-01`, which this repo has now paid for in the commit
    // hook, the colour sweep and here. A code-vs-prose check must read code.
    const ownCopies = Array.from(code(shadow).matchAll(/startsWith\(\s*['"`]unverified/g))
    expect(ownCopies.map(m => m[0]), 'verifierShadow must use isUnverified, not its own literal').toEqual([])
    // 🔴 STRIPPED, AND IT WAS NOT. This arm read RAW source while its sibling two lines up stripped
    // comments — and `verifierShadow.ts`'s comment about the old literal contains the word
    // `isUnverified`. Code review mutation-verified it: **drop the import, re-spell the predicate as a
    // `slice(0, 12)` compare, and both arms stayed green** — the single-owner fix this file exists to
    // protect was revertible without the gate noticing. `HOOK-RGBA-COMMENTS-01` from the other side:
    // the first arm found the comment about the defect, this one was SATISFIED by it.
    const shadowCode = code(shadow)
    expect(shadowCode, 'must import the owner, in code and not in a comment').toMatch(/import \{[^}]*\bisUnverified\b[^}]*\} from '@\/lib\/engine\/verifier\/verifyPlan'/)
    expect(shadowCode, 'and must actually CALL it').toMatch(/filter\(isUnverified\)/)
    // And the producer must build the detail FROM the constant rather than retyping it.
    const verifier = readFileSync(join(process.cwd(), 'lib/engine/verifier/verifyPlan.ts'), 'utf8')
    expect(verifier).toMatch(/\$\{UNVERIFIED_PREFIX\}/)
    expect(Array.from(code(verifier).matchAll(/`unverified: \$\{/g)), 'producer retyped the prefix').toEqual([])
  })

  it('the contract states that an unverified finding is never a silent pass', () => {
    expect(V2).toMatch(/NEVER A SILENT\s*\n?\s*PASS|never a silent pass/i)
    expect(V2).toContain('UNVERIFIED_PREFIX')
  })
})

describe('ENGINE-CONTRACT-V2-COVERAGE-01 — L2 and L5 exist as sections, not mentions', () => {
  it('🔴 each layer has its own heading, because a passing mention is what the old arm accepted', () => {
    // `AUDIT-CONTRACT-MENTION-01`: `grep -F` over a directory made a prose mention count as a contract,
    // and a route whose path was a PREFIX of a longer one was always "contracted". Headings, not mentions.
    expect(V2).toMatch(/^### L2: /m)
    expect(V2).toMatch(/^### L5: /m)
    expect(V2).toMatch(/^### L1: /m)
  })

  it('both new sections state what they do NOT prove', () => {
    // Every completion claim carries its negative space (CLAUDE.md). A contract is a completion claim.
    // ⚠️ BOTH SLICES ARE BOUNDED. `l5` ran to the end of the document, so `/does not prove/i` bound to
    // the pre-existing `### What § v2 does not prove` heading and deleting L5's own negative-space
    // paragraph left it green (code review, mutation-verified). **Bound the region, never grep the file**
    // — the same correction `heldRules.test.ts` and the design guards each needed.
    const l2 = V2.slice(V2.indexOf('### L2: '), V2.indexOf('### L5: '))
    const l5 = V2.slice(V2.indexOf('### L5: '), V2.indexOf('### What stays outside the service'))
    expect(l5.length, 'the L5 slice is empty or unbounded — this arm is blind').toBeGreaterThan(400)
    expect(l2, 'L2 must say nothing evaluates the trigger catalogue').toMatch(/Nothing evaluates it|NOTHING EMITS/i)
    expect(l5, 'L5 must say what it does not prove').toMatch(/does not prove/i)
  })
})
