// ENRICH-LABEL-CLASS-01 — the enricher may rename a session, not reclassify it.
//
// 🔴 THE DEFECT, MEASURED. `INV-PLAN-LABEL-MATCHES-PACE` decides which band judges a
// session's pace FROM ITS LABEL (§19: "'Threshold'/'Tempo'/'Cruise' MUST land at
// T-pace"), and the enricher writes the label. Across 90 plans / 795 quality sessions
// carrying a pace target:
//   · 0 of 480 already-in-scope sessions are outside their band — the engine never
//     mislabels, so this check has NEVER caught an engine defect.
//   · 75 (9.4%) carry a correct, legitimately-faster-than-T pace with no threshold
//     vocabulary. `CV intervals` (60) and `Thirty-thirty` (15) are all of them.
// Observed live: a goal-anchored session at 6.63/km relabelled "threshold" against a
// T-pace of 7.05 — three violations, which cost that runner seven weeks of copy.
//
// ⚠️ AND THE CLASSIFIER IS SHARED WITH THE INVARIANT ON PURPOSE. Two copies of
// "what does this label claim" is the drift that cost 84 plans when
// `copyClaimsIntensity`'s producer kept its own regexes. The last arm here asserts
// both sides read the same thing.
import { describe, it, expect } from 'vitest'
import { preserveLabelClass } from './enrich'
import { labelImplications } from './invariants'

describe('ENRICH-LABEL-CLASS-01', () => {
  it('1. 🔴 refuses a cross-class rename — the measured live failure', () => {
    // The two at-risk families, renamed into threshold vocabulary.
    expect(preserveLabelClass('CV intervals', 'Cruise intervals')).toBe('CV intervals')
    expect(preserveLabelClass('Thirty-thirty', 'Tempo repeats')).toBe('Thirty-thirty')
    // And the live one: a goal-anchored session called "threshold".
    expect(preserveLabelClass('Marathon-pace reps', 'threshold')).toBe('Marathon-pace reps')
  })

  it('2. ✅ ALLOWS a within-class rename — that is the enricher doing its job', () => {
    // Both read as threshold, so the voice passes through untouched.
    expect(preserveLabelClass('Quality — threshold', 'Threshold intervals')).toBe('Threshold intervals')
    expect(preserveLabelClass('Continuous tempo', 'Tempo — hold the line')).toBe('Tempo — hold the line')
    // Neither reads as anything, so there is no claim to protect.
    expect(preserveLabelClass('Mile repeats', 'Mile repeats — find the rhythm'))
      .toBe('Mile repeats — find the rhythm')
  })

  it('3. refuses a rename that invents a VO2max claim, and one that drops it', () => {
    expect(preserveLabelClass('Cruise intervals', 'VO2max intervals')).toBe('Cruise intervals')
    // Both directions: losing the claim is also a reclassification.
    expect(preserveLabelClass('VO2max intervals', 'Hard reps')).toBe('VO2max intervals')
  })

  it('4. refuses a rename that makes a hard session sound EASY', () => {
    // `labelImpliesEasy` feeds its own arm of the same invariant; a quality session
    // renamed "steady" would claim Zone 1–2 work it does not prescribe.
    expect(preserveLabelClass('Cruise intervals', 'Steady effort')).toBe('Cruise intervals')
    expect(preserveLabelClass('Mile repeats', 'Easy aerobic')).toBe('Mile repeats')
  })

  it('5. a missing engine label cannot be restored, so the enriched one stands', () => {
    // Legacy plans may carry no label. Refusing would leave the session nameless,
    // which is worse than an imperfect name.
    expect(preserveLabelClass(undefined, 'Tempo repeats')).toBe('Tempo repeats')
  })

  it('6. 🔴 the merge and the invariant read labels through ONE owner', () => {
    // If this ever diverges, a rename the merge permits can still trip the check —
    // the 84-plan drift, one layer over.
    for (const label of [
      'CV intervals', 'Thirty-thirty', 'Continuous tempo', 'Cruise intervals',
      'VO2max intervals', 'Marathon-pace reps', 'Easy run — Zone 2', 'Mile repeats',
    ]) {
      const a = labelImplications(label)
      // Same label, same reading, whichever side asks: `preserveLabelClass` is a
      // pure function of `labelImplications`, so identity against itself is the
      // only honest assertion — and it fails loudly if the import is re-pointed.
      expect(preserveLabelClass(label, label)).toBe(label)
      expect(labelImplications(label)).toEqual(a)
    }
    // The classifier's three readings are INDEPENDENT, not an enum: the band arm
    // asks for `threshold && !vo2`, so collapsing them would change behaviour.
    expect(labelImplications('VO2max tempo')).toEqual({ vo2: true, threshold: true, easy: false })
  })
})
