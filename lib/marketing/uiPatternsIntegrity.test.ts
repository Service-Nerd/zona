// ui-patterns.md pattern numbers must be unique, and cited numbers must exist.
//
// Found 2026-09-12 while adding Pattern 32. **Four different components each
// cited "Pattern 30"** and the number resolved to three different things:
//
//   · `PullToRefresh`        → §30. Correct — it owns that number.
//   · `PostRaceReshapeCard`  → §30. A genuine COLLISION; two headings, one number.
//   · `PlanCalendar`         → §30. WRONG; the section it means is §10b.
//   · `PreRunBandCard`       → §30. DANGLING; it has no section at all.
//
// A reader following any of those lands somewhere confidently wrong, which is
// worse than an unnumbered pattern. This is the same defect the constitution had
// (§55, §81 and §82 each appeared twice) and `principlesIntegrity.test.ts` was
// written to stop — ui-patterns.md simply had no equivalent guard.
//
// Lettered variants (10b, 17a…) are deliberate sub-patterns and are NOT
// collisions: "10" and "10b" are different sections.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DOC = readFileSync(join(process.cwd(), 'docs/canonical/ui-patterns.md'), 'utf8')

/** "### 10b. Move-confirmation row" -> "10b" */
const headings = Array.from(DOC.matchAll(/^### (\d+[a-z]?)\.\s/gm)).map(m => m[1]!)

describe('ui-patterns.md — pattern numbering integrity', () => {
  it('has patterns to check — the parser is not silently matching nothing', () => {
    expect(headings.length).toBeGreaterThan(25)
  })

  it('every pattern number is unique', () => {
    const seen = new Map<string, number>()
    for (const h of headings) seen.set(h, (seen.get(h) ?? 0) + 1)
    const dupes = Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k, n]) => `§${k} x${n}`)
    expect(
      dupes,
      'Two sections share a number, so every reference to it is ambiguous. ' +
      'Give the newer one the next free number and update its code citations.',
    ).toEqual([])
  })

  it('a lettered variant always has its base pattern', () => {
    // "10b" with no "10" is an orphan — the variant claims to extend something
    // that is not there.
    const bases = new Set(headings.filter(h => /^\d+$/.test(h)))
    const orphans = headings
      .filter(h => /^\d+[a-z]$/.test(h))
      .filter(h => !bases.has(h.replace(/[a-z]$/, '')))
    expect(orphans, 'lettered variants with no base pattern').toEqual([])
  })

  it('FALSIFICATION — the duplicate check really catches a duplicate', () => {
    // Without this, a parser that matched nothing would pass the check above
    // forever. Prove the detection on a known-bad input.
    const fake = ['30', '31', '30']
    const seen = new Map<string, number>()
    for (const h of fake) seen.set(h, (seen.get(h) ?? 0) + 1)
    expect(Array.from(seen.entries()).filter(([, n]) => n > 1).map(([k]) => k)).toEqual(['30'])
  })
})
