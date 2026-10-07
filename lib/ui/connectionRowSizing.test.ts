// CONNECTIONS-ROW-TWIN-01 — two controls in one settings row share a size system.
//
// 🔴 MEASURED AT 375px: `Disconnect` rendered **99x44** beside `Connect` at
// **88x29** — 52% taller, and every geometry property differed (font 12 vs 11,
// padding 12/16 vs 8/14, radius 10 vs 8, min-height 44 vs 0).
//
// ⚠️ AND BOTH PASSED EVERY EXISTING CHECK. `buttonGeometry.test.ts` has arms for
// the 44px floor, the committed baseline, coverage and border growth — all
// PER CONTROL. Disconnect cleared the floor; Connect is a ruled exception with a
// 44px `::after` hit area. **Each was correct alone.** The defect is a
// RELATIONSHIP between two controls, and no per-control arm can see one.
//
// 🔴 THE REMEDY HAD ALREADY BEEN RULED AND WAS APPLIED TO ONE TWIN.
// `.btn--inline-target` exists because the founder said, on 2026-09-25, that the
// Apple Health Connect looked *"fat compared to the strava connect one"*. The fix
// reached both CONNECT buttons and never reached DISCONNECT, in the same row.
// Eight instances of that class are recorded in this repo's catalogue.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/**
 * The population is DERIVED from the screen, never hand-listed: read MeScreen's
 * Connections section and take the components it actually renders. A hand-typed
 * list is the failure this repo has recorded more than any other — a third
 * connection row added later would simply not be checked.
 */
const ME = strip(read('components/dashboard/MeScreen.tsx'))
const SECTION = ME.slice(ME.indexOf('Where your runs come from'))
const ROWS = Array.from(new Set(
  Array.from(SECTION.slice(0, 900).matchAll(/<([A-Z][A-Za-z0-9]*ConnectionRow)\b/g)).map(m => m[1]!),
))


/** A component's source, whether it has its own file or is declared in MeScreen. */
function bodyOf(name: string): string {
  try { return read(`components/dashboard/${name}.tsx`) } catch { /* declared inline */ }
  const i = ME.search(new RegExp(`function\\s+${name}\\b`))
  if (i < 0) throw new Error(`cannot resolve ${name} — not a file and not a function in MeScreen`)
  // to the next top-level `function ` declaration
  const rest = ME.slice(i + 1)
  const j = rest.search(/\nfunction\s/)
  return j < 0 ? rest : rest.slice(0, j)
}

describe('CONNECTIONS-ROW-TWIN-01 — one row, one size system', () => {
  it('the population is derived and non-empty', () => {
    expect(ROWS.length, 'no *ConnectionRow components found in the Connections section — the ' +
      'matcher has drifted from MeScreen and this file checks nothing').toBeGreaterThanOrEqual(2)
  })

  it('every Button in a connection row is an inline-target chip', () => {
    const offenders: string[] = []
    for (const name of ROWS) {
      // ⚠️ THE TWO ROWS DO NOT LIVE IN THE SAME PLACE, which is plausibly how they
      // drifted: `AppleHealthConnectionRow` is its own file, `StravaConnectionRow`
      // is a function inside `MeScreen`. So the body is resolved wherever it is,
      // rather than assuming a filename — a path assumption would have made this
      // check throw on the second row and pass on a partial population.
      const src = strip(bodyOf(name))
      for (const m of Array.from(src.matchAll(/<Button\b[^>]*>/g))) {
        const tag = m[0]
        if (!tag.includes('btn--inline-target')) {
          offenders.push(`${name}: ${tag.replace(/\s+/g, ' ').slice(0, 110)}`)
        }
      }
    }
    expect(offenders, `${offenders.length} button(s) in a connection row are not on the chip size ` +
      'system. A settings row is one line of text with an action at its end; the action is a chip ' +
      '(ui-patterns §38). `size="compact"` renders 44px beside its 29px sibling.').toEqual([])
  })

  it('and the chip carries its OWN typography, so a call site need not re-declare it', () => {
    // 🔴 `.btn--inline-target` set `position` and `min-height` and nothing else,
    // so Silvanto's "11px uppercase" lived as an inline style at every call site
    // — which is how one row ended up with `Disconnect` in sentence case beside
    // `CONNECT` in caps. A class that cannot carry its species forces drift.
    const css = read('app/globals.css')
    const block = css.slice(css.indexOf('.btn--inline-target {'), css.indexOf('.btn--inline-target::after'))
    for (const prop of ['font-size', 'text-transform', 'letter-spacing', 'border-radius', 'padding']) {
      expect(block.includes(prop), `.btn--inline-target does not set ${prop}, so every call site must ` +
        'declare it inline and they will diverge').toBe(true)
    }
  })
})
