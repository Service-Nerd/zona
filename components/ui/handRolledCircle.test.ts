// BACKARROW-WIZARD-01 — nobody re-paints `IconButton` by hand (2026-09-27).
//
// 🔴 THE GAP THIS CLOSES, AND IT IS THE NINTH INSTANCE OF ITS CLASS.
// `GeneratePlanScreen` carried a private `BackBtn`: a 36px circle with a 16px
// glyph and no edge, against the shared owner's 44 / 20 / `--chrome-edge`.
// `ui-patterns.md:3086` has said "`BackButton.tsx` is the single owner. Never
// hand-roll one" throughout, and the founder found it by looking at the screen.
//
// ⚠️ IT SURVIVED TWO SWEEPS AIMED AT EXACTLY IT. `UI-BACKARROW-01` censused
// thirteen back arrows; `ICON-EDGE-01` gave all fifteen circles the chrome edge.
// Both were invisible to it, because `iconButton.markup.test.ts` scans for
// `<IconButton` TAGS — and a hand-rolled `<div>` circle is not one. **A remedy
// applied to one twin, where the second twin was hidden from the guard by the
// guard's own anchor.**
//
// ── SCOPE, DELIBERATELY TIGHT ──────────────────────────────────────────────
// It fires on the primitive's own signature — `IconButton.tsx`'s header states
// its spec as "44 / 44 / 50% / --bg-soft" — carried by something that holds a
// GLYPH or a click. It does NOT sweep every round element:
//
//   • dots, rings and badges are round and are not controls;
//   • `SessionSteps`' 15px ringed "i" is the documented `inlineMark` exception;
//   • `DayGridSelector`'s 44px day circles are round, hold TEXT, and are a
//     different pattern (a selector, not an icon button);
//   • `SessionCompleteCard`'s chip is `999px` on `--bg-soft` and is a stadium
//     TEXT pill — measured, and the reason the glyph/click condition exists.
//
// A gate that fired on those would be switched off within a week, which this
// repo has recorded as equivalent to having no gate at all (NOISE-GATE-01).
// ⚠️ So it will NOT catch a hand-rolled circle painted with some OTHER fill.
// That is a known limit, stated rather than discovered: the fill is what makes
// the match specific enough to be trustworthy.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../..')
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blank)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
  .replace(/^[ \t]*\/\/.*$/gm, '')

/** The two files that are ALLOWED to draw it: the primitive and its wrapper. */
const OWNERS = ['components/ui/IconButton.tsx', 'components/shared/BackButton.tsx']

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

/** `{{ ... }}` style objects painting the primitive's signature. */
export function findHandRolledCircles(src: string): { line: number; why: string }[] {
  const found: { line: number; why: string }[] = []
  for (const m of Array.from(src.matchAll(/\{\{(?:[^{}]|\{[^{}]*\})*\}\}/g))) {
    const style = m[0]
    if (!/borderRadius:\s*'(?:50%|999px)'/.test(style)) continue
    if (!/background:\s*'var\(--bg-soft\)'/.test(style)) continue
    // A circle, not a stadium pill: square-ish box, no left/right padding.
    if (!/(?:width|height):\s*'(\d+)px'/.test(style)) continue
    // Is it a CONTROL? It holds a glyph, or the element takes a click.
    const after = src.slice(m.index! + style.length, m.index! + style.length + 600)
    const before = src.slice(Math.max(0, m.index! - 200), m.index!)
    const isControl = /<svg\b/.test(after) || /onClick=/.test(before) || /onClick=/.test(after.slice(0, 120))
    if (!isControl) continue
    const size = style.match(/(?:width|height):\s*'(\d+)px'/)?.[1]
    found.push({ line: src.slice(0, m.index!).split('\n').length, why: `${size}px round on --bg-soft holding a glyph` })
  }
  return found
}

describe('BACKARROW-WIZARD-01 — IconButton is not re-painted by hand', () => {
  it('🔴 no file outside the owners draws a round --bg-soft control', () => {
    const offenders: string[] = []
    for (const rel of tsxFiles()) {
      if (OWNERS.includes(rel)) continue
      for (const hit of findHandRolledCircles(strip(fs.readFileSync(path.join(ROOT, rel), 'utf8')))) {
        offenders.push(`${rel}:${hit.line} — ${hit.why}. Use <IconButton shape="circle"> or <BackButton>.`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('🔴 the detector FIRES on the exact component that was deleted', () => {
    // The real defect, verbatim from GeneratePlanScreen before 2026-09-27.
    // Falsifying against the incident, not against a case I invented — the
    // hollow-check lesson from /ship § THE DOCUMENTS.
    const real = `
      <Button variant="ghost" size="compact" onClick={onClick} style={{ marginBottom: '4px' }}>
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      </Button>`
    expect(findHandRolledCircles(real)).toHaveLength(1)
    expect(findHandRolledCircles(real)[0].why).toContain('36px')
  })

  it('does NOT fire on a stadium text chip', () => {
    // SessionCompleteCard:112, measured. 999px on --bg-soft, but a TEXT pill.
    const chip = `
      <span style={{ display: 'inline-block', fontSize: '10px', background: 'var(--bg-soft)', padding: '4px 10px', borderRadius: '999px' }}>
        {chipLabel}
      </span>`
    expect(findHandRolledCircles(chip)).toEqual([])
  })

  it('does NOT fire on a round element that is not a control', () => {
    const dot = `<div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--bg-soft)' }} />`
    expect(findHandRolledCircles(dot)).toEqual([])
  })
})
