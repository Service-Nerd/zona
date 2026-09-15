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
