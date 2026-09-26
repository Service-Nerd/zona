import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import NavTab from './NavTab'
import { Z_LAYERS } from '../../lib/ui/zLayers'

/**
 * NAV-SLIM-01 — Design Board, 2026-09-25. SHIP.
 *
 * 🔴 WHAT THIS HOLDS SHUT. `ui-patterns.md` § 7 has specified "Height: 60px +
 * safe area inset" and an `0.6875rem` label for months. The bar shipped at 64px
 * with a 12px label, because its tabs were `<Button variant="ghost">` and
 * `.btn--regular`'s `min-height: 44px` — a CTA's tap floor — governed the
 * chrome. The founder asked for a slimmer nav repeatedly and the answer was
 * already written down.
 *
 * ⚠️ AND THE BAR WAS MOSTLY DEAD SPACE: 10px pad + 44px button + 10px pad, so
 * only 44 of 64 (**69%**) was tappable. The padding moved into the tab, which
 * takes the bar DOWN 4px and the target UP 16px. Both are asserted, because
 * shaving the padding alone would pass a height check and make the nav worse.
 */
const ROOT = path.resolve(__dirname, '../..')
const CSS = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
const rule = (sel: string) => CSS.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

describe('NAV-SLIM-01', () => {
  it('🔴 the bar is 60px of chrome, and ALL of it is the tap target', () => {
    const bar = rule('.nav-bar')
    const tab = rule('.nav-tab')
    expect(bar, '.nav-bar missing from globals.css').not.toBe('')
    expect(tab, '.nav-tab missing from globals.css').not.toBe('')

    // The token is the single source of the height.
    expect(CSS).toMatch(/--nav-h:\s*60px/)
    expect(tab).toMatch(/min-height:\s*var\(--nav-h\)/)

    // 🔴 THE BAR CONTRIBUTES NO VERTICAL PADDING OF ITS OWN. This is the arm
    // that makes the tap target equal the bar height. A `padding: Npx 0` here
    // is the original defect returning: bar taller, target unchanged.
    const padding = bar.match(/padding:\s*([^;]*)/)?.[1] ?? ''
    expect(padding, '.nav-bar must declare a padding').not.toBe('')
    expect(padding, 'the bar pads vertically again — that height is not tappable')
      .toMatch(/^0\s+0\s+env\(safe-area-inset-bottom/)
  })

  it('🔴 a CTA tap floor never governs chrome again', () => {
    // `.btn--regular`'s 44px is right for a button and wrong for furniture.
    // Both Button sizes carry it, which is why NavTab is its own primitive.
    const tab = rule('.nav-tab')
    expect(tab, 'a hardcoded min-height on .nav-tab bypasses the token')
      .not.toMatch(/min-height:\s*\d+px/)
    const src = fs.readFileSync(path.join(ROOT, 'components/ui/NavTab.tsx'), 'utf8')
    expect(src, 'NavTab must not route through Button — both its sizes floor at 44px')
      .not.toMatch(/from '@\/components\/ui\/Button'/)
  })

  it('🔴 the label is the documented 0.6875rem (11px)', () => {
    expect(rule('.nav-tab')).toMatch(/font-size:\s*11px/)
    // § 20: "Always 1px borders not 0.5px". The bar shipped 0.5px.
    expect(rule('.nav-bar')).toMatch(/border-top:\s*1px solid var\(--line\)/)
  })

  it('🔴 renders as a real button when interactive, and inert when it is a mirror', () => {
    const live = renderToStaticMarkup(React.createElement(NavTab, {
      label: 'Today', icon: null, active: true, onClick: () => {} }))
    const mirror = renderToStaticMarkup(React.createElement(NavTab, {
      label: 'Today', icon: null, active: true }))
    expect(live).toContain('<button')
    expect(live).toContain('aria-current="page"')
    expect(live).toMatch(/class="[^"]*nav-tab--active/)
    // A mirror is a PICTURE of the nav. Rendering four dead buttons would put
    // them in the tab order and offer them to a screen reader.
    expect(mirror).not.toContain('<button')
    expect(mirror).toContain('aria-hidden')
  })

  it('🔴 both renderers map ONE source — the mirror cannot drift again', () => {
    // The GuideSheet mirror listed `strava` (tab retired in Phase 1) and omitted
    // `me`, so it taught a nav that had not existed for months and highlighted
    // nothing when it fired for Me. Editing the string would have fixed the
    // symptom; this asserts the mechanism.
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const decls = Array.from(src.matchAll(/const NAV_ITEMS[^=]*=/g)).length
    expect(decls, 'NAV_ITEMS must be declared exactly once').toBe(1)
    expect(Array.from(src.matchAll(/NAV_ITEMS\.map/g)).length,
      'both the real bar and the GuideSheet mirror must map NAV_ITEMS').toBe(2)
    expect(src, 'a second hand-written nav list is back').not.toMatch(/NAV_SCREENS|NAV_LABELS/)
    expect(src, "the nav must not list Strava — its tab was removed in Phase 1")
      .not.toMatch(/label: 'Strava'/)
  })

  it('🔴 the pill is geometry from TOKENS, and the float gap is not padding', () => {
    // NAV-FLOAT-01 — Design Board, ruled SHIP twice. Opaque: NAV-TRANSLUCENT-01
    // was killed ON THE PALETTE (white at 0.75 is a 5-level change over
    // `--bg`), and NAV-COLLAPSE-01 killed permanently by the founder.
    const f = rule('.nav-bar--floating')
    expect(f, '.nav-bar--floating missing from globals.css').not.toBe('')
    expect(f, 'the inset must come from a token, never a literal').toMatch(/var\(--nav-pill-inset\)/)
    expect(f, 'the lift must come from a token, never a literal').toMatch(/var\(--nav-pill-lift\)/)
    expect(f).toMatch(/border-radius:\s*999px/)
    // ⚠️ The flush bar SPENT the safe-area inset as its own reserved strip. A
    // pill sits ABOVE that strip, so padding it again double-counts.
    expect(f).toMatch(/padding-bottom:\s*0/)
    // 🔴 OPAQUE. A translucent value here reverses a ruling made on a
    // measurement, and this is the arm that would have to be deleted to do it.
    expect(f, 'the pill is opaque — NAV-TRANSLUCENT-01 was killed on the palette')
      .not.toMatch(/backdrop-filter|rgba\(255/)
  })

  it('🔴 the nav publishes its OCCLUSION, not its element height', () => {
    // 🔴 THE ASSUMPTION THE PILL BREAKS. `bottomNavH` fed `Sheet`'s maxHeight and
    // the scroll container's reserve by reading
    // `getBoundingClientRect().height` — correct for exactly as long as the nav
    // was FLUSH, because then its height WAS the band it covered. The pill is
    // 62px tall and occludes 74px. Measured in a browser: element 62, occlusion
    // 74, float gap 12.
    //
    // ⚠️ AND THE `+16` SLACK IN THE RESERVE WOULD HAVE HIDDEN IT — the app would
    // have looked right by accident while every Sheet was 12px too tall. That is
    // worse than a visible break.
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const i = src.indexOf('const bottomNavRef')
    const block = src.slice(i, i + 1400)
    expect(block, 'the nav height must be measured from the viewport bottom')
      .toMatch(/window\.innerHeight - r\.top/)
    expect(block, 'reading the element height under-reserves by the float gap')
      .not.toMatch(/const h = Math\.ceil\(node\.getBoundingClientRect\(\)\.height\)/)
  })

  it('🔴 a sheet still covers the pill — the popup seam (founder condition 2)', () => {
    // § 6i / S1 ruled that slide-up sheets COVER the nav, and the measured
    // finding there was that a nav icon under a sheet DISMISSED instead of
    // navigating. A floating pill changes the geometry — inset and lifted — so
    // the seam was re-verified in a browser: the scrim (z 4000) spans the pill
    // (z 3000), the opaque panel paints over it, and a tap at the pill's centre
    // lands on the scrim. Unchanged from the flush bar.
    //
    // This arm holds the INVARIANT that makes that true, since a DOM stack
    // cannot be asserted from source.
    expect(Z_LAYERS.sheet).toBeGreaterThan(Z_LAYERS.nav)
    const sheet = fs.readFileSync(path.join(ROOT, 'components/shared/Sheet.tsx'), 'utf8')
    expect(sheet, 'the scrim must span the viewport or it stops covering the nav')
      .toMatch(/position: 'fixed', inset: 0, zIndex: Z_LAYERS\.sheet/)
  })

  it('🔴 BOTH renderers are pills — the guide mirror cannot drift again', () => {
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    expect(Array.from(src.matchAll(/nav-bar nav-bar--floating/g)).length,
      'the real bar and the GuideSheet mirror must both be pills').toBe(2)
  })

  it('🔴 the nav renders on EXACTLY the four screens it has tabs for', () => {
    // Founder's condition 1: "ensure it works whilst used on all of our screens."
    // There are 15 screens in the router and 4 carry the nav. The guard and
    // NAV_ITEMS are two hand-maintained lists of the same thing — the class of
    // drift that made the GuideSheet mirror show a retired `strava` tab — so
    // they are compared to each other rather than each being asserted alone.
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const items = Array.from(src.matchAll(/\{ id: '([a-z]+)',\s*label:/g)).map(m => m[1]).sort()
    const guardLine = src.split('\n').find(l => l.includes('appReady && (screen ==='))
    expect(guardLine, 'the nav render guard has moved — re-anchor this').toBeTruthy()
    const guarded = Array.from(guardLine!.matchAll(/screen === '([a-z-]+)'/g)).map(m => m[1]).sort()
    expect(items.length, 'NAV_ITEMS should carry four tabs').toBe(4)
    expect(guarded, 'the render guard and NAV_ITEMS must name the same screens').toEqual(items)
  })

  it('🔴 the marketing replicas still encode the same height', () => {
    // The consumer check that inverted the brief: the WEBSITE was right all
    // along (`PhoneShell.NAV_H = 60`, correct tabs) and the APP had drifted to
    // 64. Slimming closed a divergence rather than creating one — and this arm
    // is what stops the app drifting away from the site again.
    const shell = fs.readFileSync(path.join(ROOT, 'components/marketing/PhoneShell.tsx'), 'utf8')
    expect(shell, 'the marketing phone mock no longer encodes a 60px nav')
      .toMatch(/NAV_H\s*=\s*60/)
  })
})
