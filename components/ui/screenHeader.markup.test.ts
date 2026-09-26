import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import fs from 'node:fs'
import path from 'node:path'
import ScreenHeader from './ScreenHeader'
import { Z_LAYERS } from '../../lib/ui/zLayers'

/**
 * SCREEN-HEADER-01 — Design Board. The tab-root header gets one owner, and the
 * qualifying subset of screens gets a pinned one.
 *
 * 🔴 WHAT THIS HOLDS SHUT, AND IT IS NOT WHAT THE ITEM WAS FILED FOR. The item
 * was about stickiness. The census found the component had been written TWICE —
 * private in `DashboardClient`, hand-copied into `TabbedPhone` for the WEBSITE —
 * and the copy's own comment claimed *"Same sizes, same tokens"* while the app
 * pinned `var(--font-ui)` on both lines and the copy pinned neither.
 *
 * ⚠️ AND THE GUARD FOR THAT CLASS COULD NOT FIRE. `realComponents.test.ts`
 * exists because a marketing still said "8 km" where the app said "8km", and its
 * whole remedy is *"import the real component."* The real component was private.
 * **A guard whose remedy is unavailable is not a guard** — same shape as
 * `ui-patterns.md` describing a toggle in four bullets with nothing implementing
 * it while forbidding a one-off inline toggle.
 */
const ROOT = path.resolve(__dirname, '../..')
const CSS  = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
const rule = (sel: string) => CSS.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

/**
 * ⚠️ THE POPULATION IS WALKED, NEVER TYPED.
 *
 * Five checks written in one week read clean while pointed at a hand-written
 * set: `sheetClose`'s four filenames that say "Sheet" (missing the four sheets
 * `DashboardClient` renders), a 44px floor arm that measured only the compliant,
 * a baseline keyed `file:line` that orphaned itself, a CTA arm blind to
 * ternaries, and a moss arm that read inline styles after the rule moved to CSS.
 * **A short population produces a green tick.** So: every `.tsx` under `app/`
 * and `components/`, found by walking the tree.
 */
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : walk(p)
    return p.endsWith('.tsx') ? [p] : []
  })

const FILES = [...walk(path.join(ROOT, 'app')), ...walk(path.join(ROOT, 'components'))]
const OWNER = path.join(ROOT, 'components/ui/ScreenHeader.tsx')
// ⚠️ ITERATE THIS WITH `Array.from`, NEVER `[...SRC]`. A documented tsconfig
// trap in this repo (TS2802, no --downlevelIteration) that has now been hit
// three times. `npm run build` does NOT catch it — test files are outside the
// Next build graph — so only `tsc --noEmit` sees it.
const SRC   = new Map(FILES.map(f => [f, fs.readFileSync(f, 'utf8')]))

/**
 * Every OTHER top-sticky element in the repo, each with the reason it is not
 * this owner's. A SET, not a count — a count passes when one disappears and a
 * new one arrives.
 *
 * 🥇 THE DERIVED POPULATION FOUND TWO OF THESE THAT I HAD NOT ACCOUNTED FOR on
 * its first run, including one on the WEBSITE. I had typed `= 2`; walking the
 * tree returned four. That is the whole argument for deriving the set.
 *
 * 🔴 AND THE TWO PUSHED-SCREEN HEADERS HAVE LEFT THIS LIST — because they were
 * never sticky. They carried `position: sticky; top: 0` inside a wrapper that
 * declared `overflow-y: auto` with `min-height: 100%`, which is a scrollport
 * that can never scroll: measured at **-800px after an 800px scroll**. They now
 * share `.pinned-chrome` and `useScrolledContainer` with this owner. Their
 * TYPOGRAPHY still diverges (5 treatments across 13 sites) and that is
 * `BACK-HEADER-OWNER-01`, a ruling rather than a sweep.
 */
const NOT_THIS_OWNER: Record<string, string> = {
  'components/marketing/SiteHeader.tsx:91':
    'The WEBSITE\'s own chrome: wordmark + section nav, not a screen title. A different ' +
    'object, and it stays its own. \u26a0\ufe0f It carries its edge PERMANENTLY where the app now ' +
    'reveals one on scroll — filed as SITE-HEADER-EDGE-01.',
  'app/wizard-preview/page.tsx:48':
    'Internal dev harness toolbar at /wizard-preview. Not a runner-facing surface.',
}

describe('SCREEN-HEADER-01', () => {
  it('🔴 exactly ONE definition of a screen header exists, on either surface', () => {
    const defs = FILES.filter(f => /function ScreenHeader\b|const ScreenHeader\s*[:=]/.test(SRC.get(f)!))
    expect(defs.map(f => path.relative(ROOT, f)),
      'the app and the website must share one definition — the hand-copy in TabbedPhone is what this replaces')
      .toEqual([path.relative(ROOT, OWNER)])
  })

  it('🔴 the WEBSITE consumes the same component as the app', () => {
    // The consumer check that found the duplicate in the first place. A phone
    // still that draws its own header is a promise the app can quietly break.
    const site = SRC.get(path.join(ROOT, 'components/marketing/TabbedPhone.tsx'))!
    expect(site, 'TabbedPhone must import the owner, not redraw it')
      .toMatch(/import ScreenHeader from '@\/components\/ui\/ScreenHeader'/)
  })

  it('🔴 no NEW hand-rolled sticky header appears, on either surface', () => {
    // Bound the region: `position: 'sticky'` with `top: 0`. Bottom-docked sticky
    // elements (sheet close bars, the RaceResultSheet CTA) are a different thing
    // and must not be swept in.
    const hits: string[] = []
    for (const [f, src] of Array.from(SRC)) {
      if (f === OWNER) continue
      for (const m of Array.from(src.matchAll(/position:\s*'sticky'[^}]*?top:\s*0/g))) {
        hits.push(`${path.relative(ROOT, f)}:${src.slice(0, m.index).split('\n').length}`)
      }
    }
    const undeclared = hits.filter(h => !(h in NOT_THIS_OWNER))
    expect(undeclared, `hand-rolled top-sticky header(s) with no declared reason:\n${undeclared.join('\n')}`)
      .toEqual([])
    // ⚠️ AND THE OTHER DIRECTION, because a baseline that only grows is a list
    // of ghosts: a declared entry that no longer exists must be deleted, or the
    // next real offender inherits its excuse. The geometry baseline printed
    // `moved: 0` for exactly this reason — not "nothing moved", no longer looking.
    const stale = Object.keys(NOT_THIS_OWNER).filter(k => !hits.includes(k))
    expect(stale, `declared exceptions that no longer exist — delete them:\n${stale.join('\n')}`)
      .toEqual([])
  })

  it('🔴 sticky is applied ONLY where the ruling says it qualifies', () => {
    // "A header persists when the content below it keeps referring to something
    // the header names." Coach's sub names the week every card below reports on;
    // Plan's title names what the week cards belong to. Profile, Notifications
    // and the Strava feed are LABELS, and a label need not follow you down.
    //
    // ⚠️ This asserts the RULING, not a count — a count would pass if someone
    // pinned Notifications and unpinned Plan.
    const titles = new Set<string>()
    for (const src of Array.from(SRC.values())) {
      for (const m of Array.from(src.matchAll(/<ScreenHeader\s+title="([^"]+)"[^>]*?\bsticky\b[^>]*\/>/g))) {
        titles.add(m[1])
      }
    }
    expect(titles).toEqual(new Set(['Your plan', 'Your coach']))
  })

  it('🔴 the class owns every pixel; the component owns only the z-layer', () => {
    // The `BUTTON-SYSTEM-01` split, and the `NAV-PILL-FLUSH-01` lesson: an
    // inline style BEATS a class, so a rule that is overridden is decoration.
    //
    // 🔴 THE FIRST CUT OF THIS ARM WAS HOLLOW AND ITS FALSIFICATION PROVED IT.
    // It matched the FIRST `style={` in the file — the root div's — so putting
    // `fontSize: 22` on the TITLE div left it green. **Sixth instance this week
    // of a check pointed at a short population, written while I was commenting
    // on that exact class.** It now reads EVERY inline style in the file.
    const owner = fs.readFileSync(OWNER, 'utf8')
    const inlines = Array.from(owner.matchAll(/style=\{+([\s\S]*?)\}+/g)).map(m => m[1])
    expect(inlines.length, 'no inline styles found — the regex has stopped matching').toBeGreaterThan(0)

    const all = inlines.join(' ; ')
    expect(all, 'zIndex comes from the Z_LAYERS owner, as the nav does')
      .toMatch(/zIndex:\s*Z_LAYERS\.screenHeader/)
    for (const prop of ['padding', 'fontSize', 'fontWeight', 'color', 'background',
                        'position', 'top', 'borderBottom', 'letterSpacing', 'marginTop']) {
      expect(all, `\`${prop}\` belongs to .screen-header, not to an inline style`)
        .not.toMatch(new RegExp(`\\b${prop}\\s*:`))
    }
    expect(Z_LAYERS.screenHeader).toBeLessThan(Z_LAYERS.nav)
  })

  it('🔴 the pinned header is OPAQUE and its EDGE is the nav\'s edge', () => {
    // 📐 The finding NAV-EDGE-01 paid four sittings for: no fill separates from
    // both grounds on this palette (best ~10 levels), the border does 30 and 32.
    // The header reuses `--chrome-edge` so "this chrome has lifted off the
    // page" has ONE answer rather than two that drift.
    // ⚠️ THE RULE MOVED AND THIS ARM FOLLOWED IT rather than being dropped. The
    // behaviour is shared with the two pushed-screen headers now, so it lives on
    // `.pinned-chrome` — the families differ in TYPE, not in what pinning does.
    const st = rule('.pinned-chrome')
    expect(st, '.pinned-chrome missing from globals.css').not.toBe('')
    expect(st, 'opaque — a translucent header was measured invisible on this palette')
      .toMatch(/background:\s*var\(--bg\)/)
    expect(st, 'a fill cannot separate from both grounds; do not reintroduce one')
      .not.toMatch(/backdrop-filter|rgba\(|opacity/)
    // The border exists at all times and starts transparent, so the header's
    // height cannot jump by 1px on the first scroll event.
    expect(st).toMatch(/border-bottom:\s*1px solid transparent/)
    expect(rule('.pinned-chrome--scrolled'), 'the edge must be the nav\'s token, not a new literal')
      .toMatch(/border-bottom-color:\s*var\(--chrome-edge\)/)
  })

  it('🔴 renders the documented type, and the subtitle is optional', () => {
    const withSub = renderToStaticMarkup(React.createElement(ScreenHeader, { title: 'Your coach', sub: 'W3 of 12' }))
    const bare    = renderToStaticMarkup(React.createElement(ScreenHeader, { title: 'Your profile' }))
    expect(withSub).toContain('screen-header__sub')
    expect(bare, 'no subtitle means no empty element taking up space').not.toContain('screen-header__sub')
    // Unpinned by default: stickiness is opt-in per the ruling.
    expect(bare).not.toContain('pinned-chrome')
    expect(renderToStaticMarkup(React.createElement(ScreenHeader, { title: 'Your plan', sticky: true })))
      .toContain('pinned-chrome')
    // ⚠️ SSR renders the UN-scrolled state, which is correct: a header that
    // arrived with an edge already drawn would be wrong at the top of the page.
    expect(renderToStaticMarkup(React.createElement(ScreenHeader, { title: 'Your plan', sticky: true })))
      .not.toContain('pinned-chrome--scrolled')
  })

  it('🔴 ui-patterns\' documented type is what actually renders', () => {
    // § 2881 has specified `26px 800 --font-ui --ink` for months. Until now it
    // was written in two places in code and one in the doc, and the website's
    // copy pinned no font family at all.
    const t = rule('.screen-header__title')
    expect(t).toMatch(/font-size:\s*26px/)
    expect(t).toMatch(/font-weight:\s*800/)
    expect(t).toMatch(/font-family:\s*var\(--font-ui\)/)
    expect(t).toMatch(/color:\s*var\(--ink\)/)
    expect(rule('.screen-header__sub'), 'the subtitle pins its family too — the hand-copy did not')
      .toMatch(/font-family:\s*var\(--font-ui\)/)
  })
})
