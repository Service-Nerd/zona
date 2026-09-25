// BUTTON-REGRESSION-01 — `Button` is RENDERED and asserted, not grepped.
//
// 🔴 WHY THIS EXISTS, and it is not a nice-to-have. On 2026-09-25 three batches
// moved **90 controls** onto this component and its classes, and the only check
// was `buttonOwnership.test.ts`, which reads SOURCE TEXT and asserts that the
// markup names the right classes. That is a real check and it is the wrong
// question: it cannot tell you whether a button still fires, still disables,
// still carries its label, or still announces itself.
//
// ⚠️ MEASURED BEFORE WRITING THIS: of the 18 files converted that day, exactly
// ONE had a render-level test (`ModifyPlanSheet`), and `Button.tsx` — the thing
// all 90 now depend on — had NONE. The founder asked "we need to be regression
// testing this" and the answer was that we were not.
//
// ⚠️ THE REGRESSION THAT MATTERS MOST IS `busy`. It is the only prop that
// changes BEHAVIOUR rather than appearance: it must disable the button, or a
// second tap fires a second submit. A class-name grep can never see that.
//
// Rendering is `renderToStaticMarkup`, the same mechanism the `*.markup.test.ts`
// family already uses — this repo has no jsdom and needs none for this.

import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import Button, { type ButtonProps } from './Button'

const render = (props: Partial<ButtonProps> = {}) =>
  html(React.createElement(Button, { ...props }, props.children ?? 'Start this run'))

/** The class attribute only — never the whole document, so `btn--primary`
 *  cannot be satisfied by a word in the label. */
const classes = (markup: string): string[] =>
  (markup.match(/class="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean)

describe('Button renders', () => {
  it('renders a real <button> carrying its label', () => {
    const m = render()
    expect(m).toMatch(/^<button\b/)
    expect(m).toContain('Start this run')
    expect(m).toContain('</button>')
  })

  it('defaults to primary + regular without being told', () => {
    // The defaults are what 41 call sites rely on by omission.
    expect(classes(render())).toEqual(expect.arrayContaining(['btn', 'btn--primary', 'btn--regular']))
  })

  it.each([
    ['primary', 'btn--primary'], ['secondary', 'btn--secondary'], ['quiet', 'btn--quiet'],
    ['ghost', 'btn--ghost'], ['soft', 'btn--soft'], ['destructive', 'btn--destructive'],
  ] as const)('variant %s emits exactly %s and no other variant class', (variant, cls) => {
    const cs = classes(render({ variant }))
    expect(cs).toContain(cls)
    // A variant must not leak a second one — that is how a fill and a text
    // colour end up fighting, and it is invisible to a `toContain` check.
    const variants = cs.filter(c => /^btn--(primary|secondary|quiet|ghost|soft|destructive)$/.test(c))
    expect(variants).toEqual([cls])
  })

  it.each([['regular', 'btn--regular', 48], ['compact', 'btn--compact', 44]] as const)(
    'size %s emits %s (%spx, both clearing the 44px floor)', (size, cls, _px) => {
      const cs = classes(render({ size }))
      expect(cs).toContain(cls)
      const sizes = cs.filter(c => /^btn--(regular|compact)$/.test(c))
      expect(sizes).toEqual([cls])
    })

  it('fullWidth is opt-in, not the default', () => {
    expect(classes(render())).not.toContain('btn--full')
    expect(classes(render({ fullWidth: true }))).toContain('btn--full')
  })

  it('🔴 busy DISABLES the button — the one prop that changes behaviour', () => {
    // Without this a busy CTA fires twice: two plan generations, two submits,
    // two charges. No class-name check can see it.
    const m = render({ busy: true })
    expect(m).toContain('disabled=""')
    expect(m).toContain('aria-busy="true"')
    expect(classes(m)).toContain('btn--busy')
  })

  it('busy swaps the label only when a busyLabel is given', () => {
    expect(render({ busy: true })).toContain('Start this run')
    expect(render({ busy: true, busyLabel: 'Starting' })).toContain('Starting')
    expect(render({ busy: true, busyLabel: 'Starting' })).not.toContain('Start this run')
  })

  it('a plain disabled button is disabled and NOT announced as busy', () => {
    const m = render({ disabled: true })
    expect(m).toContain('disabled=""')
    expect(m).not.toContain('aria-busy')
  })

  it('className MERGES with the .btn classes rather than replacing them', () => {
    // A caller passing className must not be able to strip the design.
    const cs = classes(render({ className: 'my-layout' }))
    expect(cs).toContain('my-layout')
    expect(cs).toEqual(expect.arrayContaining(['btn', 'btn--primary']))
  })

  it('passes through type, aria-* and layout style untouched', () => {
    const m = render({ type: 'submit', 'aria-label': 'Start', style: { marginTop: 8 } })
    expect(m).toContain('type="submit"')
    expect(m).toContain('aria-label="Start"')
    expect(m).toContain('margin-top:8px')
  })

  it('🔴 carries NO inline visual styling of its own', () => {
    // The whole point: every visual property belongs to `.btn` in globals.css.
    // If this component ever grows an inline background or radius, the two
    // places are back and the migration is undone.
    const m = render()
    expect(m).not.toMatch(/style="[^"]*(background|border-radius|font-size|color)/)
  })
})
