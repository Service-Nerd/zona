import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatDate } from '@/lib/format'

// WIZARD-WEEKDAY-CONFIRM-01 (b) — Design Board 2026-10-09, SHIP WITH AMENDMENT.
//
// The `race-details` wizard step reads the chosen race date back in full,
// INCLUDING THE WEEKDAY, and renders nothing when no date is set.
//
// 🔴 WHAT THE BOARD KILLED, AND WHY THIS FILE MUST NOT DRIFT INTO IT. A weekday
// CONFIRMATION step is DON'T SHIP, PERMANENT: 37.5% fire rate, and the two most
// common race weekdays are Saturday (12 live plans) and Sunday (13), so a
// confirm interrupts a third of runners to tell them something almost always
// right. The ruling is on SEEN, not CONFIRMED.
//
// ⚠️ TWO ARMS BECAUSE `vitest.config.ts` IS `environment: 'node'` WITH NO JSDOM.
// The behavioural half runs the real owner (`formatDate`) including its empty
// contract; the structural half reads the source, because nothing here can
// mount a React tree. **A source assertion passes on a comment**, which this
// repo has recorded, so comments are stripped and the region is BOUNDED to the
// `race-details` case rather than grepped across a 2,400-line file.

const SRC = 'app/dashboard/GeneratePlanScreen.tsx'
const raw = readFileSync(SRC, 'utf8')
const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

/**
 * The `race-details` RENDER case, bounded — never the whole file.
 *
 * 🔴 THERE ARE TWO `case 'race-details':` IN THIS FILE AND THE FIRST ONE IS NOT
 * THIS ONE. `canAdvance`'s validation switch carries
 * `case 'race-details': return raceDate !== ''`, and it appears ~960 lines
 * EARLIER, so a plain `indexOf` bounded the region onto the wrong switch and
 * every structural arm failed against a correct component. Anchoring on the
 * braced form is what distinguishes them, and the arm below asserts the anchor
 * is unique so a second braced case fails the gate instead of silently
 * re-pointing it.
 */
const RENDER_CASE_ANCHOR = "case 'race-details': {"

function raceDetailsCase(): string {
  const start = stripped.indexOf(RENDER_CASE_ANCHOR)
  expect(start, 'the race-details render case has been renamed or unbraced').toBeGreaterThan(-1)
  const after = stripped.slice(start + RENDER_CASE_ANCHOR.length)
  const end = after.indexOf("case '")
  return end === -1 ? after : after.slice(0, end)
}

describe('WIZARD-WEEKDAY-CONFIRM-01 (b) — the value, through its owner', () => {
  it('a set date reads back in full, with the weekday first', () => {
    // ADR-015 / INV-FMT-001: `lib/format.ts` owns every date string, and
    // `'weekday-long'` already existed — no new formatter was written.
    // ⚠️ THE EXPECTED WEEKDAYS ARE DERIVED, NOT TYPED. The first cut asserted
    // "Saturday 20 June" for 2027-06-20, which is a SUNDAY — a hand-typed
    // weekday in a test about showing the runner the right weekday. Both arms
    // now check the day name against the Date itself.
    const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    for (const iso of ['2027-06-20', '2027-04-25', '2026-12-05', '2027-01-01']) {
      const expected = DAYS[new Date(iso + 'T12:00:00Z').getUTCDay()]
      expect(formatDate(iso, 'weekday-long'), iso).toMatch(new RegExp(`^${expected} \\d`))
    }
    expect(formatDate('2027-06-20', 'weekday-long')).toBe('Sunday 20 June')
  })

  it('🔴 and an EMPTY or unparseable date reads back as nothing, never "Invalid Date"', () => {
    // This is the component's empty state, not a separate check. The wizard
    // restores `raceDate` from `zona_wizard_draft` in sessionStorage, so a
    // corrupt draft is a real path to an unparseable value.
    for (const v of ['', '   ', 'not-a-date', null, undefined]) {
      expect(formatDate(v as never, 'weekday-long'), `input ${JSON.stringify(v)}`).toBeNull()
    }
  })

  it('the weekday is the POINT — a readback without it is the old behaviour', () => {
    // Falsifies a silent downgrade to a style that omits the weekday: the step
    // would still show a date and the ruling would be unmet.
    const s = formatDate('2027-06-20', 'weekday-long')!
    expect(s.split(' ')[0], 'the weekday leads the readback').toBe('Sunday')
    expect(formatDate('2027-06-20', 'long'), 'the plain style has no weekday')
      .not.toMatch(/Sunday/)
  })
})

describe('WIZARD-WEEKDAY-CONFIRM-01 (b) — the step renders it, and renders nothing when empty', () => {
  it('the bounded region is the RENDER case, and there is exactly one of it', () => {
    // A population arm. Two switches in this file use the same case label, and
    // the first version of this gate bounded onto the wrong one.
    const braced = stripped.split(RENDER_CASE_ANCHOR).length - 1
    expect(braced, 'exactly one braced race-details case').toBe(1)
    expect(raceDetailsCase(), 'the region must be the render case, not the validator')
      .toMatch(/<FieldLabel>Race date<\/FieldLabel>/)
  })

  it('the race-details step calls the owner with the weekday-bearing style', () => {
    expect(raceDetailsCase()).toMatch(/formatDate\(\s*raceDate\s*,\s*'weekday-long'\s*\)/)
  })

  it('🔴 the readback is GUARDED, so an empty date renders nothing', () => {
    // The whole empty state in one expression. Without the guard a null value
    // renders as an empty element with its margin — a gap under the field that
    // reads as a layout bug.
    expect(raceDetailsCase()).toMatch(/\{\s*raceDayReadback\s*&&\s*<FieldReadback>/)
  })

  it("⚠️ and Silvanto's amendment holds — the REASON survives beside the readback", () => {
    // "We have traded a reason for a readback. Both, or the readback goes
    // somewhere else." Replacing the sentence satisfies the ruling's letter and
    // breaks its amendment, which is why this is asserted rather than trusted.
    const block = raceDetailsCase()
    expect(block).toContain('Date locks the plan length.')
    expect(block).toMatch(/<FieldNote>/)
    // Order matters: the confirmation of what you just did sits closest to the
    // input, the reason below it.
    expect(block.indexOf('<FieldReadback>')).toBeLessThan(block.indexOf('<FieldNote>'))
  })

  it('🔴 no step becomes a weekday CONFIRMATION — the board killed that permanently', () => {
    // Guards the kill, not just the ship. `design-rulings.md` carries both rows
    // and a settled-ground scan reads them; this makes the kill mechanical.
    const steps = Array.from(stripped.matchAll(/'(?:[a-z-]+)'/g)).map(m => m[1])
    for (const banned of ['confirm-weekday', 'weekday-confirm', 'race-day-confirm']) {
      expect(steps, `${banned} is a step the Design Board killed`).not.toContain(banned)
    }
    expect(raceDetailsCase(), 'no confirm control in the race-details step')
      .not.toMatch(/Is that right|Confirm|correct\?/i)
  })

  it('the component never formats a date itself (ADR-015)', () => {
    expect(stripped, 'lib/format.ts is the sole owner of every date string')
      .not.toContain('toLocaleDateString')
  })

  it('and it introduces no new colour, font or micro-label role', () => {
    const block = stripped.slice(stripped.indexOf('function FieldReadback'))
      .slice(0, stripped.slice(stripped.indexOf('function FieldReadback')).indexOf('\n}') + 2)
    expect(block, 'tokens only — no hardcoded hex').not.toMatch(/#[0-9a-fA-F]{3,8}/)
    expect(block, 'Inter only, via the token').toMatch(/var\(--font-ui\)/)
    expect(block, 'hierarchy by weight and colour, not a fourth micro-label role')
      .not.toMatch(/letterSpacing|textTransform/)
    // 14px is in `ui-patterns.md` § Typography Scale's declared ten. 13px is the
    // app's most-used size and is NOT declared, so it was deliberately not used.
    expect(block).toMatch(/fontSize:\s*'14px'/)
  })
})
