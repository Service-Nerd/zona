import { describe, it, expect } from 'vitest'
import { convertPaceString, formatPace } from './format'

// PACE-UNITS-01 — the render-time repair for a unit baked in at GENERATION time.
//
// 🔴 WHY A CONVERTER AND NOT A FIX AT THE PRODUCER. `ruleEngine.ts` builds
// `pace_target` as a STRING with `/km` welded on, and the plan is then stored in
// `plan_json`. Measured 2026-09-23: **674 of 888 stored sessions** carry `/km`
// inside `pace_target`, across **17 of 19** stored plans. The producer runs
// before the reader exists — `plan_json.meta.preferred_units` is NULL, so a
// stored plan does not even record which units it was generated in.
//
// Fixing the producer therefore repairs NO EXISTING PLAN. The number is gone by
// render time; only the string survives. This reads the number back out.
//
// ⚠️ IT IS A REPAIR, NOT AN OWNER. `lib/format.ts → formatPace` remains the
// ADR-015 owner and does the actual arithmetic; this only finds the digits and
// hands them over. A second pace formatter would be the DELOAD-OWNER-01 shape.
describe('convertPaceString', () => {
  it('converts a RANGE, both endpoints and the suffix', () => {
    expect(convertPaceString('5:53–7:02 /km', 'mi')).toBe('9:28–11:19 /mi')
  })

  it('converts a single pace and preserves the trailing prose', () => {
    // §12's easy ceiling reads "or slower" — the words must survive.
    expect(convertPaceString('5:53 /km or slower', 'mi')).toBe('9:28 /mi or slower')
  })

  it('is the IDENTITY in km — the stored string is already correct', () => {
    expect(convertPaceString('5:53–7:02 /km', 'km')).toBe('5:53–7:02 /km')
  })

  it('leaves a string that is already /mi alone', () => {
    // No `/km` to find, so nothing is converted. Guards double-conversion,
    // which would silently inflate every pace by 1.609 a second time.
    expect(convertPaceString('8:00 /mi', 'mi')).toBe('8:00 /mi')
  })

  it('passes through effort-governed prescriptions untouched', () => {
    // §44 pt 3 sessions carry no pace anchor at all. A converter that mangled
    // these would be inventing a number the board deliberately withheld.
    expect(convertPaceString('easy effort', 'mi')).toBe('easy effort')
    expect(convertPaceString('conversational', 'mi')).toBe('conversational')
  })

  it('passes null and undefined straight through', () => {
    expect(convertPaceString(null, 'mi')).toBeNull()
    expect(convertPaceString(undefined, 'mi')).toBeUndefined()
  })

  it('defaults to km when no preference is given', () => {
    expect(convertPaceString('5:53 /km')).toBe('5:53 /km')
  })

  it('agrees with formatPace, which is the ADR-015 owner', () => {
    // ⚠️ ASSERTS AGAINST THE PRODUCER, NEVER A COPY OF ITS RULE. A test holding
    // its own arithmetic is the exact `tierResolution.test.ts` flaw — it would
    // pass while the owner drifted. Here the expected value IS the owner's.
    const secPerKm = 5 * 60 + 53
    expect(convertPaceString('5:53 /km', 'mi'))
      .toBe(`${formatPace(secPerKm, 'mi', { noSuffix: true })} /mi`)
  })

  it('returns the ORIGINAL unchanged if any endpoint fails to convert', () => {
    // All-or-nothing on purpose. A half-converted range ("9:28–7:02 /mi") is
    // worse than an unconverted one: it looks right and is silently wrong.
    expect(convertPaceString('0:00 /km', 'mi')).toBe('0:00 /km')
  })
})
