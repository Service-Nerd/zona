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
// So this gate does the one thing a baseline can honestly do: it stops the class
// GROWING. Same shape as SWEEP-BASELINE-01 and the invariant-liveness baseline.
// ⚠️ A DECLARED REASON IS NOT A FIXED PROBLEM — these 19 are still rotting, and
// nothing here schedules them.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/** Every `*.test.ts` under `lib/`, discovered — never a hand-kept list, which is
 *  the flaw that produced the defect this file guards. */
function testFiles(dir = 'lib', out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) { if (!p.includes('node_modules')) testFiles(p, out) }
    else if (e.name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

/**
 * A call that passes no `planStart`: `generateRulePlan(<anything>, <tier>)` with
 * the tier immediately closing the parens. A call carrying a third argument does
 * not match, which is the whole distinction.
 */
const TWO_ARG = /generateRulePlan\(\s*[^;]*?,\s*['"](paid|free|trial)['"]\s*\)/g

/** A hardcoded calendar date in a fixture — the half that cannot move. */
const ABSOLUTE_RACE_DATE = /race_date:\s*['"]20\d\d-\d\d-\d\d['"]/

function offends(src: string): boolean {
  return ABSOLUTE_RACE_DATE.test(src) && new RegExp(TWO_ARG).test(src)
}

/**
 * Known offenders, with the measured weeks-until-BLOCK at 2026-09-28 (upper
 * bound: the earliest `race_date` in the file paired against its longest
 * `race_distance_km`, which is not always a pairing that actually occurs).
 * Ordered by urgency — convert from the top.
 *
 * ⚠️ NEGATIVE margins are real but were NOT failing, which is the tell that the
 * pairing is pessimistic: those files reach §44 with a shorter distance, a
 * `finish` goal (warn reads as ok) or an acknowledged warning.
 */
const CLOCK_DEPENDENT_BASELINE: Record<string, string> = {
  'lib/plan/longRunCapDurationAnchored.test.ts': '50K 2026-12-27 — margin -3',
  'lib/plan/lrSegmentRecorded.test.ts':          'marathon 2026-12-12 — margin -1',
  'lib/plan/easyRunFloorProtection.test.ts':     'marathon 2027-01-01 — margin 2',
  'lib/plan/terrainEffortNote.test.ts':          '10K 2026-12-06 — margin 2',
  'lib/plan/deliveredRamp.test.ts':              '10K 2026-12-12 — margin 3',
  'lib/plan/overdoBrake.test.ts':                '10K 2026-12-14 — margin 4',
  'lib/plan/week1LeapAbsolute.test.ts':          'HM 2027-01-04 — margin 5',
  'lib/plan/frequencyConstraintNote.test.ts':    'marathon 2027-01-25 — margin 6',
  'lib/plan/raceWeekWeekdayCap.test.ts':         '5K 2027-01-01 — margin 8',
  'lib/plan/week1PerRunStep.test.ts':            'HM 2027-01-25 — margin 8',
  'lib/plan/week1LeapDenominator.test.ts':       '10K 2027-01-18 — margin 9',
  'lib/plan/longSessionFuelling.test.ts':        '10K 2027-03-07 — margin 15',
  'lib/plan/hardAverseFloor.test.ts':            '10K 2027-03-14 — margin 16',
  'lib/plan/copyStaleOnGeneration.test.ts':      '100K 2027-05-30 — margin 19',
  'lib/plan/freeIntro.test.ts':                  'HM 2027-04-18 — margin 19',
  'lib/plan/planSaveValidate.test.ts':           'HM 2027-04-18 — margin 19',
  'lib/plan/raceDistanceValidation.test.ts':     'HM 2027-04-18 — margin 19',
  'lib/plan/reentryCauseAndShortfallBand.test.ts': 'marathon 2027-06-06 — margin 24',
  'lib/plan/sessionSizingAnchor.test.ts':        'see file — no single earliest pairing',
}

describe('TEST-CLOCK-PREPTIME-01 — no NEW wall-clock-dependent engine test', () => {
  const files = testFiles()

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

  it('the four files fixed by TEST-CLOCK-PREPTIME-01 are clean and stay clean', () => {
    const fixed = [
      'lib/sessionColourReach.test.ts',
      'lib/coaching/zoneSheetMatchesHeader.test.ts',
      'lib/plan/hardPrefNote.test.ts',
      'lib/plan/inputEffect.test.ts',
    ]
    for (const f of fixed) {
      const src = readFileSync(f, 'utf8')
      // Word-bounded, not `toContain`: a bare substring also passes against
      // `PINNED_PLAN_STARTX`. `hollowTestShapes.test.ts` caught this exact line
      // when this gate was written — the lint against substring bias flagged the
      // gate written against clock bias, which is the system working.
      expect(src, `${f} must import the pinned start`).toMatch(/\bPINNED_PLAN_START\b/)
      expect(offends(src), `${f} regressed to a wall-clock fixture`).toBe(false)
    }
  })
})
