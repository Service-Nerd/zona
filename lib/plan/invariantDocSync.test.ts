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
const UNDOCUMENTED_BASELINE = new Set([
  'INV-PLAN-5K10K-LR-PACE-CAP',
  'INV-PLAN-BUILD-LR-SEGMENT-CAP',
  'INV-PLAN-COACH-NOTES-MATCH-INTENT',
  'INV-PLAN-COVERS-RACE-DATE',
  'INV-PLAN-FINISH-GOAL-LR-CAP',
  'INV-PLAN-HR-ASSUMPTIONS-SURFACED',
  'INV-PLAN-INJURY-NO-HILLS',
  'INV-PLAN-LARGEST-SESSIONS-SPACED',
  'INV-PLAN-LR-MAX-WEEKLY-PCT',
  'INV-PLAN-NO-PLACEHOLDER-COPY',
  'INV-PLAN-NO-SESSIONS-ON-BLOCKED-DAYS',
  'INV-PLAN-PEAK-LR-ALTERNATION',
  'INV-PLAN-PEAK-LR-RACE-RATIO',
  'INV-PLAN-PEAK-VOLUME-FLOOR-LONG-RACES',
  'INV-PLAN-QUALITY-VARIETY-FULL-PLAN',
  'INV-PLAN-RACE-ON-RACE-DAY',
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO',
  'INV-PLAN-RACE-SPECIFIC-LONG-RUN',
  'INV-PLAN-RACE-WEEK-SHARPENING',
  'INV-PLAN-RECALIBRATION-HAS-SESSION',
  'INV-PLAN-RETURNING-RUNNER-NOTE-PRESENT',
  'INV-PLAN-TAPER-COPY-MATCHES-DURATION',
  'INV-PLAN-TAPER-DURATION-CAP',
  'INV-PLAN-TAPER-VARIETY',
  'INV-PLAN-ULTRA-NO-PACE-SEGMENTS',
  'INV-PLAN-VDOT-RAW-EXCEEDS-ANCHOR',
  'INV-PLAN-WEEK-HAS-REST-DAY',
])

describe('invariant registry ↔ code', () => {
  const doc = readFileSync(DOC, 'utf8')

  it('no NEW invariant ships undocumented', () => {
    const undocumented = INVARIANT_CODES.filter(c => !doc.includes(c) && !UNDOCUMENTED_BASELINE.has(c))
    expect(undocumented, `Add a row to plan-invariants.md for: ${undocumented.join(', ')}`).toEqual([])
  })

  it('the baseline only shrinks', () => {
    // A code documented since the baseline was taken must be removed from the
    // list, or the list stops meaning anything.
    const nowDocumented = Array.from(UNDOCUMENTED_BASELINE).filter(c => doc.includes(c))
    expect(nowDocumented, `Documented now — delete from UNDOCUMENTED_BASELINE: ${nowDocumented.join(', ')}`).toEqual([])
  })

  it('the baseline lists only real invariant codes', () => {
    const known = new Set<string>(INVARIANT_CODES)
    const stale = Array.from(UNDOCUMENTED_BASELINE).filter(c => !known.has(c))
    expect(stale, `Not an invariant any more: ${stale.join(', ')}`).toEqual([])
  })
})
