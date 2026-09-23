import { describe, it, expect } from 'vitest'
import { convertPaceString, formatPace } from './format'
import { easyPaceAsCeiling } from './plan/easyPaceCeiling'

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

// ── Pre-ship gate §2 — the PARSE BOUNDARY, against CAPTURED REAL SAMPLES ─────
//
// `convertPaceString` parses a string a DIFFERENT subsystem wrote. That is a
// contract with an external producer, and the enrichment bug that this gate
// exists for hid for ~4 months precisely because the success path was only ever
// tested with a hand-tuned fixture.
//
// These are not invented. They are the **27 distinct `pace_target` values that
// exist in `plan_json` in production**, pulled on 2026-09-23, covering all 888
// sessions. Every one is a range; not one is a bare single pace.
const PRODUCTION_PACE_TARGETS = [
  '7:30–9:00 /km', '6:30–7:30 /km', '12:00–13:56 /km', '5:33–6:38 /km',
  '7:21–8:44 /km', '5:53–7:02 /km', '7:14–8:36 /km', '5:44–6:51 /km',
  '7:05–8:26 /km', '1:47–2:07 /km', '1:33–1:37 /km', '5:30–6:00 /km',
  '6:19–6:37 /km', '4:25–4:35 /km', '4:48–5:00 /km', '4:30–5:00 /km',
  '5:34–5:48 /km', '4:30–4:42 /km', '5:28–5:41 /km', '4:24–4:35 /km',
  '5:00–5:14 /km', '5:07–5:22 /km', '6:11–6:29 /km', '4:54–5:06 /km',
  '6:13–6:28 /km', '5:06–5:18 /km', '4:15–4:25 /km',
] as const

describe('convertPaceString — captured production samples', () => {
  it.each(PRODUCTION_PACE_TARGETS)('converts the real stored value %s', stored => {
    const out = convertPaceString(stored, 'mi')
    // Not the identity: a silent pass-through IS the defect being fixed.
    expect(out).not.toBe(stored)
    expect(out).toMatch(/^\d{1,2}:\d{2}–\d{1,2}:\d{2} \/mi$/)
  })

  it('every sample gets SLOWER per unit, because a mile is longer than a km', () => {
    // A directional assertion, not a format one. It would catch the converter
    // dividing where it should multiply — an error a regex match cannot see.
    for (const stored of PRODUCTION_PACE_TARGETS) {
      const [, km] = stored.match(/^(\d{1,2}):(\d{2})/) ? [0, stored] : [0, '']
      const kmSec = Number(km.slice(0, km.indexOf(':'))) * 60 + Number(km.slice(km.indexOf(':') + 1, km.indexOf(':') + 3))
      const out = convertPaceString(stored, 'mi') as string
      const miSec = Number(out.slice(0, out.indexOf(':'))) * 60 + Number(out.slice(out.indexOf(':') + 1, out.indexOf(':') + 3))
      expect(miSec).toBeGreaterThan(kmSec)
    }
  })
})

// ── Pre-ship gate §3 — the COMPOSED path ─────────────────────────────────────
//
// 🔴 TWO SUBSYSTEMS READ THE SAME STRING AND ONE OF THEM SNIFFS THE UNIT BACK
// OUT OF IT. `easyPaceAsCeiling` (§12: an easy run has a ceiling, not a band)
// does `paceTarget.includes('/km') ? ' /km' : ... '/mi' ...` — so the ORDER of
// the two calls decides what the runner reads, and each function is correct in
// isolation either way.
//
// Convert FIRST, then take the ceiling. The reverse order hands the ceiling a
// `/km` string, it preserves `/km`, and the result is a mile-user reading a
// kilometre pace — the exact defect, reintroduced by composition.
describe('convertPaceString ∘ easyPaceAsCeiling — order is load-bearing', () => {
  const stored = '7:30–9:00 /km'

  it('convert THEN ceiling gives a mile ceiling', () => {
    expect(easyPaceAsCeiling(convertPaceString(stored, 'mi'), 'easy')).toBe('12:04 /mi or slower')
  })

  it('🔴 ceiling THEN convert is ALSO correct, and this asserts it stays so', () => {
    // The converter handles a single pace with trailing prose, so this order
    // happens to work too. Asserted rather than assumed: if the converter is
    // ever narrowed to ranges only, this goes red instead of going silent.
    expect(convertPaceString(easyPaceAsCeiling(stored, 'easy'), 'mi')).toBe('12:04 /mi or slower')
  })

  it('a quality session keeps its band through both, in miles', () => {
    // §12 is easy/recovery only — for quality the range IS the target.
    expect(easyPaceAsCeiling(convertPaceString(stored, 'mi'), 'quality'))
      .toBe('12:04–14:29 /mi')
  })

  it('km readers are untouched by either', () => {
    expect(easyPaceAsCeiling(convertPaceString(stored, 'km'), 'easy')).toBe('7:30 /km or slower')
  })
})
