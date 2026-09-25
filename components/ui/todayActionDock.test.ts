import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * TODAY-CTA-CLEARANCE-01 — Design Board, 2026-09-25. SHIP.
 *
 * 🔴 MEASURED, NOT IMPRESSION. On the founder's device capture (1206x2622 at
 * 3.216x = a true 375x815pt viewport): the CTA's top edge at **692.5pt**, 48pt
 * tall, nav top at **721.1pt** — **19.4pt, 40% of the screen's primary action,
 * behind the nav at rest.** He reported it as "the nav is cutting the log
 * session button".
 */
const ROOT = path.resolve(__dirname, '../..')
const CSS = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
const rule = (sel: string) => CSS.match(new RegExp(`\\${sel}\\s*\\{([^}]*)\\}`))?.[1] ?? ''

describe('TODAY-CTA-CLEARANCE-01', () => {
  it('🔴 the dock clears the nav, and its offset TRACKS the token', () => {
    const d = rule('.today-action-dock')
    expect(d, '.today-action-dock missing from globals.css').not.toBe('')
    expect(d).toMatch(/position:\s*sticky/)

    // 🔴 `bottom: 0`, AND THE OBVIOUS VALUE IS THE BUG. This shipped for ten
    // minutes as `calc(var(--nav-h) + env(safe-area-inset-bottom) + 8px)` —
    // clear the nav, plus a gap — which reads as correct and measured **83px of
    // float above the nav** in a real scrollport. A sticky offset resolves
    // against the scroll container's PADDING BOX, and that container already
    // reserves `navHeight + 16` so content can scroll clear, so adding the nav
    // again double-counts it. On device the float would have been ~118px.
    expect(d, 'the dock must not re-add the nav — the scroller already reserves it')
      .toMatch(/bottom:\s*0\s*;/)

    // ⚠️ THE CLEARANCE COMES FROM THE SCROLLER'S RESERVE, so the coupling is
    // asserted instead of left implicit. If this formula changes, the dock
    // silently moves and only this arm would notice.
    const ptr = fs.readFileSync(path.join(ROOT, 'components/shared/PullToRefresh.tsx'), 'utf8')
    expect(ptr, 'PullToRefresh must still apply the reserve the dock depends on')
      .toMatch(/paddingBottom:\s*`\$\{paddingBottom\}px`/)
    const shell = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    expect(shell, 'the reserve must stay nav height + a gap, or the dock drifts')
      .toMatch(/paddingBottom=\{\(bottomNavH \?\? \d+\) \+ 16\}/)
  })

  it('🔴 it is the SAME button, not a new bar', () => {
    // Zhuo's constraint: a fix that adds a permanent docked band answers a
    // complaint about furniture by adding furniture. This asserts the dock is
    // applied to the existing CTA and that no second action bar appeared.
    const src = fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const uses = Array.from(src.matchAll(/className="today-action-dock"/g)).length
    expect(uses, 'exactly one docked action on Today').toBe(1)
    const i = src.indexOf('className="today-action-dock"')
    const tag = src.slice(Math.max(0, i - 200), i + 200)
    expect(tag, 'the dock belongs on the primary CTA itself').toMatch(/<Button variant="primary"/)
  })

  it('🔴 a moss LABEL passes AA — on both surfaces, inline AND stylesheet', () => {
    // 🔴 THE GATE THAT COULD NOT SEE ITS OWN RULE. `buttonOwnership`'s moss-label
    // arm matches `color: 'var(--moss)'` as an INLINE STYLE. NAV-SLIM-01 put
    // `.nav-tab--active { color: var(--moss) }` in the STYLESHEET four hours
    // earlier — 3.68:1 at 11px, below AA — and nothing could see it. The rule
    // moved to CSS and left its enforcement behind. Fifth population failure of
    // the day, and the first one inside a stylesheet.
    const offenders: string[] = []
    // Bound the region: one declaration block at a time, never a whole-file grep.
    for (const m of Array.from(CSS.matchAll(/([.#][\w-]+(?:--[\w-]+)?)\s*\{([^}]*)\}/g))) {
      const [, sel, body] = m
      if (!/color:\s*var\(--moss\)\s*;/.test(body!)) continue
      // `--moss` is correct as a FILL, a BORDER and a SELECTED state (3:1
      // graphics bar). This binds only where it carries a LABEL, which is what
      // `color:` means.
      offenders.push(`${sel} { color: var(--moss) }  — 3.68:1, AA wants 4.5`)
    }
    expect(offenders, `moss as a text colour in the stylesheet:\n${offenders.join('\n')}`).toEqual([])
  })
})
