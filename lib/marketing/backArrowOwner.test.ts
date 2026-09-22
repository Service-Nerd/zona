import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * UI-BACKARROW-01 — `components/shared/BackButton.tsx` is the SINGLE OWNER of
 * the back arrow.
 *
 * THE DEFECT THIS HOLDS SHUT. `ui-patterns.md` § Screen Templates has said for
 * months: *"Full screen, back arrow top-left (44px circle, `--bg-soft` bg)."*
 * A census found **6 of 13** back controls obeying it — two at 36px (below our
 * own documented 44px iOS HIG minimum), two 8px squares on `--accent-soft`,
 * one on `--moss-soft`, and two with no container at all. A documented pattern
 * that half the app ignores is not a pattern; it is a preference somebody
 * wrote down.
 *
 * ⚠️ BOUND THE REGION, NEVER GREP THE FILE. This repo has recorded the
 * substring-bias class four times — a hollow inset-border check, a guard that
 * iterated the array it protected, `toContain('<PlanCalendar')` matching
 * `<PlanCalendarX`, and a test file tripping the coaching guard because its
 * case table named a doctrine path. So this matches a bounded `<button>…
 * </button>` block that cannot contain a nested `<button`, and decides on what
 * is INSIDE that block.
 *
 * ⚠️ WHAT IS DELIBERATELY NOT AN ARROW. A full-width CTA wired to `onBack` and
 * labelled "Back to plan" is a dismiss control, not a navigation arrow. It is
 * governed by S2 (`appReviewWave1.test.ts` — a dismiss is never `--moss`), and
 * catching it here would make this gate fire on ordinary work, which this repo
 * has twice recorded as equivalent to having no gate.
 */

const OWNER = 'components/shared/BackButton.tsx'

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

/** A `<button>…</button>` block with no nested button. */
const BUTTON = /<button\b(?:(?!<button\b)[\s\S])*?<\/button>/g

/** The glyph forms a hand-rolled back arrow takes: an inline svg, or a literal
 *  arrow character in the label. */
const ARROW_GLYPH = /<svg|←|&larr;/

describe('UI-BACKARROW-01 — one owner for the back arrow', () => {
  it('no screen hand-rolls a back arrow', () => {
    const offenders: string[] = []
    for (const f of tsxFiles()) {
      if (f.endsWith(OWNER) || f === `./${OWNER}`) continue
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      for (const m of Array.from(src.matchAll(BUTTON))) {
        const block = m[0]
        if (!/onClick=\{onBack\}/.test(block)) continue
        if (!ARROW_GLYPH.test(block)) continue      // a labelled CTA is S2's
        offenders.push(`${f}: ${block.split('\n')[0].slice(0, 70).trim()}`)
      }
    }
    expect(offenders, 'a back arrow drawn outside BackButton').toEqual([])
  })

  it('the owner draws the DOCUMENTED arrow: 44px circle on --bg-soft', () => {
    const src = readFileSync(join(process.cwd(), OWNER), 'utf8')
    // Substituting each value in, because a rule read past rather than read is
    // how `since === recoveryFreq - 3` degenerated to `since === 0` unnoticed.
    expect(src).toMatch(/width:\s*'44px'/)
    expect(src).toMatch(/height:\s*'44px'/)
    expect(src).toMatch(/borderRadius:\s*'50%'/)
    expect(src).toMatch(/background:\s*'var\(--bg-soft\)'/)
    // It is navigation, not a CTA: never the accent, never moss.
    expect(src).not.toMatch(/var\(--moss/)
    expect(src).not.toMatch(/var\(--accent/)
  })

  it('every screen with a back arrow imports the owner', () => {
    const missing: string[] = []
    for (const f of tsxFiles()) {
      const src = readFileSync(join(process.cwd(), f), 'utf8')
      if (!/<BackButton\b/.test(src)) continue
      if (!/import BackButton from '@\/components\/shared\/BackButton'/.test(src)) missing.push(f)
    }
    expect(missing, 'uses BackButton without importing it').toEqual([])
  })
})
