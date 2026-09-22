import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * A11Y-CONTRAST-01 — the text tokens clear WCAG 2.1 AA against every ground
 * they are used on.
 *
 * ⚠️ MEASURED, NOT ASSUMED. Lighthouse mobile flagged colour contrast on all
 * three audited pages. `--mute` scored 3.22:1 on --bg and 3.03:1 on
 * --bg-soft; `--moss` 3.24:1, and white on a moss button 3.68:1, which is the
 * primary "Get the app" CTA. AA wants 4.5:1 for normal text.
 *
 * ⚠️ THIS IS NOT A TASTE CALL AND THAT IS WHY IT IS A TEST. The audience runs
 * 25 to 65+ by the brand doc's own definition, and the palette is fixed by
 * ADR-007, so the pressure over time is to nudge a value back for looks.
 * A ratio is arithmetic: it can be checked, so it is.
 *
 * ⚠️ WHAT THIS DOES NOT PROVE. It checks the TOKENS, not every place they are
 * used. A component that hardcodes a colour, or puts --moss on an unusual
 * ground, is invisible here: `typeScale.test.ts` and the pre-commit hook
 * cover hardcoded values, and Lighthouse covers real pages. Nine failures
 * remain on the homepage, all inside the phone mockup, which renders app UI
 * at ~70% scale so its text is 9-11px. That is filed, not fixed here.
 */

const CSS = fs.readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8')

function token(name: string): string {
  const m = CSS.match(new RegExp(`^\\s*${name}:\\s*(#[0-9A-Fa-f]{6})\\s*;`, 'm'))
  if (!m) throw new Error(`token ${name} not found, or no longer a plain hex`)
  return m[1]
}
const srgb = (c: number) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
function luminance(hex: string) {
  const h = hex.slice(1)
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b)
}
function ratio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

/** Every ground normal text is set on. */
const GROUNDS = ['--bg', '--bg-soft', '--card'] as const
/** Tokens that carry NORMAL-SIZED TEXT and therefore owe 4.5:1. */
const TEXT_TOKENS = ['--ink', '--ink-2', '--mute', '--moss-strong', '--warn-strong',
                     '--s-race-strong', '--s-recov-strong'] as const

describe('WCAG AA contrast', () => {
  it('reads real tokens (a check over nothing is not a check)', () => {
    expect(token('--bg')).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(TEXT_TOKENS.length).toBeGreaterThanOrEqual(7)
  })

  it('every text token clears 4.5:1 on every ground', () => {
    const fails: string[] = []
    for (const t of TEXT_TOKENS) {
      for (const g of GROUNDS) {
        const r = ratio(token(t), token(g))
        if (r < 4.5) fails.push(`${t} on ${g}: ${r.toFixed(2)}`)
      }
    }
    expect(fails, `below WCAG AA:\n${fails.join('\n')}`).toEqual([])
  })

  it('white clears 4.5:1 on the filled-button colour', () => {
    // The primary CTA. --moss itself is 3.68 here, which is why the button
    // uses --moss-strong and why --moss was left alone for fills and borders,
    // where 3:1 is the correct bar.
    expect(ratio('#FFFFFF', token('--moss-strong'))).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps --moss and --warn as the accent values ADR-007 set', () => {
    // The point of the -strong pair is that the accent did NOT have to move.
    // If these ever change, it is a palette decision and belongs in an ADR.
    expect(token('--moss')).toBe('#6B8E6B')
    expect(token('--warn')).toBe('#B8853A')
  })

  it('every SVG fill that carries meaning clears 3:1 on its ground', () => {
    // 🔴 ADDED 2026-09-22 (Design Board, SITE-STEP-CONTRAST-01) BECAUSE THIS
    // FILE COULD NOT SEE THE DEFECT IT EXISTS TO CATCH.
    //
    // Everything above reads TOKENS and checks them pairwise. It never looks at
    // where a token is USED. So `fill="var(--bg-soft)"` on a --bg ground —
    // 1.07:1, four 72px numerals on the homepage — passed every check here, and
    // the source comment said out loud that it was drawn as SVG because "axe
    // does not evaluate SVG as text".
    //
    // A token being legal somewhere is not the same as it being legal HERE.
    // That is the same shape as --surface-moss-wash: legal in globals.css,
    // forbidden by a rule in ui-patterns.md, and the two never met.
    //
    // 3:1 is the AA threshold for graphics and large text, not 4.5:1 — these
    // are 72px glyphs, and holding them to body-text contrast would force them
    // darker than the heading beside them.
    const PAGES = ['../app/page.tsx', '../components/marketing/SameWeekTwice.tsx']
    const GROUND = token('--bg')
    // A ground token used as a fill is background-coloured BY DEFINITION and can
    // never clear 3:1 on itself. Naming them is the point of the check.
    const NEVER_AS_FILL = ['--bg', '--bg-soft', '--card', '--line']

    const offenders: string[] = []
    for (const rel of PAGES) {
      const file = path.resolve(__dirname, rel)
      if (!fs.existsSync(file)) continue
      const src = fs.readFileSync(file, 'utf8')
        // ⚠️ Strip comments FIRST. This check's own explanation quotes the old
        // `fill="var(--bg-soft)"`, and a naive scan would flag the paragraph
        // describing the bug as the bug. Sixth time this repo has met that.
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      // Array.from: this tsconfig targets below es2015, so a raw matchAll iterator
      // fails `tsc --noEmit` while vitest runs it happily. The push hook runs tsc.
      for (const m of Array.from(src.matchAll(/fill="var\((--[a-z0-9-]+)\)"/g))) {
        const name = m[1]!
        if (NEVER_AS_FILL.includes(name)) {
          offenders.push(`${rel}: fill=${name} is a GROUND token, it can never clear 3:1`)
          continue
        }
        const r = ratio(token(name), GROUND)
        if (r < 3) offenders.push(`${rel}: fill=${name} is ${r.toFixed(2)}:1 on --bg, needs 3:1`)
      }
    }
    expect(offenders, 'an SVG fill fails contrast on its ground').toEqual([])
  })

  it('does not reintroduce a render-blocking font import', () => {
    // PERF-FONT-01. The @import was three round trips deep and blocked the
    // first paint; it also caused the layout shift next/font's size-adjust
    // fallback removed (CLS 0.161 -> 0 on the homepage).
    expect(CSS).not.toMatch(/@import\s+url\(['"]?https:\/\/fonts\.googleapis/)
    const layout = fs.readFileSync(path.resolve(__dirname, '../app/layout.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    expect(layout).not.toContain('fonts.googleapis.com')
    expect(layout).toContain("from 'next/font/google'")
  })
})
