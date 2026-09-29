import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dashboardSource } from '@/lib/testing/dashboardSources'

// ZONES-HR-SHEET-01 — the HR form has ONE mount, and it is inside the zones screen.
//
// 🔴 WHAT THIS ACTUALLY GUARDS IS THE CONTROL, NOT THE SHEET. `onEditHr` has now moved
// THREE times. Twice it broke silently:
//   • it called `getElementById(HR_CARD_ANCHOR_ID).scrollIntoView()` at an element that had
//     gone behind a door, got null, and DID NOTHING for a day. No error, no log.
//   • it then navigated to Me, which worked but cost a two-tap return and lost the screen.
// Its own tests asserted the chevron RENDERED. Nothing asserted it WENT anywhere. That is
// the `ME-DOORS-01` lesson and this file is the arm that was missing.

/** 🔴 COMMENTS STRIPPED BEFORE EVERY SCAN. Both of this gate's first failures were its own
 *  explanatory comments naming the retired door. That is the EIGHTH recorded instance of a
 *  check matching a comment in this repo, and the first cut of this file shipped it. */
const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//')).join('\n')

const UI = (): string[] =>
  execSync("git ls-files 'app/**/*.tsx' 'app/*.tsx' 'components/**/*.tsx' 'components/*.tsx'",
    { encoding: 'utf8' })
    .trim().split('\n').filter(f => f && !f.includes('.test.'))

/** Files allowed to render `<HRZonesSection`. The sheet, and the harness that previews it. */
const ALLOWED_MOUNTS = [
  'components/shared/HrCalibrationSheet.tsx',
  'app/copy-preview/page.tsx',
]

describe('ZONES-HR-SHEET-01 — one mount, inside zones', () => {
  it('scans a real corpus (an empty sweep is not a pass)', () => {
    expect(UI().length, 'ui files').toBeGreaterThan(50)
  })

  it('🔴 exactly one PRODUCT file renders the HR form, and it is the sheet', () => {
    // A second mount is a duplicate owner of the same input. `ZONES-INPUTS-01` was reversed
    // on the argument that the form should live in one place; two would give that back.
    const mounts = UI().filter(f => readFileSync(f, 'utf8').includes('<HRZonesSection'))
    const unexpected = mounts.filter(f => !ALLOWED_MOUNTS.includes(f))
    expect(unexpected, 'a second mount of the HR form:\n' + unexpected.join('\n')).toEqual([])
    expect(mounts, 'the sheet no longer renders the form')
      .toContain('components/shared/HrCalibrationSheet.tsx')
  })

  it('🔴 the sheet is a SHEET, not a hand-rolled panel', () => {
    // The founder said "pop up perhaps". The answer is the app's own primitive, and a
    // hand-rolled panel here would be the seventh copy `SHEET-PRESENT-01` exists to prevent.
    const src = readFileSync('components/shared/HrCalibrationSheet.tsx', 'utf8')
    expect(src, 'must use the single slide-up primitive').toMatch(/from '@\/components\/shared\/Sheet'/)
    expect(src, 'must not invent its own z-index').not.toMatch(/zIndex:\s*\d+/)
    expect(src, 'must not invent its own backdrop').not.toContain('position: \'fixed\'')
  })

  it('🔴 the title is said ONCE, from the owner', () => {
    // Two of three ME-DOORS-01 doors shipped saying their own name twice, and neither was
    // wrong when written. The sheet carries the title now, so it takes the owner's string.
    const src = readFileSync('components/shared/HrCalibrationSheet.tsx', 'utf8')
    expect(src).toContain("from '@/components/shared/meDoors'")
    expect(src).toContain('{HEART_RATE_TITLE}')
    expect(src, 'a hardcoded title is how two surfaces drift').not.toMatch(/>\s*Heart rate\s*</)
  })

  it('🔴 the provenance row OPENS THE SHEET and no longer leaves the screen', () => {
    // THE ARM FOR THE DEFECT CLASS. Assert where it GOES, not that it renders.
    const src = dashboardSource()
    const i = src.indexOf('onEditHr=')
    expect(i, 'the edit control is gone entirely').toBeGreaterThan(-1)
    const handler = src.slice(i, i + 120)
    expect(handler, 'the edit control opens the HR sheet').toContain('setHrSheetOpen(true)')
    expect(handler, 'it must not navigate away from the zones screen').not.toContain('setScreen')
    expect(handler, 'and must not route to a door that no longer exists')
      .not.toContain("'heart-rate'")
  })

  it('🔴 no route to the retired `heart-rate` door survives anywhere', () => {
    // A stale `openSection` value would land on a branch that no longer exists and render
    // the Me index instead, silently. Cheaper to forbid the string than to debug that.
    const offenders = UI().filter(f => code(readFileSync(f, 'utf8')).includes("'heart-rate'"))
    expect(offenders, 'the retired door is still referenced:\n' + offenders.join('\n')).toEqual([])
  })

  it('🔴 the Zones row is tappable in BOTH states', () => {
    // It passed `undefined` when HR was unset, so the one runner who had nothing to read
    // got a dead row — and a subtitle naming the wrong section to go and fix it.
    const src = dashboardSource()
    const i = src.indexOf("'Zones',")
    expect(i, 'the Zones row moved — re-anchor this gate').toBeGreaterThan(-1)
    // 🔴 BOUNDED BY THE CALL, NOT BY A BYTE BUDGET — and the first cut of this arm WAS the
    // budget version. `slice(i, i + 1400)` went red the moment I wrote a long comment
    // inside the row, because the region is measured in characters and the code is not.
    // Same defect as the `slice(i, i + 900)` that passed on BACK-ARROW-FLOAT-03 and the
    // brand-string scan that counted a button 200 chars below. Walk the parens instead.
    const open = src.lastIndexOf('{row(', i)
    expect(open, 'the Zones row is not a row() call any more').toBeGreaterThan(-1)
    let depth = 0, close = open
    for (let k = open + 1; k < src.length; k++) {
      if (src[k] === '(') depth++
      else if (src[k] === ')') { depth--; if (depth === 0) { close = k; break } }
    }
    const row = code(src.slice(open, close))
    expect(row, 'the unset state must still open something').not.toMatch(/:\s*undefined\s*,?\s*$/)
    expect(row, 'unset opens the HR sheet directly').toContain('onOpenZones?.(undefined, true)')
    expect(row, 'the set state still opens the zones screen').toContain('onOpenZones?.()')
  })

  it('🔴 no runner-facing string sends the runner to a named section for HR', () => {
    // The previous copy said "under Setup" and the door was under **Your training**.
    // Measured, live, and the fourth instance of a remedy applied to the wrong destination.
    const src = dashboardSource()
    const bad = src.split('\n')
      .map((l, i) => [i + 1, l] as const)
      .filter(([, l]) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
      .filter(([, l]) => /'[^']*\bheart rate\b[^']*\b(under|below|in) (Setup|Your training|Profile)\b/i.test(l))
      .map(([n, l]) => `${n}: ${l.trim().slice(0, 100)}`)
    expect(bad, 'copy names a section for the HR form:\n' + bad.join('\n')).toEqual([])
  })
})
