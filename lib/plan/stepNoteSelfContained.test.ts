// STEP-NOTE-SELF-CONTAINED-01 — Coaching Board, 2026-10-07.
//
// 🔴 The founder read his own card: *"On the last rep (5) it says 'same effort as
// rep three of a cruise set'. That has no context and does not make sense."* He
// was right. `progressive_tempo` is eligible from BASE phase, so a runner meets
// that note in week 3 having possibly never been prescribed a cruise interval.
//
// ⚠️ THE DESIGN BOARD ROUTED THIS TO COACHING THE SAME MORNING AND NOBODY FILED
// IT. The ruling existed and the work did not — the same gap that left §81's
// second half unbuilt for three days after the board named it. This gate is the
// part that does not depend on anyone remembering.
//
// 📐 Measured: 1 of 52 distinct step notes. Every other note calibrates WITHIN
// its own session ("rep three should look like rep one", "don't blow rep one") or
// against an effort band ("threshold effort — comfortably hard"). A within-session
// reference is fine and must stay legal; only a reference to ANOTHER SESSION is
// the defect, which is why this matches session NOUNS and not the word "rep".
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(__dirname, 'sessionCatalogueData.ts'), 'utf8')
const NOTES = Array.from(SRC.matchAll(/note: '((?:[^'\\]|\\.)*)'/g)).map(m => m[1]!)

/**
 * A note may not calibrate the runner against a session they may not have run.
 * Session NOUNS, deliberately — "rep three" on its own is a within-session
 * reference and stays legal.
 */
const OTHER_SESSION = /\b(cruise (?:set|interval)|tempo run|fartlek|parkrun|time trial|long run|VO2max session|interval session|threshold session)\b/i

describe('STEP-NOTE-SELF-CONTAINED-01 — a step note stands on its own', () => {
  it('the corpus is real', () => {
    expect(NOTES.length, 'no step notes parsed — the matcher has drifted from the file').toBeGreaterThan(40)
  })

  it('no note calibrates effort against ANOTHER session', () => {
    const offenders = NOTES.filter(n => OTHER_SESSION.test(n))
    expect(offenders, `${offenders.length} step note(s) tell the runner to match a session they ` +
      'may never have been prescribed. Calibrate from inside this session.').toEqual([])
  })

  it('a WITHIN-session reference is still legal', () => {
    // The rule must not over-reach: "rep three should look like rep one" is a
    // calibration the runner can act on, in the session they are standing in.
    expect(OTHER_SESSION.test('Threshold, held. Rep three should look like rep one.')).toBe(false)
    expect(OTHER_SESSION.test('Even splits — don’t blow rep one.')).toBe(false)
    // And it must still catch the real one.
    expect(OTHER_SESSION.test('Threshold now. Same effort as rep three of a cruise set.')).toBe(true)
  })
})
