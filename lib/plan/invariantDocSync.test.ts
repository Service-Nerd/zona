import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { INVARIANT_CODES } from './invariants'

/**
 * Every invariant must be documented in `plan-invariants.md`.
 *
 * Found 2026-08-20: **29 of 65 invariant codes (45%) were absent from the
 * registry document.** It is the canonical description of the constitutional
 * enforcement layer, and nearly half of that layer was undocumented.
 *
 * This is the same failure class as SC-00's catalogue drift and the stale
 * session-catalogue table: a canonical document that nothing checks is a
 * declaration nobody is obliged to honour (§34 — "declared AND exercised").
 * `catalogueDocSync.test.ts` closed it for the catalogue; this closes it for
 * the invariants.
 *
 * BASELINED, NOT AMNESTIED. The 29 pre-existing gaps are listed below so the
 * bleeding stops immediately — a NEW invariant cannot be added without a row —
 * while the backlog carries the debt. Documenting one is a two-line diff:
 * write the row, delete the entry here.
 */

const DOC = join(process.cwd(), 'docs/canonical/plan-invariants.md')

// Undocumented as of 2026-08-20. Shrink this list; never grow it.
// EMPTY — all 27 pre-existing gaps documented 2026-08-20. Every invariant now
// has a row. If this list needs an entry again, something regressed.
const UNDOCUMENTED_BASELINE = new Set<string>([])

describe('invariant registry ↔ code', () => {
  const doc = readFileSync(DOC, 'utf8')

  // Row ids as they appear in the table: `| \`INV-…\` |` at the start of a line.
  // NOT a substring search of the whole document — see the test below.
  const documentedRows = new Set(
    Array.from(doc.matchAll(/^\| `(INV-[A-Z0-9-]+)`/gm)).map(m => m[1]),
  )

  it('no NEW invariant ships undocumented', () => {
    const undocumented = INVARIANT_CODES.filter(c => !documentedRows.has(c) && !UNDOCUMENTED_BASELINE.has(c))
    expect(undocumented, `Add a row to plan-invariants.md for: ${undocumented.join(', ')}`).toEqual([])
  })

  it('a passing mention is NOT documentation', () => {
    // The hole this closes, found 2026-08-20 hours after the guard shipped:
    // the check was `doc.includes(code)`, and
    // INV-PLAN-PREP-TIME-STATUS-ANNOTATED appeared ONLY inside another row's
    // prose ("Mirrors `INV-PLAN-…`"). It had no row of its own and the guard
    // passed anyway — 64 rows for 65 invariants, reported as zero undocumented.
    //
    // A check that accepts an incidental mention is the vacuous-test failure
    // this repo keeps finding, this time in the guard written to prevent it.
    expect(documentedRows.size).toBe(INVARIANT_CODES.length)
  })

  it('the baseline only shrinks', () => {
    // A code documented since the baseline was taken must be removed from the
    // list, or the list stops meaning anything.
    const nowDocumented = Array.from(UNDOCUMENTED_BASELINE).filter(c => documentedRows.has(c))
    expect(nowDocumented, `Documented now — delete from UNDOCUMENTED_BASELINE: ${nowDocumented.join(', ')}`).toEqual([])
  })

  it('the baseline lists only real invariant codes', () => {
    const known = new Set<string>(INVARIANT_CODES)
    const stale = Array.from(UNDOCUMENTED_BASELINE).filter(c => !known.has(c))
    expect(stale, `Not an invariant any more: ${stale.join(', ')}`).toEqual([])
  })
})
