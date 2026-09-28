import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// NAV-ACTIVE-LOZENGE-01 + NAV-FADE-01 (Design Board 2026-09-28 / 2026-09-25).
//
// 🔴 THE DEFECT THIS EXISTS FOR, MEASURED. The selected tab was `--moss-strong`
// and the unselected `--mute`. Their relative luminance is 0.1418 and 0.1426 —
// **1.00:1, ZERO levels of greyscale separation.** The only
// difference between "you are here" and "you are not" was HUE, so in greyscale,
// or for a green-weak runner, the nav did not indicate the current page at all.
// `aria-current="page"` was present and correct; WCAG 1.4.1 governs VISUAL
// presentation, so aria does not discharge it, and `ui-patterns.md` already ruled
// *"state must live in the label, never colour alone"*.
//
// ⚠️ SO THIS FILE DELIBERATELY DOES **NOT** ASSERT THAT THE TWO LABEL COLOURS
// DIFFER. They still do not, and that is allowed — the remedy was to add
// NON-COLOUR signals, not to repaint the labels. Asserting the colours would fail
// on correct code and would be testing the wrong claim, which is how a gate ends
// up enforcing something nobody ruled.

const CSS = () => readFileSync('app/globals.css', 'utf8')

const tokenHex = (css: string, name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`))
  if (!m) throw new Error(`token --${name} not found`)
  return m[1]
}
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
const L = ([r, g, b]: number[]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const contrast = (a: number[], b: number[]) => {
  const [l1, l2] = [L(a), L(b)]
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
const over = (fg: number[], alpha: number, bg: number[]) =>
  fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)))

/** The lozenge, read WHOLE from the token — rgb and alpha — so the gate cannot
 *  drift from it if the colour is retuned, only if the contrast actually breaks.
 *  ⚠️ No hex literal here: the pre-commit hook bars them under `components/`, and
 *  it is right to, because a colour written into a test is a second copy of it. */
function wash(css: string): { rgb: number[]; alpha: number } {
  const m = css.match(/--nav-active-wash:\s*rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/)
  if (!m) throw new Error('--nav-active-wash not found')
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) }
}
const washAlpha = (css: string) => wash(css).alpha

describe('NAV-ACTIVE-LOZENGE-01 — the selected tab is legible without colour', () => {
  it('the active tab carries a lozenge, not just a colour', () => {
    const css = CSS()
    // A background drawn behind the active tab is the non-colour signal. It is a
    // pseudo-element on purpose: NAV-SLIM-01 took the tap target from 69% to 98%
    // of the bar, and insetting the tab itself would hand that back.
    expect(css).toMatch(/\.nav-tab--active::before\s*\{[^}]*background:\s*var\(--nav-active-wash\)/)
  })

  it('the active and inactive labels differ in WEIGHT', () => {
    const css = CSS()
    const base = css.match(/\.nav-tab\s*\{\s*font-weight:\s*(\d+)/)?.[1]
    const active = css.match(/\.nav-tab--active\s*\{\s*font-weight:\s*(\d+)/)?.[1]
    expect(base, '.nav-tab must declare a base weight').toBeTruthy()
    expect(active, '.nav-tab--active must declare its own weight').toBeTruthy()
    // Collins' condition: a lozenge alone is a smudge behind a word that looks
    // the same. The pair is declared so the delta cannot drift if someone tunes
    // the base.
    expect(Number(active)).toBeGreaterThan(Number(base))
  })

  it('the lozenge stays inside Silvanto\'s 0.08 ceiling', () => {
    // Measured: 0.10 puts --moss-strong at 4.47:1, below AA, which is the
    // opposite of the point of the change.
    expect(washAlpha(CSS())).toBeLessThanOrEqual(0.08)
  })

  it('the active label still clears AA on top of the lozenge', () => {
    const css = CSS()
    // --nav-bg is --card; the lozenge has ONE ground, which is why a fill works
    // here when the floating bar's own fill could not (that one fought two).
    const ground = hex(tokenHex(css, 'card'))
    const w = wash(css)
    const lozenge = over(w.rgb, w.alpha, ground)
    const label = hex(tokenHex(css, 'moss-strong'))
    expect(contrast(label, lozenge)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('NAV-FADE-01 — the bar recedes without going dead or unreadable', () => {
  const receded = () =>
    CSS().match(/\.nav-bar--floating\.nav-bar--receded\s*\{[^}]*\}/)?.[0] ?? ''

  it('recedes by blurring the SURFACE, never by fading the whole bar', () => {
    const block = receded()
    expect(block).toMatch(/backdrop-filter:\s*blur/)
    // 🔴 The amendment, measured: a whole-bar opacity fade gives 4.47:1 at 0.9
    // (already below AA) and 2.98:1 at 0.7. The labels must never lose opacity —
    // only the surface behind them.
    expect(block, 'an `opacity` on the bar fades the labels too — that is the refused version')
      .not.toMatch(/(^|[^-])opacity:/)
  })

  it('stays pressable while receded', () => {
    // § 6i: a nav icon under a sheet once DISMISSED instead of navigating. A nav
    // you can see and cannot press is worse than one that is simply there.
    expect(receded()).not.toMatch(/pointer-events:\s*none/)
  })

  // 🔴 NAV-FADE-CONTRAST-01 — THE ARM THAT WOULD HAVE CAUGHT THE DEFECT.
  //
  // The 2026-09-25 amendment claimed a blurred translucent bar "holds >=5.23:1
  // worst case". That was measured against OUR PALETTE. The bar is translucent,
  // so its labels actually sit on whatever SCROLLS BENEATH IT — and over a moss
  // CTA the active label measured 3.58:1, with the AA boundary at a backdrop of
  // grey 220, a LIGHT grey. Reachable today, because TODAY-CTA-CLEARANCE-01 was
  // reverted and the moss "Log this session" button scrolls under the bar.
  //
  // ⚠️ SO THIS MEASURES THE WORST POSSIBLE BACKDROP, NOT OUR GROUNDS. Scoping a
  // contrast check to the surfaces we happen to ship is the exact error that let
  // the defect through, and it is this repo's population-failure class again.
  it('the receded labels clear AA over the WORST possible backdrop', () => {
    const css = CSS()
    const barAlpha = Number(
      css.match(/\.nav-bar--floating\.nav-bar--receded\s*\{[^}]*background:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)/)?.[1],
    )
    expect(barAlpha, 'receded bar alpha not found').toBeGreaterThan(0)

    const WHITE = [255, 255, 255]
    const worst = hex(tokenHex(css, 'ink'))          // the darkest thing that can scroll under it
    const surface = over(WHITE, barAlpha, worst)      // the translucent bar over it
    const w = wash(css)
    const lozenge = over(w.rgb, w.alpha, surface)     // the active tab's ground
    const label = hex(tokenHex(css, 'ink-2'))         // what the receded state paints labels

    expect(contrast(label, lozenge),
      'the ACTIVE label on its lozenge, over the worst backdrop').toBeGreaterThanOrEqual(4.5)
    expect(contrast(label, surface),
      'the INACTIVE label on the bar, over the worst backdrop').toBeGreaterThanOrEqual(4.5)
  })

  it('the receded state repaints BOTH labels, not just the inactive one', () => {
    // The active label is --moss-strong at rest and must not stay moss while
    // receded: over a moss CTA that is 3.58:1.
    const css = CSS()
    expect(css).toMatch(/\.nav-bar--floating\.nav-bar--receded \.nav-tab--active\s*\{[^}]*color:\s*var\(--ink-2\)/)
  })

  it('prefers-reduced-motion disables the recede entirely', () => {
    const css = CSS()
    const rm = css.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/g) ?? []
    const covers = rm.some(b => b.includes('nav-bar--receded'))
    // Wroblewski's condition on TODAY-CTA-CLEARANCE-01 was that the CTA cannot
    // depend on the recede "because prefers-reduced-motion disables that".
    // Shortening the transition is not the same as not receding.
    expect(covers, 'reduced motion must restore the opaque bar, not merely shorten the transition').toBe(true)
  })
})
