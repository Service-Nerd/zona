import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Section } from './Section'

/**
 * SITE-MEASURE-EDGE — ONE LEFT EDGE DOWN THE PAGE (Design Board, 2026-09-22).
 *
 * Found by the founder on desktop: *"a plan that fits you / in-the-moment
 * coaching / nothing you don't need — those are using the full span of the page,
 * and then everything after that has gone really centralised, it's a bit of a
 * mess."*
 *
 * Measured at 1440px before the board spoke. The content's LEFT EDGE, top to
 * bottom: 168 · 168 · 168 · 168 · 168 · 168 · 358 · 358 · 168 · 358 · 338.
 * **Three distinct left edges, moving four times**, while the header and the
 * footer both sit at 168.
 *
 * 🔴 `ui-patterns.md` gives `--measure-page` its purpose in these words:
 * *"matching the site frame so the content edge stops moving as you scroll."*
 * The page it governs moved it four times. The measure was never the defect —
 * 720px for prose is right, a 1100px line of body text is unreadable. The
 * CENTRING was: `margin: '0 auto'` on a 720 box inside a 1100 frame pushes it
 * 190px inboard of everything else.
 *
 * ⚠️ THIS FILE WAS FIRST WRITTEN AS `.tsx` AND VITEST NEVER RAN IT. The include
 * pattern is `components/**\/*.test.ts`, so the runner reported "No test files
 * found" — a test the runner cannot see is the purest form of a hollow check,
 * and it would have sat green-by-absence forever. Its sibling
 * `planScaleCard.markup.test.ts` is `.ts` with `React.createElement` for the
 * same reason.
 *
 * ⚠️ INVISIBLE AT 375px, where both measures collapse to the gutter. Two founder
 * device passes missed it and a third, on desktop, did not. A viewport is part
 * of a design check's scope, not a detail of how it was run.
 */
const html = (props: Partial<React.ComponentProps<typeof Section>>) =>
  renderToStaticMarkup(
    React.createElement(Section, { ...props, children: React.createElement('p', null, 'x') } as React.ComponentProps<typeof Section>),
  )

/** The max-widths, outermost first, in the order they nest. */
const nesting = (markup: string) =>
  Array.from(markup.matchAll(/max-width:\s*([^;"]+)/g)).map(m => m[1].trim())

describe('Section — the content edge', () => {
  it('a READ section starts where a PAGE section starts', () => {
    // The whole ruling in one assertion: the read column is NESTED inside the
    // page frame, so its left edge is the frame's left edge. Narrow the box, do
    // not move it.
    expect(nesting(html({ width: 'read' }))).toEqual(['var(--measure-page)', 'var(--measure-read)'])
  })

  it('the READ column is not centred — that is what moved the edge', () => {
    const markup = html({ width: 'read' })
    // Bounded to the INNER box. The outer frame is still `margin: 0 auto` and
    // must be: it is what centres the frame itself in the viewport. A file-wide
    // `not.toContain('0 auto')` would fail on correct markup.
    const inner = markup.slice(markup.indexOf('var(--measure-read)') - 120)
    expect(inner).not.toMatch(/max-width:\s*var\(--measure-read\)[^"]*margin:\s*0(px)? auto/)
  })

  it('a PAGE section is unchanged — one frame, no nested box', () => {
    expect(nesting(html({ width: 'page' }))).toEqual(['var(--measure-page)'])
  })

  it('a FULL section still opts out of the frame entirely', () => {
    // `full` is how a band manages its own width (the white spotlight, the
    // proof). Constraining it to the page measure would silently re-inset every
    // full-bleed band on the site.
    expect(nesting(html({ width: 'full' }))).toEqual([])
  })
})
