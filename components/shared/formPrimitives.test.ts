import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * FORM-PRIMITIVES-01 + SHEET-CLOSE-PIN-01 — Design Board, 2026-09-26.
 *
 * The founder asked for the manual run log to be reviewed and for input
 * components to be REUSED with a standard approach. The census found three
 * defects, each with a measurement.
 */
const ROOT = path.resolve(__dirname, '../..')
const walk = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
    return p.endsWith('.tsx') ? [p] : []
  })
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

// ⚠️ POPULATION WALKED, NEVER LISTED, and COMMENTS STRIPPED — the first cut of
// this census matched two `<input` inside the comment that DOCUMENTS the defect
// and reported them as offenders. Fourth time in this repo a check has fired on
// prose describing the bug it guards.
const FILES = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
  .filter(f => !f.includes('.test.'))
const SRC = new Map(FILES.map(f => [f, strip(fs.readFileSync(f, 'utf8'))]))
const rel = (f: string) => path.relative(ROOT, f)

const TEXTAREA_OWNER = path.join(ROOT, 'components/shared/TextArea.tsx')
const SHEET = fs.readFileSync(path.join(ROOT, 'components/shared/Sheet.tsx'), 'utf8')

describe('FORM-PRIMITIVES-01 — the multi-line field has an owner', () => {
  it('🔴 no raw <textarea> outside the primitive', () => {
    // 📐 Four hand-rolled textareas across three files disagreed on **9 of 13**
    // styled properties: two grounds, three radii, four paddings, two border
    // weights, two `resize` values, `--text-primary` on half.
    const offenders: string[] = []
    for (const [f, s] of Array.from(SRC)) {
      if (f === TEXTAREA_OWNER) continue
      for (const m of Array.from(s.matchAll(/<textarea\b/g))) {
        offenders.push(`${rel(f)}:${s.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(offenders, `hand-rolled textarea(s) — use \`TextArea\`:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔴 THE DEFECT THAT MATTERED: every text input clears the iOS zoom threshold', () => {
    // `TextField.tsx`'s own header: "iOS zooms any focused input below 16px and
    // the `maximum-scale=1` viewport then traps the user zoomed in."
    // **The manual log's Notes field was 13px** — on the one screen that is the
    // whole logging path for a runner without Strava.
    //
    // ⚠️ AND IT SURVIVED A RULING AIMED AT IT: `STEPPER-CONTROL-01 (c)` moved
    // the Average HR field ELEVEN LINES ABOVE onto `TextField` for exactly this
    // reason. The remedy was applied to one twin.
    for (const owner of ['TextField.tsx', 'TextArea.tsx']) {
      const src = fs.readFileSync(path.join(ROOT, 'components/shared', owner), 'utf8')
      const size = src.match(/fontSize:\s*'(\d+)px'/)
      expect(size, `${owner} must declare a fontSize`).not.toBeNull()
      expect(Number(size![1]), `${owner}: below 16px iOS zooms and traps`).toBeGreaterThanOrEqual(16)
    }
  })

  it('🔴 the two halves of the field primitive do not drift apart', () => {
    // A single-line and a multi-line field that look different is the defect
    // this pair exists to end. Same ground, same edge, same radius.
    const a = fs.readFileSync(path.join(ROOT, 'components/shared/TextField.tsx'), 'utf8')
    const b = fs.readFileSync(TEXTAREA_OWNER, 'utf8')
    for (const decl of [/border:\s*'1px solid var\(--line\)'/, /borderRadius:\s*'var\(--radius-md\)'/, /var\(--bg-soft\)/]) {
      expect(a, `TextField must carry ${decl}`).toMatch(decl)
      expect(b, `TextArea must match TextField: ${decl}`).toMatch(decl)
    }
    // ⚠️ And a name is required on both, so the compiler stops an unnamed field.
    expect(b).toMatch(/ariaLabel:\s*string(?!\s*\|)/)
  })
})

describe('SHEET-CLOSE-PIN-01 — the one way out does not scroll away', () => {
  it('🔴 the close sits OUTSIDE the scrolling body', () => {
    // 📐 Measured in a browser BEFORE the fix: the close moved **-500px after a
    // 500px scroll**, on all nine sheets. `position: absolute` inside a scroll
    // container scrolls with the content.
    //
    // Bound the region: the close must appear before the body opens.
    const closeAt = SHEET.indexOf('ariaLabel="Close"')
    const bodyAt  = SHEET.indexOf('ref={bodyRef}')
    expect(closeAt, 'the Sheet close has moved — re-anchor this test').toBeGreaterThan(-1)
    expect(bodyAt,  'the scrolling body has gone — the close is back inside the scroller').toBeGreaterThan(-1)
    expect(closeAt, 'the close must render BEFORE the scrolling body, or it scrolls with it')
      .toBeLessThan(bodyAt)
  })

  it('🔴 the panel does not scroll; the body does', () => {
    const panel = SHEET.slice(SHEET.indexOf('ref={panelRef}'), SHEET.indexOf('ref={bodyRef}'))
    expect(panel, 'a scrolling panel is what carried the close away').not.toMatch(/overflowY:\s*'auto'/)
    expect(panel, 'the body must still clip to the 20px corners').toMatch(/overflow:\s*'hidden'/)
    expect(SHEET.slice(SHEET.indexOf('ref={bodyRef}'))).toMatch(/overflowY:\s*'auto'/)
  })

  it('🔴 swipe-to-dismiss reads the SCROLLER, not the panel', () => {
    // ⚠️ THE COUPLING THAT WOULD HAVE BROKEN SILENTLY. The gate exists so a
    // scrolled sheet SCROLLS rather than dismissing — "a runner reading a long
    // zone explanation loses it trying to scroll back up". Left on the panel it
    // would read a permanent 0 and every sheet would dismiss mid-scroll.
    const touch = SHEET.slice(SHEET.indexOf('const onTouchStart'), SHEET.indexOf('const onTouchMove'))
    expect(touch).toMatch(/bodyRef\.current/)
    expect(touch, 'the panel no longer scrolls, so its scrollTop is always 0').not.toMatch(/panelRef\.current/)
  })
})

describe('ICON-EDGE-01 — a call site may not override the edge', () => {
  it('🔴 no inline `border` is passed to an IconButton', () => {
    // 📐 Four steppers in the manual log passed `border: '0.5px solid
    // var(--line)'` INLINE. An inline style beats a class, so `ICON-EDGE-01`'s
    // `1px var(--chrome-edge)` — ruled and shipped the SAME DAY — never landed
    // on them, and 0.5px breaks § 20 outright.
    //
    // NAV-PILL-FLUSH-01's lesson: the gates assert a rule exists with the right
    // values and never that those values WIN.
    const offenders: string[] = []
    for (const [f, s] of Array.from(SRC)) {
      for (const m of Array.from(s.matchAll(/<IconButton[\s\S]{0,600}?\/>/g))) {
        const style = m[0].match(/style=\{\{([^}]*)\}\}/)
        if (style && /\bborder(Radius)?\s*:/.test(style[1]) && !/borderRadius/.test(style[1].replace(/border\s*:/, ''))) {
          if (/\bborder\s*:/.test(style[1])) offenders.push(`${rel(f)}:${s.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(offenders, `IconButton owns its edge — remove the inline border:\n${offenders.join('\n')}`).toEqual([])
  })
})
