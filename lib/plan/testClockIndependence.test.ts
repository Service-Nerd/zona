// TEST-CLOCK-PREPTIME-01 (2026-09-28) — an engine test may not depend on the wall clock.
//
// ── THE INCIDENT ─────────────────────────────────────────────────────────────
// Four test files called `generateRulePlan(input, tier)` with an ABSOLUTE
// `race_date` and no `planStart`. The engine therefore fell back to
// `formatDate(nextMonday())`, so the race date stood still while the plan start
// walked toward it — one week every week — until §44's prep-time gate refused to
// generate at all. On 2026-09-28 that was 9 tests red across 4 files, on a clean
// tree, from a commit that touched none of them.
//
// 🔴 THE RED WAS NOT THE COST. Those assertions stopped being TESTED and started
// being UNPROVEN: `--s-long` is reachable at all (PLAN-LONGRUN-COLOUR-01), the
// zone sheet teaches the zone the header showed (ZONE-SHEET-01, an 837-session
// defect), the §96 honesty note exists, every `GeneratorInput` field still DOES
// something (INPUT-EFFECT-01). One of the four could not even be COLLECTED, so
// its 5 tests reported as "0 test" rather than as failures — a file that has
// silently stopped running looks exactly like a file with nothing to say.
//
// `cohortGrid.ts` already names this class in its own header (SWEEP-VACUOUS-01,
// "a time-dependent grid stopped generating and reported a clean bill of health
// for months") and had solved it in exactly one place. **A rule that holds only
// where someone remembered it is not a rule** — hence this gate.
//
// ── WHY A BASELINE AND NOT A SWEEP ───────────────────────────────────────────
// Measured when this shipped: **23** test files are in this class, not 4. The 19
// below pass today only because their races happen to be further out. They were
// deliberately NOT converted in the same commit, because converting one is not a
// formatting change: pinning `sessionColourReach` to `COHORT_PLAN_START` instead
// of its own authoring Monday put the race 33 weeks out rather than 12 and **left
// 2 of its tests failing** — a different plan, quietly under the same assertions.
// Each file needs its own faithful date and its own verification run, which is
// `TEST-CLOCK-PINSWEEP-01`, in margin order.
//
// ✅ SWEPT 2026-09-28 (`TEST-CLOCK-PINSWEEP-01`). All 19 converted, 68 call sites,
// across four different pinned Mondays. The register below is now EMPTY and its
// emptiness is asserted — the gate no longer tolerates debt, it forbids it.
// ⚠️ The baseline lived for ONE commit. That is the only honest lifetime for a
// debt register nobody has scheduled: this repo records that a declared reason is
// not a fixed problem, so the reason was declared and then the problem was fixed.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Every `*.test.ts` under `lib/`, discovered — never a hand-kept list, which is
 *  the flaw that produced the defect this file guards. */
function testFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!p.includes('node_modules')) testFiles(p, out) }
    else if (e.name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

/**
 * 🔴 EVERY ROOT THAT CAN HOLD A PLAN-GENERATING TEST, not just `lib/`.
 *
 * ⚠️ FIXTURE-CLOCK-SWEEP-01 re-measure (2026-10-02). This scanned `lib/` alone,
 * while `generateRulePlan` is called from **2 test files under `components/`**
 * (`components/dashboard/__fixtures__/harnessPlan.test.ts`,
 * `components/training/planRowLabel.test.ts`). Neither pins an absolute
 * `race_date` today, so there was **no live offender** — this closes a hole in the
 * gate's REACH, not a defect in the tree.
 *
 * That distinction is the reason it is worth closing at all: this repo's record is
 * that **a check's anchor decides what it can never see**, and the next
 * plan-generating test written beside a component would have gone green forever.
 * The population, not the predicate, five times over.
 */
const ROOTS = ['lib', 'components', 'app'] as const
function allTestFiles(): string[] {
  return ROOTS.flatMap(r => testFiles(r))
}

/**
 * A call that passes no `planStart`: `generateRulePlan(<anything>, <tier>)` with
 * the tier immediately closing the parens. A call carrying a third argument does
 * not match, which is the whole distinction.
 */
/** A hardcoded calendar date in a fixture — the half that cannot move. */
const ABSOLUTE_RACE_DATE = /race_date:\s*['"]20\d\d-\d\d-\d\d['"]/

/**
 * Does this call hand the engine an explicit plan start?
 *
 * 🔴 A REGEX CANNOT ANSWER THIS, AND I WROTE THREE THAT CLAIMED TO.
 *
 * The original `TWO_ARG` — `generateRulePlan(<anything>, '<tier>')` with the tier
 * closing the parens — is correct but **narrow in two ways**: it needs the tier to
 * be a STRING LITERAL (so a table-driven test over `tier` escapes), and it cannot
 * see an explicit third argument of `undefined`, which is exactly as
 * clock-dependent as omitting one and reads more deliberate.
 *
 * ⚠️ Widening it with regexes FAILED LOUDLY, twice, and the failure is the lesson.
 * `/generateRulePlan\(\s*[^;()]*?,\s*(?!['"])[A-Za-z_$][\w$]*\s*\)/` looks like
 * "two args, second is an identifier". It matched **77 files** — every
 * `generateRulePlan(input, 'paid', PLAN_START)` in the tree — because the lazy
 * prefix happily consumes `input, 'paid'` and then the tail matches
 * `, PLAN_START)`. **A regex has no notion of "the second argument"**; it matches a
 * shape that happens to look like one, and the third argument looks identical to
 * the second from the right-hand side.
 *
 * So: walk the parens and split on top-level commas. The argument position is then
 * a fact rather than a resemblance. ⚠️ I made this same mistake measuring the item
 * before writing the fix, where it produced confident wrong numbers in SILENCE —
 * caught only by re-deriving with a parser. Here the gate caught it in 250ms.
 */
function callsWithoutPlanStart(src: string): number {
  let n = 0
  // CLAUDE.md § TypeScript: iterating a `matchAll` iterator directly needs
  // `--downlevelIteration` under this target. `Array.from` is the documented form.
  for (const m of Array.from(src.matchAll(/generateRulePlan\s*\(/g))) {
    const open = m.index! + m[0].length - 1
    let depth = 0, cur = '', args: string[] = []
    for (let i = open; i < src.length; i++) {
      const c = src[i]!
      if (c === '(' || c === '[' || c === '{') { depth++; if (depth > 1) cur += c }
      else if (c === ')' || c === ']' || c === '}') {
        depth--
        if (depth === 0) { args.push(cur); break }
        cur += c
      } else if (c === ',' && depth === 1) { args.push(cur); cur = '' }
      else cur += c
    }
    const third = (args[2] ?? '').trim()
    // Absent, or explicitly undefined: both fall back to `formatDate(nextMonday())`.
    if (third === '' || third === 'undefined') n++
  }
  return n
}

function offends(src: string): boolean {
  return ABSOLUTE_RACE_DATE.test(src) && callsWithoutPlanStart(src) > 0
}


/**
 * Known offenders. **EMPTY, AND THAT IS THE CORRECT STATE.**
 *
 * It held 19 files for exactly one commit. `TEST-CLOCK-PINSWEEP-01` (2026-09-28)
 * converted all of them — 68 call sites — each to `nextMonday()` as it was when
 * that file was first committed, which is four different Mondays and deliberately
 * not one (see `pinnedPlanStart.ts`: a single week of runway can change plan
 * length, so a shared convenient date is the `COHORT_PLAN_START` mistake again).
 *
 * ⚠️ THE REGISTER STAYS, EMPTY, ON PURPOSE. It is the honest way to record a file
 * that genuinely cannot be pinned yet, and its emptiness is asserted below — so
 * the next entry is a deliberate act with a reason attached, not a quiet way to
 * make this file green. A register that can only grow is one nobody trusts;
 * this one has been to 19 and back to 0.
 */
const CLOCK_DEPENDENT_BASELINE: Record<string, string> = {}

describe('TEST-CLOCK-PREPTIME-01 — no NEW wall-clock-dependent engine test', () => {
  const files = allTestFiles()

  it('discovers the test corpus at all', () => {
    // A zero-length scan would make every assertion below vacuously true, which
    // is the exact shape of failure this file exists to catch.
    expect(files.length).toBeGreaterThan(100)
    expect(files.some(f => /generateRulePlan\(/.test(readFileSync(f, 'utf8')))).toBe(true)
  })

  it('no file outside the declared baseline pairs an absolute race_date with a planStart-less call', () => {
    const newOffenders = files
      .filter(f => offends(readFileSync(f, 'utf8')))
      .filter(f => !(f in CLOCK_DEPENDENT_BASELINE))

    expect(newOffenders, [
      'These tests will generate against `nextMonday()` and rot into a §44 refusal',
      'as the wall clock advances toward their hardcoded race_date.',
      '',
      'Fix: pass the pinned start as the 3rd argument —',
      "  generateRulePlan(input, 'paid', PINNED_PLAN_START)",
      "  import { PINNED_PLAN_START } from '@/lib/plan/__fixtures__/pinnedPlanStart'",
      '',
      'Do NOT add to CLOCK_DEPENDENT_BASELINE to go green: that register is a',
      'record of debt measured on 2026-09-28, not a suppression list.',
    ].join('\n')).toEqual([])
  })

  it('the baseline holds no stale entry — a converted file must be removed from it', () => {
    // A register that only ever grows is a register nobody trusts. This is the
    // same both-directions rule configPrincipleSync applies to its debt list.
    const stale = Object.keys(CLOCK_DEPENDENT_BASELINE)
      .filter(f => { try { return !offends(readFileSync(f, 'utf8')) } catch { return true } })

    expect(stale, 'converted (or deleted) — delete these rows from CLOCK_DEPENDENT_BASELINE')
      .toEqual([])
  })

  it('every engine test with an absolute race_date passes a planStart', () => {
    // The positive form of the same claim, asserted over the DISCOVERED corpus
    // rather than a hand-kept list — a list is what let the original four rot.
    const withAbsoluteDate = files.filter(f => ABSOLUTE_RACE_DATE.test(readFileSync(f, 'utf8')))
    expect(withAbsoluteDate.length, 'corpus must actually contain dated fixtures').toBeGreaterThan(50)

    const unpinned = withAbsoluteDate.filter(f => offends(readFileSync(f, 'utf8')))
    expect(unpinned, 'pass the file\'s own pinned Monday as the 3rd argument').toEqual([])
  })

  it('the register is empty, and an entry is a deliberate act', () => {
    expect(Object.keys(CLOCK_DEPENDENT_BASELINE),
      'TEST-CLOCK-PINSWEEP-01 emptied this. Adding a row needs a reason in the value.')
      .toEqual([])
  })
})
