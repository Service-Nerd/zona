import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PORTED_RULES } from './verifyPlan'
import { RULES } from '@/lib/engine/catalogue/rules'

/**
 * HELD-RULE-LIST-DERIVED-01 — the 14 held rules the cut-over sign-off must name are PROSE in ADR-027
 * beside a list derivable from code. This holds the two together.
 *
 * ── WHY IT EXISTS ────────────────────────────────────────────────────────────────────────────────
 * B3's exit is *"the cut-over gate is the verifier PLUS these 14 old checks, named in the founder's
 * sign-off"* (Coaching Board `ADR027-B3-RAISED-LIST-01`, E4). That makes ADR-027's paragraph the one
 * document a founder decision is read from — and it is hand-written, while the same set falls out of
 * `RULES` minus `PORTED_RULES`. **Every rule B3 ports shrinks the derived set and leaves the prose
 * untouched**, so the two drift in one direction, silently, and the sign-off is where it would land.
 * Two registers with a human in between, on the worst possible document.
 *
 * 📐 Re-derived when this was written (2026-11-25/26): the two agree exactly, **14 for 14, name for
 * name**. So this buys a ratchet, not a fix — which is the honest description of it.
 *
 * ── WHAT THIS DOES NOT COVER, stated rather than discovered later ────────────────────────────────
 * ⚠️ **INV rules only.** The 50 strength rules are ported in `verifyStrength.ts`, which does not
 * contribute to `PORTED_RULES`, so subtracting one from the other would report all 50 as held. They
 * are excluded by prefix, and an unported STRENGTH rule is therefore outside this gate's population.
 * `verifierStrength.test.ts` is where that one is held.
 */

const ADR = join(process.cwd(), 'docs/architecture/ADR-027-coaching-engine-service.md')

/** The held set, from code: every catalogued INV rule with no predicate in the verifier. */
function derivedHeld(): string[] {
  const ported = new Set<string>(PORTED_RULES as unknown as string[])
  return RULES.filter(r => r.id.startsWith('INV-') && !ported.has(r.id)).map(r => r.id).sort()
}

/**
 * The held set, from ADR-027's prose.
 *
 * 🔴 THE REGION IS BOUNDED, NEVER GREPPED, AND THAT IS NOT A PRECAUTION — IT IS THE MEASURED DEFECT.
 * The paragraph is followed by sentences that repeat five of the same ids in backticks
 * (`STAGED-DOOR-RATIO`, `INJURY-NO-HILLS`, `RACE-WEEK-SHARPENING`, `RACE-SPECIFIC-LONG-RUN`) plus one
 * that is NOT held (`ZONE-LABEL-HAS-PRESCRIPTION`, which is ported but dead in production). A grep
 * over the section returned **16** when the answer is 14. CLAUDE.md's rule, verbatim: *bound the
 * region, never grep the file* — and when the thing being matched is a NAME, anchor it.
 *
 * ⚠️ RETURNS null RATHER THAN AN EMPTY LIST when it cannot find the region. An empty list would
 * compare as "the ADR names nothing" and still fail, but it would fail with the wrong reason — and
 * absence written as a value is the class this repo keeps paying for.
 */
function adrHeld(src: string): { names: string[]; stated: number } | null {
  // The list proper: after the ruling reference, up to the "(all `INV-PLAN-*`)" qualifier.
  const region = /E3–E4\):([\s\S]*?)\(all\s+`INV-PLAN-\*`\)/.exec(src)
  const heading = /The (\d+) rules the verifier does not yet check itself/.exec(src)
  if (!region || !heading) return null
  const names = Array.from(region[1].matchAll(/`([A-Z][A-Z0-9-]+)`/g), m => `INV-PLAN-${m[1]}`).sort()
  return { names, stated: Number(heading[1]) }
}

describe('HELD-RULE-LIST-DERIVED-01 — ADR-027\'s held-rule list is the derived one', () => {
  const src = readFileSync(ADR, 'utf8')

  it('🔴 the ADR\'s paragraph is parseable at all, or this gate proves nothing', () => {
    // Unverified is never a pass: if the paragraph is rewritten and the delimiters move, this fails
    // HERE with the reason, rather than comparing against an empty list and blaming the content.
    expect(adrHeld(src), 'ADR-027\'s held-rule list or its stated count could not be found').not.toBeNull()
  })

  it('🔴 every rule ADR-027 names as held IS held, and every held rule IS named — both directions', () => {
    const adr = adrHeld(src)!
    const derived = derivedHeld()
    // Asserted as NAMES, not as a count. ⚠️ A port landing at the same time as a new hold nets to the
    // same number, so a count check would pass on a list that is wrong twice over.
    expect(adr.names.filter(n => !derived.includes(n)),
      'ADR-027 names these as held, but the verifier has a predicate for them — the list is stale, delete them')
      .toEqual([])
    expect(derived.filter(n => !adr.names.includes(n)),
      'these rules have no verifier predicate and ADR-027 does not name them — the sign-off would be incomplete')
      .toEqual([])
  })

  it('🔴 and the number in the heading is the derived count, so a half-edited paragraph fails', () => {
    // The paragraph states its own count ("The 14 rules…"). Someone editing the list and not the
    // number leaves the sentence false while the list is right, and the sign-off is read as prose.
    const adr = adrHeld(src)!
    expect(adr.stated, `the heading says ${adr.stated}; the verifier holds ${derivedHeld().length}`)
      .toBe(derivedHeld().length)
    expect(adr.names.length, 'the heading\'s number and the list\'s length disagree').toBe(adr.stated)
  })

  it('the derived set excludes strength rules by prefix, and that limit is real', () => {
    // Not decoration: without the prefix filter the derived set would be 64, because `verifyStrength.ts`
    // does not contribute to `PORTED_RULES`. This pins the exclusion so the limit stays visible.
    const strength = RULES.filter(r => r.id.startsWith('S-')).map(r => r.id)
    expect(strength.length).toBeGreaterThan(0)
    expect(derivedHeld().filter(id => strength.includes(id)), 'a strength rule leaked into the held set').toEqual([])
  })
})
