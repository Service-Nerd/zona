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
