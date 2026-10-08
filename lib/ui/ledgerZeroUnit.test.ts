// LEDGER-ZERO-UNIT-01 — the unit never disappears, including at zero.
//
// 🔴 FOUNDER, 2026-10-08: *"it says i have done 0 (this week starts the count). What is that
// counting as I have done 1 run this week already"*.
//
// **The count was correct.** `computeLedger` returns consecutive WEEKS within the lines, and
// his week 1 had a skipped Monday, week 2 nothing logged, and the current week is still in
// progress. The number was right and the screen was wrong: the zero branch **replaced** the
// label "weeks within the lines" with "This week starts the count.", leaving a bare 44px `0`
// with no noun anywhere near it. Guessing "runs" is the most reasonable reading available.
//
// ⚠️ Source-shaped, and the limit is declared: `vitest.config.ts` is `environment: 'node'`
// with no jsdom, so a `'use client'` card cannot be mounted here. Same declared limit as
// `linkPickerCopy.test.ts` and `postRunPaceWired.test.ts`.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'components/dashboard/LedgerCard.tsx'), 'utf8')

/** Comments stripped: this file QUOTES the defect so the next reader understands it, and a
 *  guard that fires on prose recording a defect is the recorded `arm matching its own
 *  comment` class (2026-10-01). Line numbers are irrelevant here, so a line filter is enough. */
const CODE = SRC.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')

describe('the ledger always names its unit', () => {
  it('🔴 THE DEFECT: the noun is no longer inside a zero-vs-nonzero ternary', () => {
    // The exact pre-fix expression. Its return of 'This week starts the count.' INSTEAD OF
    // the label is what removed the unit.
    expect(CODE).not.toMatch(/\?\s*'This week starts the count\.'\s*\n?\s*:\s*'weeks within the lines'/)
  })

  it('"weeks within the lines" renders unconditionally', () => {
    // Not inside any ternary or && guard — the label is the one thing that must always be
    // on screen beside the number.
    expect(CODE).toMatch(/>\s*\n?\s*weeks within the lines\s*\n?\s*<\/div>/)
  })

  it('…and the reassurance still appears at zero, BENEATH it rather than instead of it', () => {
    expect(CODE).toContain('ledger.weeksWithinLines === 0 && (')
    expect(CODE).toContain('This week starts the count.')
  })

  it('no new copy was invented — both strings pre-date the fix', () => {
    // ⚠️ The fix is a layout/ordering change, not a writing change. A new sentence here
    // would be a voice decision and therefore the founder's, not mine.
    for (const s of ['weeks within the lines', 'This week starts the count.']) {
      expect(CODE).toContain(s)
    }
    // And nothing resembling a third, invented variant crept in.
    expect(CODE).not.toMatch(/weeks? in the lines|within the line\b|starts? counting/)
  })

  it('⚠️ the comment-strip does not blind the arms', () => {
    // Proving the filter removes prose is worthless without proving it keeps code — the
    // pre-commit hook's own test table carries the same pair.
    expect(CODE).toContain('weeksWithinLines')
    const asComment = ['  // ? \'This week starts the count.\' : \'weeks within the lines\''].join('\n')
    const stripped = asComment.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n')
    expect(stripped).toBe('')
  })

  it('the number and the unit are still siblings, not separated by the reassurance', () => {
    // Order matters: 44px number → noun → (at zero) reassurance. If the reassurance ever
    // moves between the number and its noun, the unit is visually detached again.
    // ⚠️ REGION BOUNDED FROM THE NUMBER ONWARD, and the first version of this arm was not —
    // it failed on the EMPTY-state branch higher up the file, which renders the same label
    // under an em-dash placeholder. A bare `indexOf` found that one and compared the wrong
    // pair. This repo's `the checker's POPULATION excludes the cases at risk` class, here as
    // a checker measuring the wrong INSTANCE. `CLAUDE.md`: bound the region, never grep the
    // file. ✅ And the empty branch carrying the unit too is correct, not a problem.
    const num  = CODE.indexOf('{ledger.weeksWithinLines}')
    expect(num).toBeGreaterThan(-1)
    const unit = CODE.indexOf('weeks within the lines', num)
    const reas = CODE.indexOf('This week starts the count.', num)
    expect(unit).toBeGreaterThan(num)
    expect(reas).toBeGreaterThan(unit)
  })
})
