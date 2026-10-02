// BUTTON-MIGRATION-02 batch 7a — the converted controls actually RENDER.
//
// 🔴 WHY A RENDER TEST AND NOT A SOURCE GREP. This migration's own log records the
// defect: a batch converted a control inside a branch, the test passed `offer: null`,
// and **the branch holding one of the two converted controls never rendered** — so the
// conversion was asserted by a grep and verified by nothing. Three of batch 7a's seven
// controls sit behind a condition (`result ?`, `onContact &&`, `!busy &&`), which is
// exactly that shape.
//
// Each arm drives the CONDITION, not just the component, so a converted control that
// has become unreachable fails here rather than reading as converted.
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup as html } from 'react-dom/server'
import FaqScreen from './FaqScreen'

/** Every `<button>` the markup actually contains, with its class list. */
function buttons(markup: string): { cls: string; text: string }[] {
  return Array.from(markup.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)).map(m => ({
    cls: (/class="([^"]*)"/.exec(m[1]!) ?? [, ''])[1]!,
    text: m[2]!.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim(),
  }))
}

describe('BUTTON-MIGRATION-02 batch 7a — converted controls render', () => {
  it('FaqScreen: the contact control renders as a ghost Button, and only when onContact is given', () => {
    const withContact = html(React.createElement(FaqScreen, { onBack: () => {}, onContact: () => {} } as never))
    const found = buttons(withContact).find(b => b.text.includes('Not answered here'))
    expect(found, 'the converted contact control did not render at all').toBeTruthy()
    // The variant is the whole point of the conversion: ghost carries "no fill".
    expect(found!.cls, 'converted control lost its variant class').toContain('btn--ghost')
    expect(found!.cls).toContain('btn')

    // ⚠️ THE OTHER DIRECTION, which is the one the `offer: null` defect needed:
    // without the prop the control must be ABSENT, so a test that forgot to pass
    // it cannot report a conversion it never rendered.
    const without = html(React.createElement(FaqScreen, { onBack: () => {} } as never))
    expect(buttons(without).some(b => b.text.includes('Not answered here')),
      'the control rendered without onContact — this arm can no longer prove reachability').toBe(false)
  })

  it('every rendered control belongs to a primitive family, by EXACT class token', () => {
    const markup = html(React.createElement(FaqScreen, { onBack: () => {}, onContact: () => {} } as never))
    const all = buttons(markup)
    expect(all.length, 'no buttons rendered — the arm would be vacuous').toBeGreaterThan(0)

    // 🔴 `/\bbtn\b/` MATCHES `icon-btn`, BECAUSE A HYPHEN IS A WORD BOUNDARY.
    // My first cut counted this screen's IconButton in BOTH families and the
    // arithmetic came out 3 for 2 controls, which read as "one is hand-rolled"
    // when nothing was. A class list is a set of TOKENS, so test membership on
    // the split, never with a word-boundary regex on the whole attribute.
    const has = (cls: string, token: string) => cls.split(/\s+/).includes(token)

    const btn  = all.filter(b => has(b.cls, 'btn'))
    const icon = all.filter(b => has(b.cls, 'icon-btn'))
    const unowned = all.filter(b => !has(b.cls, 'btn') && !has(b.cls, 'icon-btn'))

    expect(unowned.map(u => u.text),
      'a rendered control is on neither primitive — hand-rolled, and new').toEqual([])
    expect(btn.length, 'no .btn control rendered — the variant arm would be vacuous').toBeGreaterThan(0)
    expect(btn.length + icon.length, 'families must partition the controls, not overlap').toBe(all.length)

    for (const b of btn) {
      expect(b.cls, `a .btn control has no variant: ${JSON.stringify(b.text).slice(0, 40)}`)
        .toMatch(/btn--(primary|secondary|ghost|quiet|destructive|soft)/)
    }
    for (const b of icon) {
      expect(b.cls, `an icon-btn has no size: ${JSON.stringify(b.text).slice(0, 40)}`)
        .toMatch(/icon-btn--(regular|compact|circle)/)
    }
  })
})
