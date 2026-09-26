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
    // ⚠️ THE RADIUS MOVED TO A TOKEN and this arm followed it rather than being
    // dropped. The founder asked twice whether the corners are too round, so the
    // value has to be dial-able — but it must still come from a token, not a
    // literal typed into the class.
    expect(f).toMatch(/border-radius:\s*var\(--nav-pill-radius\)/)
    expect(CSS, 'the radius token must be declared').toMatch(/--nav-pill-radius:\s*\S+/)
    // 📐 And the GAP is the thing that was actually wrong: `calc(lift + inset)`
    // put it 46pt up on a home-indicator iPhone against the reference's 21.
    // `max()` tucks into the safe-area strip on devices that have one.
    expect(f, 'adding the lift to the inset is the 46pt defect')
      .not.toMatch(/calc\(var\(--nav-pill-lift\) \+ env/)
    expect(f).toMatch(/bottom:\s*max\(var\(--nav-pill-lift\)/)
    // ⚠️ The flush bar SPENT the safe-area inset as its own reserved strip. A
    // pill sits ABOVE that strip, so padding it again double-counts.
    expect(f).toMatch(/padding-bottom:\s*0/)
    // 🔴 OPAQUE — AND THIS ARM HAS NOW BEEN THROUGH THE FULL CYCLE, which is
    // why it is worth reading rather than trusting.
    //   1. It asserted the pill was opaque (board: DON'T SHIP on a measurement).
    //   2. It went red when the founder OVERRULED that, and was UPDATED to
    //      assert the shape of the translucency instead.
    //   3. He then looked at an A/B of the two materials and said *"I don't see
    //      any difference."* **The board's original ruling is confirmed by the
    //      eye rather than by arithmetic**, and the arm returns to opaque.
    //
    // 📐 THE DURABLE FINDING, so this is not re-proposed a fourth time: `--bg`
    // sits BETWEEN white and any AA-safe darker tint. A fill lighter than the
    // ground vanishes on cards; darker vanishes on the ground. Best case for
    // ANY single fill is **10 levels vs the ground, 8 vs a card**; the absolute
    // AA ceiling is 21 vs a card but **3** vs the ground. Ten levels is ~3%.
    //
    // ⚠️ And the fill was never the thing: the BORDER separates by **17 levels
    // over the ground and 18 over a card**, against both, which is why an opaque
    // pill with an edge reads perfectly well.
    expect(f, 'the pill is opaque — no fill can separate from both grounds on this palette')
      .not.toMatch(/backdrop-filter|rgba\(/)
    expect(CSS, 'the translucency block is gone, not just unreferenced')
      .not.toMatch(/@supports \(backdrop-filter[\s\S]{0,400}nav-bar--floating/)
    expect(f, 'the fill is the opaque nav token').toMatch(/background:\s*var\(--nav-bg\)/)
    // The labels are never faded — that survives every position above.
    expect(rule('.nav-tab'), 'a faded label fails AA').not.toMatch(/opacity/)
  })

  it('🔴 NAV-EDGE-01 — the edge is STRONGER than a standard line, and stays that way', () => {
    // 📐 WHY THIS ARM EXISTS AND THE TINT ONES DID NOT SURVIVE. Four rounds went
    // into the pill's FILL and none of them could be seen, because `--bg` sits
    // between white and any AA-safe darker tint: the best a fill manages is 10
    // levels against the page ground and 8 against a card. The BORDER does 17
    // and 18 at 8%, against both. The founder picked 14% off the slider.
    //
    // ⚠️ IT ASSERTS THE RELATION, NOT THE NUMBER. A literal `0.14` here would
    // pass just as well if someone re-pointed the class at `--line`, and the
    // whole failure mode is a silent revert to the standard hairline. So it
    // parses both alphas and compares them.
    const f = rule('.nav-bar--floating')
    expect(f, 'the edge must come from a token, never a literal')
      .toMatch(/border:\s*1px solid var\(--nav-pill-edge\)/)

    const alpha = (name: string) => {
      const m = CSS.match(new RegExp(`--${name}:\\s*rgba\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*([\\d.]+)\\s*\\)`))
      expect(m, `--${name} must be declared as an rgba() so its alpha is readable`).not.toBeNull()
      return { rgb: [m![1], m![2], m![3]].join(','), a: parseFloat(m![4]) }
    }
    const edge = alpha('nav-pill-edge')
    const line = alpha('line')

    // Same ink, different weight — a differently-COLOURED edge would be a
    // palette change and Silvanto's veto, not a dial.
    expect(edge.rgb, 'the edge is the same ink as every other line').toBe(line.rgb)
    expect(edge.a, `the pill's edge (${edge.a}) must be stronger than --line (${line.a})`)
      .toBeGreaterThan(line.a)
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

  it('🔴 NO INLINE STYLE OVERRIDES A PROPERTY THE CLASS OWNS', () => {
    // 🔴 THE GAP THAT LET THE PILL SHIP AS A SLAB. NAV-FLOAT-01 added
    // `.nav-bar--floating` and left the flush bar's inline `bottom: 0`,
    // `width: '100%'` and `maxWidth` on the element. **An inline style beats a
    // class**, so the pill rendered full-width and flush with only its
    // border-radius applying. Measured on the founder's device: gap below
    // **0.9pt** against a declared 12, side inset **0.9pt** against 16.
    //
    // ⚠️ AND THE EXISTING ARMS WERE ALL GREEN, because they assert the CSS RULE
    // EXISTS WITH THE RIGHT VALUES and never that those values WIN. A rule that
    // is overridden is decoration. This is the efficacy half.
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const css = rule('.nav-bar--floating')
    // Properties the class sets, in the camelCase an inline style would use.
    const owned = Array.from(css.matchAll(/^\s*([a-z-]+)\s*:/gm))
      .map(m => m[1]!.replace(/-([a-z])/g, (_, c) => c.toUpperCase()))
    const offenders: string[] = []
    for (const m of Array.from(src.matchAll(/className="nav-bar nav-bar--floating"\s*style=\{\{([\s\S]*?)\}\}/g))) {
      for (const prop of owned) {
        if (new RegExp(`(^|[\\s,{])${prop}\\s*:`).test(m[1]!)) {
          offenders.push(`inline \`${prop}\` overrides .nav-bar--floating`)
        }
      }
      // `maxWidth` is not in the class by that name but caps the class's width.
      if (/(^|[\s,{])maxWidth\s*:/.test(m[1]!)) offenders.push('inline `maxWidth` caps the class width')
    }
    expect(offenders, offenders.join('\n')).toEqual([])
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
