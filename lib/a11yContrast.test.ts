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
