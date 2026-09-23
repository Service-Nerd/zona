// PREVIEW-STRIP-01 — the plan preview does not contradict itself.
//
// 🔴 Four elements on ONE scroll all described the same 23 weeks:
// `PlanHeroMetrics` (peak + total as numbers), `PlanArc` (bar height = weekly
// km, plus a phase rail), `PreviewPhaseStrip` (a second row of bars) and the
// `Plan shape` cards (phase names + peak, in words). **Phase was encoded three
// times; peak volume three times.**
//
// The board removed the strip, and NOT because four is too many. Two of them
// were rows of bars where **height meant different things**: `PlanArc` encodes
// volume, and the strip's height carried no meaning at all — 60% for
// foundation, 100% for everything else. Collins: *"a runner who has just
// learned that tall means hard scrolls ninety lines and meets bars that are all
// the same height. That is not redundancy, it is a contradiction."*
//
// ⚠️ ITS ONLY UNIQUE CHANNEL WAS COLOUR = PHASE, and the `Plan shape` cards name
// those phases in words immediately below. Its volume lived in a `title=`
// attribute, which on the surface it was built for is unreachable.
//
// ⚠️ AND REMOVING IT FIXED A SECOND CONTRADICTION nobody had reported: the strip
// rendered `Race · Wk {mainWeeks.length}` = **20** while `PlanHeroMetrics`
// renders `plan.weeks.length` = **23**. **Two week-counts for one plan.**
//
// ⚠️ THIS ASSERTS THE GUARANTEE, NOT THE ABSENCE OF ONE COMPONENT. A test that
// only said "PreviewPhaseStrip is gone" would pass against a differently-named
// re-implementation of the same defect — which is the `toContain('<PlanCalendar')`
// / `<PlanCalendarX` flaw this repo has recorded.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const SRC = readFileSync('app/dashboard/GeneratePlanScreen.tsx', 'utf8')

/**
 * Code only — a comment explaining this rule is not a second copy of it.
 *
 * 🔴 THE FIRST VERSION OF THIS FILTER ONLY CHECKED LINE PREFIXES, AND MY OWN
 * COMMENT FAILED MY OWN TEST. The JSX block `{/* … *\/}` that documents this
 * removal quotes `mainWeeks.length` to explain the contradiction, and its
 * CONTINUATION lines start with ordinary prose — so the `week count` assertion
 * fired on the comment describing the defect it was written to prevent.
 *
 * Block state is tracked, exactly as `hardcodedUnits.test.ts` does, and for the
 * reason its header gives: a guard that fires on its own documentation teaches
 * you to write around the guard, which is worse than a false negative. **Seventh
 * recording of "bound the region, never grep the file".**
 */
function codeOnly(src: string): string {
  const out: string[] = []
  let inBlock = false
  for (const raw of src.split('\n')) {
    const t = raw.trim()
    if (inBlock) {
      if (/\*\/\}?/.test(raw)) inBlock = false
      continue
    }
    if (/^\{?\/\*/.test(t) && !/\*\/\}?/.test(t)) { inBlock = true; continue }
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.startsWith('{/*')) continue
    out.push(raw)
  }
  return out.join('\n')
}

const code = codeOnly(SRC)

describe('PREVIEW-STRIP-01 — the preview has ONE bar row', () => {
  it('the file still renders the arc (guards the guard)', () => {
    // If PlanArc ever leaves, every assertion below passes vacuously.
    //
    // 🔴 THIS READ `toContain('<PlanArc')` AND PASSED AGAINST `<PlanArcX` — the
    // EXACT substring-bias flaw quoted in this file's own header, committed
    // three lines after quoting it. Falsifying is the only reason it is not
    // still there. The tag must END here, not merely start.
    expect(code).toMatch(/<PlanArc[\s/>]/)
  })

  it('🔴 only ONE element maps weeks to a row of bars', () => {
    // A bar row is a flex container of per-week children with an explicit
    // height. `PlanArc` owns that idiom on this screen; a second one is the
    // defect, whatever it is called.
    const barRows = Array.from(
      code.matchAll(/display: 'flex'[^}]*height: '\d+px'[^}]*alignItems: 'flex-end'/g),
    )
    expect(
      barRows.map(m => m[0].slice(0, 80)),
      'A second row of per-week bars on this screen. If its height does not encode ' +
        'volume, it contradicts PlanArc, which does.',
    ).toEqual([])
  })

  it('🔴 the screen states ONE week count, not two', () => {
    // `PlanHeroMetrics` renders `plan.weeks.length` (23, foundation included).
    // The strip rendered `mainWeeks.length` (20, excluded), on the same scroll.
    expect(
      code.includes('mainWeeks.length'),
      'This screen showed 23 weeks in one place and 20 in another, differing by ' +
        'the foundation block. One plan, one week count.',
    ).toBe(false)
  })

  it('the phase vocabulary survives, in words', () => {
    // The strip\'s unique channel was colour = phase. That must still be said —
    // the board removed a duplicate, not the information.
    expect(code).toContain('PhaseSummaryCard')
    expect(SRC).toContain('Pre-plan easy running')   // the "before your plan" framing
  })
})
