import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

// ZONES-ZONE-SHEET-GONE-01 — tapping a zone opens its explainer, and the row is tappable.
//
// 🔴 THE DEFECT THIS EXISTS FOR, AND WHY NOTHING CAUGHT IT. `ZONES-SURFACE-01` moved the
// five zone rows from the Me screen to `TrainingZonesScreen` and **did not bring their
// sheet**. The rows arrived as plain `<div>`s: no `onClick`, no cursor, no tap target at
// all, so there was nothing to open and nothing to throw. The founder found it by tapping.
//
// ⚠️ IT SHIPPED WITH A PATTERN ARTIFACT AND A REGISTER ROW. What it did not ship with was
// an assertion that the rows GO anywhere — `/build` §5b ask 2, *what is reached ONLY from
// it?* The sheet was reached only from those rows. Same shape as the chevron that scrolled
// to an element behind a door and did nothing for a day.
//
// ⚠️ Three residues proved it was a move that dropped its passenger, and each is cheap to
// re-check: a dead `ZoneInfoSheet` import in the hub, dead `openZone` state in
// `HRZonesSection`, and that file's comment CLAIMING the sheet had moved.

const SRC = () => readFileSync('components/shared/TrainingZonesScreen.tsx', 'utf8')

const code = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')
     .filter(l => !l.trim().startsWith('//')).join('\n')

describe('ZONES-ZONE-SHEET-GONE-01 — a zone row goes somewhere', () => {
  it('🔴 the zone rows are TAPPABLE, not read-only divs', () => {
    // The whole defect in one assertion: the rows rendered perfectly and did nothing.
    const src = code(SRC())
    const i = src.indexOf('zones!.map')
    expect(i, 'the zone table moved — re-anchor this gate').toBeGreaterThan(-1)
    const table = src.slice(i, i + 1600)
    expect(table, 'a zone row must be a control, not a div').toMatch(/<button\b/)
    expect(table, 'and it must open the explainer for ITS OWN zone').toContain('setOpenZone(z.zone')
  })

  it('🔴 the explainer is actually MOUNTED, not merely imported', () => {
    // `DashboardClient` imported ZoneInfoSheet and rendered it nowhere for a day. An import
    // is not a mount, and the difference is invisible in a diff.
    const src = code(SRC())
    expect(src, 'ZoneInfoSheet is not rendered here').toMatch(/<ZoneInfoSheet\b/)
    expect(src, 'the open state must be able to close again').toContain('setOpenZone(null)')
  })

  it('🔴 every zone the table can render has a key the sheet accepts', () => {
    // A mapping that covers 1-4 and drops 5 would open an empty sheet for one zone only —
    // the quiet half-failure this codebase keeps producing. Assert all five are mapped.
    const src = code(SRC())
    const i = src.indexOf('const zoneKey')
    expect(i, 'the zoneKey mapping is gone').toBeGreaterThan(-1)
    const map = src.slice(i, i + 260)
    for (const k of ["'Z1'", "'Z2'", "'Z3'", "'Z4-5'", "'Z5'"]) {
      expect(map, `zone key ${k} is not reachable`).toContain(k)
    }
  })

  it('🔴 the HR row and its PACE twin carry the SAME border treatment', () => {
    // 🔴 THE FOUNDER FOUND THIS ON A DEVICE: *"look inconsistent with the pace cards."*
    // Making the HR row a `<button>` to restore the tap changed its BOX. The style read
    // `borderTop: '1px solid var(--line)'` … then `border: 'none'` — a SHORTHAND, which
    // resets it — then `borderTopStyle: 'solid'`, which re-enabled a top border with the
    // DEFAULT width (medium) and DEFAULT colour (`currentColor` = `--ink`). Thick black
    // separators on one tab, hairlines on the other.
    //
    // ⚠️ AND THE GATE WHOSE ENTIRE PURPOSE IS THIS COULD NOT SEE IT. `buttonGeometry`
    // exists because "a conversion may change a button's COLOUR, never its BOX" — but
    // `measureAll()` only reads controls on the design system, and its own comment in THIS
    // FILE says the hand-rolled `<button>`s here are deliberately outside it. So the
    // absolute-measurement gate is blind by construction, and the right check is a
    // RELATIVE one: the two branches render the same row and must agree.
    const src = readFileSync('components/shared/TrainingZonesScreen.tsx', 'utf8')
    // 🔴 BOUNDED BY THE `style={{ … }}` OBJECT, NOT BY A BYTE BUDGET. The first cut of this
    // arm used `slice(i, i + 900)` and went red the instant I wrote the explanatory comment
    // above — the comment pushed the style past 900 characters. That is the THIRD character
    // budget I have written today and the third time it has measured the wrong thing.
    // A region measured in bytes is not a region.
    const borders = (marker: string) => {
      const i = src.indexOf(marker)
      expect(i, `${marker} moved — re-anchor this gate`).toBeGreaterThan(-1)
      const styleAt = src.indexOf('style={{', i)
      expect(styleAt, `${marker} has no style object after it`).toBeGreaterThan(-1)
      let depth = 0, end = styleAt
      for (let k = src.indexOf('{', styleAt); k < src.length; k++) {
        if (src[k] === '{') depth++
        else if (src[k] === '}') { depth--; if (depth === 0) { end = k; break } }
      }
      const region = code(src.slice(styleAt, end + 1))
      return {
        top: /borderTop:\s*i \? '([^']+)' : '([^']+)'/.exec(region)?.slice(1, 3) ?? null,
        // a longhand AFTER the shorthand is the defect itself
        resetAfterTop: region.indexOf("border: 'none'") > region.indexOf('borderTop:'),
        hasStyleLonghand: /borderTopStyle/.test(region),
      }
    }
    const hr = borders('zones!.map')
    const pace = borders('paceRows(pace!).map')
    expect(hr.top, 'the HR row lost its border declaration').toBeTruthy()
    expect(hr.top, 'the HR row and the pace row must declare the SAME border')
      .toEqual(pace.top)
    expect(hr.resetAfterTop, 'the `border` shorthand sits AFTER `borderTop` and resets it')
      .toBe(false)
    expect(hr.hasStyleLonghand, 'borderTopStyle re-enables a DEFAULT-width, currentColor border')
      .toBe(false)
  })

  it('🔴 no dead residue of the old location survives', () => {
    // All three, because each one on its own reads as tidy-up and together they were the
    // evidence. A residue left behind is how the next reader concludes it still works.
    const files = execSync("git ls-files 'app/**/*.tsx' 'components/**/*.tsx'",
      { encoding: 'utf8' }).trim().split('\n').filter(f => f && !f.includes('.test.'))
    expect(files.length, 'the scan lost its subject').toBeGreaterThan(50)
    const offenders: string[] = []
    for (const f of files) {
      if (f === 'components/shared/TrainingZonesScreen.tsx') continue
      if (f === 'components/shared/ZoneInfoSheet.tsx') continue
      const src = code(readFileSync(f, 'utf8'))
      const importsIt = /import ZoneInfoSheet/.test(src)
      const rendersIt = /<ZoneInfoSheet\b/.test(src)
      if (importsIt && !rendersIt) offenders.push(`${f}: imports ZoneInfoSheet and never renders it`)
      if (/setOpenZone\b/.test(src) && !/<ZoneInfoSheet\b/.test(src)) {
        offenders.push(`${f}: holds openZone state with no sheet to open`)
      }
    }
    expect(offenders, 'a handle left behind for a surface that moved:\n' + offenders.join('\n'))
      .toEqual([])
  })
})
