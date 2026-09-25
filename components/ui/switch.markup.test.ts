import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import Switch from './Switch'

/**
 * SWITCH-PRIMITIVE-01 — Design Board, 2026-09-25. SHIP WITH AMENDMENT.
 *
 * 🔴 WHAT THIS HOLDS SHUT. `ui-patterns.md` specified a 44x26 pill toggle in
 * four bullets and nothing implemented it, so three call sites transcribed it by
 * hand and a fourth (dead) copy used legacy aliases. Then `BUTTON-ARCH-01` put
 * two of them on `<Button>`, where `.btn--regular`'s `min-height: 44px` beats an
 * inline `height: 26px` — measured 26px vs 47px — and the founder saw it as
 * *"run notification toggles look mis shaped"*.
 *
 * ⚠️ RENDER, DO NOT GREP. Earlier gates this week were hollow because they
 * asserted on source text: an inset-border check the card inside satisfied, and
 * a `toContain` true whenever a fixture appeared anywhere in the file. These
 * arms render the component and read the markup it actually produces.
 */
const ROOT = path.resolve(__dirname, '../..')
const CSS = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
const rule = (sel: string) =>
  CSS.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

describe('SWITCH-PRIMITIVE-01', () => {
  it('🔴 announces its state — role=switch + aria-checked, both directions', () => {
    // 🎓 SIERRA'S BOUND, AND IT IS THE REASON THIS COMPONENT EXISTS AT ALL.
    // None of the three live switches carried either attribute. A VoiceOver
    // user heard "Toggle run notifications, button" and could NOT tell whether
    // notifications were on — on the control that decides whether the product
    // may speak to them. That is non-functional, not degraded.
    const on = renderToStaticMarkup(
      React.createElement(Switch, { checked: true, onChange: () => {}, ariaLabel: 'Run notifications' }))
    const off = renderToStaticMarkup(
      React.createElement(Switch, { checked: false, onChange: () => {}, ariaLabel: 'Run notifications' }))
    expect(on).toContain('role="switch"')
    expect(on).toContain('aria-checked="true"')
    expect(off).toContain('aria-checked="false"')
    expect(on).toContain('aria-label="Run notifications"')
    // The state must reach the CLASS too, or the thumb never moves.
    expect(on).toMatch(/class="[^"]*switch--on/)
    expect(off).not.toMatch(/switch--on/)
  })

  it('🔴 the painted box is 26px and carries NO min-height', () => {
    // The whole defect in one assertion. `min-height` on this control is what
    // made a pill render as a square, and it cannot be added back "to satisfy
    // the tap floor" — the floor is the overlay's job, asserted below.
    const s = rule('.switch')
    expect(s, '.switch missing from globals.css').not.toBe('')
    expect(s).toMatch(/height:\s*26px/)
    expect(s).toMatch(/width:\s*44px/)
    expect(s).toMatch(/border-radius:\s*13px/)
    expect(s, 'a min-height on .switch is the original defect').not.toMatch(/min-height/)
  })

  it('🔴 the hit area clears 44px without growing the paint', () => {
    // :262 (44px, iOS HIG) and :1789 (26px pill) are both right. The overlay is
    // how. Same mechanism this board ruled hours earlier for the Apple Health
    // chip: a FILLED control cannot use padding, because padding paints.
    const after = CSS.match(/\.switch::after\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(after, '.switch::after missing — nothing carries the tap target').not.toBe('')
    expect(after).toMatch(/height:\s*44px/)
    expect(after).toMatch(/position:\s*absolute/)
    expect(after).toMatch(/transform:\s*translateY\(-50%\)/)
  })

  it('🔴 no file constructs a switch inline', () => {
    // `ui-patterns.md` § Input Primitives: "Never build a one-off input,
    // toggle, chip, or time entry inline." It said so while giving no component
    // to reach for. Now there is one, so the rule gets a mechanism.
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
        const rel = `${dir}/${e.name}`
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel); continue }
        if (!/\.tsx$/.test(e.name) || e.name.includes('.test.')) continue
        if (rel.endsWith('components/ui/Switch.tsx')) continue
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
        // The switch's signature geometry, typed by hand: a 44-wide, 26-tall
        // box with the 13px pill radius. Bounded to one declaration, never a
        // whole-file grep (this repo has recorded that bias four times).
        for (const m of Array.from(src.matchAll(/width:\s*'44px',\s*height:\s*'26px'/g))) {
          offenders.push(`${rel}:${src.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    walk('app'); walk('components')
    expect(offenders, `a switch built inline instead of using <Switch>:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔴 every live switch is on the primitive, and there are three', () => {
    // A population arm, because TODAY three separate gates read clean while
    // pointed at incomplete sets (sheetClose's hand-written CONSUMERS, the 44px
    // floor arm, the geometry baseline). A count that silently goes to zero
    // passes every arm above it.
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const uses = Array.from(src.matchAll(/<Switch\b/g)).length
    expect(uses, 'the live switch count moved — say which one and why').toBe(3)
    // And the dead one is gone: SmokeToggle had ZERO call sites, residue of a
    // feature CLAUDE.md records as removed from all UI in Phase 1.
    expect(src, 'SmokeToggle is dead code and was deleted').not.toContain('function SmokeToggle')
  })
})
