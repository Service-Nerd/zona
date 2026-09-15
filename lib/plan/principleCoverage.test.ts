import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PRINCIPLE_COVERAGE, UNVERIFIED_BASELINE } from './principleCoverage'
import { INVARIANT_CODES } from './invariants'

/**
 * THE COVERAGE GATE — every coaching principle is accounted for, or the build
 * fails.
 *
 * The problem this closes: `CoachingPrinciples.md` states 106 rules and nothing
 * failed when one was written and never checked. §79's re-entry window was
 * unenforced for a month while the engine did the opposite of what it said,
 * with a green suite the whole time. The commit hook that mandates "principle +
 * numeric + invariant, one commit" (INV-COACH-002) could not catch it, because
 * a hook sees the DIFF and a rule written in March is never in a diff again.
 *
 * This runs over ALL 106 on every build, touched or not.
 */
const PRINCIPLES_MD = join(process.cwd(), 'docs', 'canonical', 'CoachingPrinciples.md')

/** Section numbers actually present in the constitution. */
function principlesInDoc(): number[] {
  const src = readFileSync(PRINCIPLES_MD, 'utf8')
  return Array.from(src.matchAll(/^## (\d+)\. /gm)).map(m => Number(m[1])).sort((a, b) => a - b)
}

describe('principle coverage — every rule is enforced, tested, exempt, or openly unverified', () => {
  const doc = principlesInDoc()
  const manifest = new Map(PRINCIPLE_COVERAGE.map(e => [e.n, e]))

  it('every principle in the constitution has a manifest entry', () => {
    // THE LOAD-BEARING ASSERTION. Add §110 without classifying it and this goes
    // red — which is the whole point: the author decides how it is checked at
    // the moment they write it, not "later" when nobody is looking.
    const missing = doc.filter(n => !manifest.has(n))
    expect(
      missing,
      `These principles exist in CoachingPrinciples.md with no entry in ` +
      `principleCoverage.ts. Classify each as invariant / test / exempt / ` +
      `unverified before shipping — a rule nothing accounts for is how §79 sat ` +
      `unenforced for a month.`,
    ).toEqual([])
  })

  it('no manifest entry names a principle that no longer exists', () => {
    // The other direction: a renumbered or deleted section leaves a stale entry
    // claiming coverage of nothing. Same class as the backlog's stale-entry
    // audit — an assertion about a thing that is gone reads as reassurance.
    const docSet = new Set(doc)
    const stale = PRINCIPLE_COVERAGE.filter(e => !docSet.has(e.n)).map(e => e.n)
    expect(stale, 'These entries reference sections absent from the constitution.').toEqual([])
  })

  it('every `invariant` entry names a code that is actually registered', () => {
    const codes = new Set<string>(INVARIANT_CODES as readonly string[])
    const broken = PRINCIPLE_COVERAGE
      .filter(e => e.by === 'invariant')
      .filter(e => !e.ref || !codes.has(e.ref))
      .map(e => `§${e.n} → ${e.ref ?? '(no ref)'}`)
    expect(
      broken,
      'These claim an invariant that is not in INVARIANT_CODES — the rule reads ' +
      'as enforced and is not.',
    ).toEqual([])
  })

  it('every `test` entry names a file that exists', () => {
    const broken = PRINCIPLE_COVERAGE
      .filter(e => e.by === 'test')
      .filter(e => !e.ref || !existsSync(join(process.cwd(), e.ref)))
      .map(e => `§${e.n} → ${e.ref ?? '(no ref)'}`)
    expect(
      broken,
      'These name a test file that is not there — a renamed or deleted test ' +
      'silently un-covers its principle.',
    ).toEqual([])
  })

  it('every `test` entry sits where vitest actually collects it', () => {
    // FOUND THE HARD WAY, 2026-09-15: §74's test was first written at
    // `app/api/post-race-reshape/writeBoundary.test.ts`. The file EXISTED, so
    // the assertion above passed and the principle read as covered — and
    // vitest's `include` is `lib/**` + `components/**`, so the test never ran
    // once. A named test nothing executes is worse than an admitted gap,
    // because it reads as a check.
    const roots = ['lib/', 'components/']
    const uncollected = PRINCIPLE_COVERAGE
      .filter(e => e.by === 'test')
      .filter(e => !roots.some(r => (e.ref ?? '').startsWith(r)))
      .map(e => `§${e.n} → ${e.ref}`)
    expect(
      uncollected,
      `These name a test file outside vitest's include globs (${roots.join(', ')}), ` +
      `so it exists and never runs.`,
    ).toEqual([])
  })

  it('every `exempt` entry carries a written reason', () => {
    // An exemption without a reason is indistinguishable from an oversight, and
    // the reason is what a reviewer argues with. Length floor is deliberate:
    // "n/a" is not a reason.
    const bare = PRINCIPLE_COVERAGE
      .filter(e => e.by === 'exempt')
      .filter(e => !e.why || e.why.trim().length < 30)
      .map(e => `§${e.n}`)
    expect(
      bare,
      'Exempt entries must say WHY nothing can assert them. An unexplained ' +
      'exemption is an oversight wearing a label.',
    ).toEqual([])
  })

  it('a principle that CLAIMS an invariant enforces it is telling the truth', () => {
    // PRINCIPLE-CLAIM-SYNC-01 — the §92 class, closed.
    //
    // §92's Config paragraph read "Enforced by the amended
    // `INV-PLAN-FOUNDATION-BLOCK`, which permits strides only when
    // `meta.early_quality_onset` is set" for eight days. The amendment was never
    // made: `invariants.ts` contained the word "strides" three times, all in the
    // maintenance-injury block. The producer gated correctly; the checker was
    // documented and absent.
    //
    // ⚠️ AN EXISTENCE CHECK WOULD NOT HAVE CAUGHT IT, which is the whole lesson.
    // `INV-PLAN-FOUNDATION-BLOCK` existed and was registered. What was missing
    // was the LINK BACK: that invariant's `principle_ref` said §57 and never §92,
    // so nothing connected the claim to the code. The back-reference is the only
    // machine-readable half of the sentence, so that is what this asserts.
    //
    // ⚠️ SCOPED TO OWNERSHIP CLAIMS, deliberately. A blanket "every cited code
    // must cite back" fires on 61 of 146 citations, nearly all of them ordinary
    // cross-references (§2 mentioning §3's deload invariant is prose, not a
    // claim). A check that cries wolf 61 times gets deleted, which this repo
    // records as equivalent to having no check. Measured down to the phrasing
    // §92 actually used: 68 ownership claims, of which 9 were unsatisfied and
    // every one turned out to be a genuine missing back-reference, not a false
    // positive.
    const CLAIM =
      /(?:[Ee]nforced by|[Mm]echanically checked by|[Cc]hecked by|[Gg]uarded by)[^.]{0,120}?(INV-(?:PLAN|MAINT|INPUT)-[A-Z0-9-]+)/g

    // A principle may name an invariant that does not exist YET, when it says so.
    // §24's ultra cadence is SLT-gated on acquisition and its own sentence reads
    // "…once built" — an honest future claim, not a false present-tense one. The
    // reason is the exemption; a bare list would re-admit the §92 class.
    const FORWARD_REFERENCES: Record<string, string> = {
      'INV-PLAN-ULTRA-BACK-TO-BACK-CADENCE':
        '§24 names it explicitly as "enforced … ONCE BUILT" — SLT-gated on ultra acquisition, '
        + 'tracked in configConsumer.test.ts SIG_UNBUILT. A declared future commitment, not a claim '
        + 'that it exists today.',
    }

    // ⚠️ REFS ACCUMULATE ACROSS EVERY PUSH SITE for a code, and that is correct —
    // one invariant can push from several branches, each naming the section that
    // branch serves. Worth stating because it cost a falsification probe: the
    // first attempt to re-break §92 edited ONE of INV-PLAN-FOUNDATION-BLOCK's two
    // push sites, the other still cited §92, the test stayed green, and for a
    // minute the check looked dead. It was the probe that was wrong. Falsify a
    // set-valued check by removing EVERY contributor, not the first one.
    const invSrc = readFileSync(join(process.cwd(), 'lib', 'plan', 'invariants.ts'), 'utf8')
    const backRefs = new Map<string, Set<string>>()
    // `Array.from` around every matchAll: this file's tsc target does not allow
    // iterating a RegExpStringIterator directly, and `npx tsc --noEmit` at the
    // repo root uses a different target than `npm run verify` does — so it type-
    // checked clean locally and failed the gate. Match the idiom already used by
    // `principlesInDoc()` at the top of this file.
    for (const m of Array.from(invSrc.matchAll(
      /code: '(INV-[A-Z0-9-]+)',\s*(?:\n\s*\/\/[^\n]*)*\s*principle_ref: '([^']*)'/g))) {
      const set = backRefs.get(m[1]) ?? new Set<string>()
      for (const sec of Array.from(m[2].matchAll(/§(\d+)/g))) set.add(sec[1])
      backRefs.set(m[1], set)
    }

    const md = readFileSync(PRINCIPLES_MD, 'utf8')
    const sections = md.split(/^## (\d+)\. /m)
    const broken: string[] = []
    for (let i = 1; i < sections.length; i += 2) {
      const n = sections[i]
      for (const m of Array.from(sections[i + 1].matchAll(CLAIM))) {
        const code = m[1]
        if (FORWARD_REFERENCES[code]) continue
        const back = backRefs.get(code)
        if (!back) {
          broken.push(`§${n} claims enforcement by ${code}, which is not registered at all`)
        } else if (!back.has(n)) {
          broken.push(
            `§${n} claims enforcement by ${code}, but that invariant's principle_ref cites only `
            + `§${Array.from(back).join(', §')} — nothing links the claim to the code`)
        }
      }
    }
    expect(
      broken,
      'A principle claiming enforcement that the invariant does not acknowledge is how §92 read ' +
      'as enforced for eight days while checking nothing. Either add the § to that invariant\'s ' +
      'principle_ref, or stop claiming it.',
    ).toEqual([])
  })

  it('the unverified debt does not grow', () => {
    // SWEEP-BASELINE-01's pattern. The count may FALL — lower the baseline in
    // the same commit that classifies one, which locks the progress in. It may
    // not rise: a new rule may not be parked as debt to get a green build.
    const unverified = PRINCIPLE_COVERAGE.filter(e => e.by === 'unverified').map(e => e.n)
    expect(
      unverified.length,
      `${unverified.length} principles are unverified (baseline ${UNVERIFIED_BASELINE}): ` +
      `§${unverified.join(' §')}. If you classified one, LOWER the baseline in this ` +
      `commit. If this rose, a new rule was parked as debt instead of being checked.`,
    ).toBeLessThanOrEqual(UNVERIFIED_BASELINE)
  })

  it('reports the state of the constitution', () => {
    // Not an assertion — the number the founder asked for, printed where it is
    // read on every build rather than measured by hand when someone wonders.
    const by = (k: string) => PRINCIPLE_COVERAGE.filter(e => e.by === k).length
    const accounted = by('invariant') + by('test') + by('exempt')
    // eslint-disable-next-line no-console
    console.log(
      `\n  coaching principles: ${doc.length}` +
      `\n    enforced by an invariant : ${by('invariant')}` +
      `\n    covered by a named test  : ${by('test')}` +
      `\n    exempt, with a reason    : ${by('exempt')}` +
      `\n    UNVERIFIED (debt)        : ${by('unverified')}` +
      `\n    accounted for            : ${accounted}/${doc.length}\n`)
    expect(accounted + by('unverified')).toBe(doc.length)
  })
})
