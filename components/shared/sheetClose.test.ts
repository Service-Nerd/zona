import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * SHEET-CLOSE-OWNER-01 — `Sheet` owns the close and the swipe. No sheet rolls
 * its own.
 *
 * 🔴 WHY. Six sheets hand-rolled THREE different ways out: a bottom sticky
 * full-width "Close", a top-right cross, and on two of them nothing at all
 * besides the scrim. A runner met a different exit from each. Third time in one
 * day a thing every caller needs was left to each caller (`.cta-pill`,
 * `BackButton`, this).
 *
 * 🔴 AND THE PRIMITIVE DREW A DRAG PILL THAT DRAGGED NOTHING. A false affordance
 * shipped inside the shared component, promising a gesture no sheet supported,
 * and every sheet in the app inherited it. Founder, 2026-09-25: *"I want ALL
 * popups we have to be able to swipe down to close them as well as have the
 * cross to close."*
 *
 * ⚠️ The swipe only engages at `scrollTop <= 0`. A sheet scrolled mid-way must
 * SCROLL, not dismiss — otherwise a runner reading a long zone explanation loses
 * it trying to scroll back up. That guard is the reason this is safe on a
 * scrollable panel, and it is asserted here so it cannot be removed as
 * redundant.
 */
const ROOT = path.resolve(__dirname, '../..')
const SHEET = fs.readFileSync(path.join(ROOT, 'components/shared/Sheet.tsx'), 'utf8')

/**
 * 🔴 DERIVED, NEVER LISTED — and this file shipped with the list (2026-09-25).
 *
 * `CONSUMERS` was four hand-typed paths, chosen because their FILENAMES say
 * "Sheet". `app/dashboard/DashboardClient.tsx` renders FOUR of the app's nine
 * sheets and was not among them, so the two Coach sheets kept a sticky
 * full-width "Close" bar and the Log-a-run sheet drew a SECOND cross — the
 * exact defect this file exists to hold shut — while every arm below passed.
 *
 * ⚠️ THE PREDICATE WAS NEVER WRONG. `/>\s*Close\s*</` matches those bars
 * exactly. It was never pointed at the file. **A check is its population as
 * much as its predicate**, and a hand-written population is blind precisely
 * where discovery would have found something. Same class as the `--accent`
 * alias (the checker compared a token name the producer did not use) and
 * TAP-TARGET-FLOOR-01 (the floor arm measured only the compliant population).
 *
 * The founder found it by tapping "This week's load" — after I had reported
 * this item shipped and told him every sheet was covered.
 */
function consumers(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
        if (/from '(\.\/Sheet|@\/components\/shared\/Sheet)'/.test(src) && /<Sheet\b/.test(src)) out.push(rel)
      }
    }
  }
  walk('app'); walk('components')
  return out
}
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
   .replace(/^[ \t]*\/\/.*$/gm, '')

describe('SHEET-CLOSE-OWNER-01', () => {
  it('🔴 the consumer set is DISCOVERED and non-trivial', () => {
    // A derived list that silently returns [] passes every arm below. It must
    // find the sheets that actually exist, and `DashboardClient` by name —
    // because that is the file the hand-written list left out.
    const found = consumers()
    expect(found.length, `sheet consumers found: ${found.join(', ')}`).toBeGreaterThanOrEqual(6)
    expect(found).toContain('app/dashboard/DashboardClient.tsx')
  })

  it('Sheet renders the close itself', () => {
    expect(SHEET, 'Sheet stopped rendering its own close').toMatch(/<IconButton[\s\S]{0,200}ariaLabel="Close"/)
  })

  it('🔴 the drag pill actually drags', () => {
    // It was decoration for the life of the component.
    expect(SHEET, 'no touch handling — the pill is a false affordance again').toMatch(/onTouchStart=\{onTouchStart\}/)
    expect(SHEET).toMatch(/onTouchMove=\{onTouchMove\}/)
    expect(SHEET).toMatch(/onTouchEnd=\{onTouchEnd\}/)
  })

  it('🔴 the swipe yields to scrolling', () => {
    expect(SHEET, 'the scrollTop guard is gone — a scrolled sheet will dismiss ' +
      'instead of scrolling').toMatch(/scrollTop\s*>\s*0/)
  })

  it('the panel tracks the finger and springs back', () => {
    expect(SHEET).toMatch(/translateY\(\$\{dragY\}px\)/)
    // No transition WHILE dragging, or the panel lags the finger.
    expect(SHEET).toMatch(/dragY\s*>\s*0\s*\?\s*'none'/)
  })

  it('🔴 no sheet hand-rolls its own close', () => {
    const offenders: string[] = []
    for (const f of consumers()) {
      const p = path.join(ROOT, f)
      if (!fs.existsSync(p)) continue
      const src = strip(fs.readFileSync(p, 'utf8'))
      if (/ariaLabel="Close"/.test(src)) offenders.push(`${f} renders its own close cross`)
      if (/>\s*Close\s*</.test(src)) offenders.push(`${f} renders its own "Close" button`)
    }
    expect(offenders, `Sheet owns the close:\n${offenders.join('\n')}`).toEqual([])
  })
})
