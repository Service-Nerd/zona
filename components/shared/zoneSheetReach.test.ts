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
