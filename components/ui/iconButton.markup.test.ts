// ICON-BUTTON-01 — `IconButton` is RENDERED, per BUTTON-REGRESSION-01's rule
// that a class-name grep is not a regression test.

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import fs from 'node:fs'
import path from 'node:path'
import IconButton from './IconButton'
import BackButton from '../shared/BackButton'

const ROOT = path.resolve(__dirname, '../..')
/** Comments blanked, newlines preserved — a guard that fires on prose describing
 *  the bug it guards gets switched off, which this repo records twice over. */
const blankOut = (m: string) => m.replace(/[^\n]/g, '')
const strip = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, blankOut)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, blankOut)
  .replace(/^[ \t]*\/\/.*$/gm, '')
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

const render = (props: Partial<React.ComponentProps<typeof IconButton>> = {}) =>
  html(React.createElement(IconButton, {
    icon: React.createElement('span', { 'aria-hidden': true }, '✕'),
    ariaLabel: 'Close',
    ...props,
  }))
const classes = (m: string) => (m.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)

describe('IconButton renders', () => {
  it('🔴 always carries its accessible name — the whole reason it exists', () => {
    expect(render()).toContain('aria-label="Close"')
  })

  it('defaults to type=button so it cannot submit a form by accident', () => {
    expect(render()).toContain('type="button"')
  })

  it.each([['circle'], ['square'], ['bare']] as const)('shape %s emits exactly one shape class', (shape) => {
    const cs = classes(render({ shape }))
    expect(cs).toContain(`icon-btn--${shape}`)
    expect(cs.filter(c => /^icon-btn--(circle|square|bare)$/.test(c))).toEqual([`icon-btn--${shape}`])
  })

  it('🔴 takes the 44px floor unless it is the inline-mark exception', () => {
    expect(classes(render())).toContain('icon-btn--regular')
    const inline = classes(render({ inlineMark: true }))
    expect(inline).toContain('icon-btn--inline-mark')
    expect(inline, 'an inline mark must not also claim the 44px box').not.toContain('icon-btn--regular')
  })

  it('carries no inline visual styling of its own', () => {
    expect(render()).not.toMatch(/style="[^"]*(background|border-radius)/)
  })

  it('🔴 BackButton still draws the documented arrow THROUGH this primitive', () => {
    // The refactor's actual risk: BackButton is the app's one back arrow and
    // its contract is unchanged. A wrapper that stopped producing a 44px
    // circle with a name would be a silent regression on every screen.
    const m = html(React.createElement(BackButton, { onClick: () => {} }))
    expect(m).toContain('aria-label="Back"')
    expect(classes(m)).toEqual(expect.arrayContaining(['icon-btn', 'icon-btn--circle', 'icon-btn--regular']))
    expect(m, 'the chevron path changed').toContain('M13 4L7 10L13 16')
  })

  it('BackButton keeps its overridable label', () => {
    expect(html(React.createElement(BackButton, { onClick: () => {}, ariaLabel: 'Back to plan' })))
      .toContain('aria-label="Back to plan"')
  })

  it('🔴 an inlineMark paints its ring on the GLYPH, never on the button', () => {
    // 🔴 THE DEFECT: `.icon-btn--inline-mark` carries `padding: 16.5px` to make
    // the 44px target, and the call site put `border` + `width: 15px` on the
    // BUTTON. Under `box-sizing: border-box` a border paints around the PADDED
    // box, so the ring drew around the 44px hit area — a circle ~25pt across,
    // overlapping the label beside it. The ruling is "15px VISUAL, 44px TARGET";
    // the border was on the target.
    //
    // ⚠️ SAME CLASS AS THE NAV PILL THE SAME MORNING: a visual property set on
    // the element that also carries the geometry. **When the visual and the hit
    // area are different sizes they must be different elements.** That is the
    // rule this arm holds, not the specific pixel values.
    const offenders: string[] = []
    for (const f of tsxFiles()) {
      const src = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'))
      for (const m of Array.from(src.matchAll(/<IconButton\b(?:(?!\/>|<IconButton)[\s\S])*?\/>/g))) {
        const tag = m[0]
        if (!/\binlineMark\b/.test(tag)) continue
        // Only the `style={{...}}` that belongs to the BUTTON — the icon's own
        // style lives inside `icon={...}` and is exactly where these belong.
        const btnStyle = tag.match(/(?:^|\s)style=\{\{([\s\S]*?)\}\}/)?.[1] ?? ''
        for (const prop of ['border', 'width', 'height', 'borderRadius', 'background']) {
          if (new RegExp(`(^|[\\s,{])${prop}\\s*:`).test(btnStyle)) {
            const line = src.slice(0, m.index).split('\n').length
            offenders.push(`${f}:${line} — \`${prop}\` on an inlineMark BUTTON paints around its 44px target, not the mark`)
          }
        }
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })
})

/**
 * ICON-EDGE-01 — Design Board, 2026-09-26. SHIP WITH AMENDMENT (3).
 *
 * Founder: *"The back arrows that we use and close cross — can we bring those
 * inline with our nav bar visual? I.e. opaque, edge, contrast."*
 *
 * 📐 THE MEASUREMENT THAT MADE IT A DECISION RATHER THAN A PREFERENCE.
 * `--bg-soft` separates from `--bg` by **7.7 levels** and from `--card` by 23.3,
 * and **13 of the 15 circles sit on a header, which is `--bg`.** So on the
 * ground that matters the surface was doing LESS than the warm nav tint the
 * founder was shown and could not see (10 levels). The edge does **29.7 / 32.0**,
 * against both grounds.
 *
 * ⚠️ AND IT FINISHES AN OLD RULING RATHER THAN MAKING A NEW ONE. `:191`:
 * *"If a card needs emphasis, it is an inset: `--bg-soft` + ONE HAIRLINE."*
 * This control shipped the inset and forgot the hairline.
 *
 * ⛔ NO ELEVATION — `:242` and `:359`. Collins argued for the nav's full grammar
 * and LOST on the record: the nav is elevated because it floats above content
 * and an icon button sits in a surface.
 */
describe('ICON-EDGE-01', () => {
  const CSS = fs.readFileSync(path.resolve(__dirname, '../../app/globals.css'), 'utf8')
  const rule = (sel: string) => CSS.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

  it('🔴 a surfaced shape carries the shared chrome edge, and bare does not', () => {
    for (const shape of ['circle', 'square']) {
      expect(rule(`.icon-btn--${shape}`), `${shape} must carry the edge`)
        .toMatch(/border:\s*1px solid var\(--chrome-edge\)/)
      expect(rule(`.icon-btn--${shape}`), 'the fill does not change — :860 stands')
        .toMatch(/background:\s*var\(--bg-soft\)/)
    }
    // ⛔ Wroblewski's condition. All five `bare` uses are inline controls in
    // dense rows, where a surface is noise. An edge here would make it a third
    // shape wearing the first one's clothes.
    expect(rule('.icon-btn--bare'), 'bare is surfaceless BY DESIGN')
      .toMatch(/border:\s*none/)
    expect(rule('.icon-btn--bare')).not.toMatch(/var\(--chrome-edge\)/)
  })

  it('🔴 it is the SHARED token, not a literal and not a second weight', () => {
    // The whole point of the rename: the nav, the pinned headers and these
    // controls answer "this is chrome" the same way, so tuning it is one edit.
    expect(CSS, 'the token must be declared').toMatch(/--chrome-edge:\s*rgba\([^)]+\)/)
    for (const shape of ['circle', 'square']) {
      expect(rule(`.icon-btn--${shape}`), 'a literal here re-forks what the rename just merged')
        .not.toMatch(/border:\s*1px solid rgba\(/)
    }
    // And it must still be the same edge the nav uses — one weight, or the
    // families drift again under the merged name, which is worse than two names.
    const navEdge = rule('.nav-bar--floating').match(/border:\s*1px solid var\((--[\w-]+)\)/)?.[1]
    expect(navEdge, 'the nav must draw its edge from the same token').toBe('--chrome-edge')
  })

  it('🔴 NO ELEVATION on an icon button — :242 / :359, and Collins predicted this', () => {
    // He said someone would add the shadow in six weeks, so the ruling is a test
    // rather than a sentence in a comment.
    for (const shape of ['circle', 'square', 'bare']) {
      expect(rule(`.icon-btn--${shape}`), `${shape}: elevation means floating ABOVE content; this sits IN a surface`)
        .not.toMatch(/box-shadow/)
    }
    expect(rule('.icon-btn')).not.toMatch(/box-shadow/)
  })

  it('🔴 the 44px floor is untouched — the border paints INSIDE it', () => {
    // `box-sizing: border-box` is app-wide, so a 1px border does not shrink the
    // target. Asserted because this repo has TWICE shipped a visual property on
    // the element that also carries the geometry (SESSION-INFO-MARK-01, and the
    // ring before it).
    expect(CSS, 'border-box is what makes this safe').toMatch(/box-sizing:\s*border-box/)
    expect(rule('.icon-btn--regular')).toMatch(/min-width:\s*44px/)
    expect(rule('.icon-btn--regular')).toMatch(/min-height:\s*44px/)
    // A fixed width/height would let the border eat the target instead.
    expect(rule('.icon-btn--regular'), 'a floor, never a fixed box')
      .not.toMatch(/(^|[^-])\bwidth:\s*44px/)
  })
})
