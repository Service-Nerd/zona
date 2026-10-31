import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { hueText, onHue } from './hueText'

/**
 * 🔴 ACCENT-TEXT-CONTRAST-01 + ACCENT-TEXT-VARIABLE-01 + WARN-TEXT-CONTRAST-01 (Design Board 2026-10-22, 6t-g/6t-h).
 * A session hue, moss or warn is never SMALL TEXT. Small text takes the hue's ratified `-strong` shade where one exists
 * (moss, race, recovery, warn) and `--ink-2` otherwise; `lib/ui/hueText.ts` is the owner for computed colours.
 *
 * Three populations, because each earlier version of this gate was blind to one of them:
 *   1. LITERAL text in a hue, where the hue set is DERIVED from globals.css (every token that resolves to a hue), so
 *      the 22 legacy aliases (`--accent`, `--teal`, `--amber`…) are seen. The first version listed names and missed them.
 *   2. COMPUTED text colour (`color: x.colour`, `fooColour(...)`, a ternary naming a hue), which the first version could
 *      not see at all (~25 sites). It must go through `hueText(...)` or be a named exception.
 *   3. The owner itself: every shade `hueText` returns measures >= 4.5:1 on --card.
 */
const css = readFileSync('app/globals.css', 'utf8')
const decl = new Map(Array.from(css.matchAll(/\n\s*(--[a-z0-9-]+):\s*([^;]+);/g), m => [m[1], m[2].trim()] as [string, string]))
const resolve = (n: string, depth = 0): string => {
  const v = decl.get(n) ?? ''
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v)
  return ref && depth < 8 ? resolve(ref[1], depth + 1) : v.toUpperCase()
}
const HUE_VALUES = new Set(['--s-easy', '--s-long', '--s-quality', '--s-inter', '--s-race', '--s-recov', '--s-strength', '--s-cross', '--moss', '--warn'].map(n => resolve(n)))
const HUE_TOKENS = new Set(Array.from(decl.keys()).filter(n => HUE_VALUES.has(resolve(n))))

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) { if (!/-preview$/.test(f)) files(p, out) }
    else if (/\.tsx$/.test(f) && !/\.test\./.test(f)) out.push(p)
  }
  return out
}
const SOURCES = [...files('components'), ...files('app')].map(f => [f, readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')] as const)

// Each surviving site named, with why it is not small text.
const LITERAL_OK: Record<string, { count: number; why: string }> = {
  'app/dashboard/BenchmarkUpdateScreen.tsx': { count: 1, why: '28px figure (large)' },
  'app/dashboard/DashboardClient.tsx': { count: 1, why: 'a status VALUE in a data object, rendered through hueText (was 2: LOAD-VERDICT-RED-01 moved the load verdict out to lib/ui/loadRatioContext.ts)' },
  'components/ErrorBoundary.tsx': { count: 1, why: '32px display text (large)' },
  'components/dashboard/PlanAdjustmentsScreen.tsx': { count: 1, why: 'a chevron icon' },
  'components/dashboard/SessionPopupInner.tsx': { count: 1, why: 'a → glyph inside a button' },
  'components/dashboard/TodayScreen.tsx': { count: 6, why: 'five 56px hero words (large) and a → glyph' },
  'components/marketing/PhoneFrame.tsx': { count: 1, why: '56px hero word (large)' },
  'components/shared/RefusalView.tsx': { count: 1, why: 'an aria-hidden · bullet mark' },
  'components/strava/StravaPanel.tsx': { count: 8, why: 'admin-only screen, reached by URL (6t-h)' },
  'components/training/PlanCalendar.tsx': { count: 1, why: 'the ⇄ swap glyph, an icon' },
  'components/training/PlanChart.tsx': { count: 1, why: 'a legend SWATCH colour in a data array' },
}
const COMPUTED_OK: Record<string, { count: number; why: string }> = {
  'app/api/og/session-complete-card/route.tsx': { count: 1, why: 'share image (next/og), resolved hex; not app text' },
  'app/dashboard/GeneratePlanScreen.tsx': { count: 1, why: '28px confidence score (large)' },
  'components/marketing/HeroTrace.tsx': { count: 3, why: 'ternaries over --warn-strong / --moss-strong / ink (already text shades)' },
  'components/marketing/PhoneShell.tsx': { count: 1, why: '--moss-strong or --mute (already text shades)' },
  'components/marketing/SameWeekTwice.tsx': { count: 1, why: 'ternary over --warn-strong / --moss-strong' },
  'components/shared/SessionSteps.tsx': { count: 1, why: 'the run/walk glyph colour (an icon, via currentColor)' },
  'components/dashboard/SessionPopupInner.tsx': { count: 1, why: 'the 22px/800 zone label (large)' },
  'components/strava/StravaPanel.tsx': { count: 2, why: 'admin-only screen' },
  'components/ui/Wordmark.tsx': { count: 2, why: 'the logo (WCAG logotype exemption)' },
}

function count(re: RegExp, accept: (m: RegExpMatchArray) => boolean): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [f, src] of SOURCES) {
    const n = Array.from(src.matchAll(re)).filter(accept).length
    if (n) out[f] = n
  }
  return out
}
const literal = count(/(?<![A-Za-z-])color:\s*'var\((--[a-z0-9-]+)\)'/g, m => HUE_TOKENS.has(m[1]))
// A computed expression is fine when, after removing every hueText(...) call, nothing left names a colour: no hue token
// in a quoted var(), and no identifier containing colour/color/accent/hue/tint/tone.
function namesAHue(expr: string): boolean {
  // The capture stops at the first comma, so a hueText(...) call with arguments arrives truncated; it is safe as written.
  // `onHue()` (6t-j) is the owner of text ON a hue fill, as `hueText()` is of text IN a hue.
  if (/^\s*(?:hueText|onHue)\(/.test(expr)) return false
  let e = expr.replace(/(?:hueText|onHue)\((?:[^()]|\([^()]*\))*\)/g, '')
  for (const m of Array.from(e.matchAll(/'var\((--[a-z0-9-]+)\)'/g))) if (HUE_TOKENS.has(m[1])) return true
  e = e.replace(/'[^']*'/g, '')
  return /colou?r|accent|hue|tint|tone/i.test(e)
}
const computed = count(/(?<![A-Za-z-])color:\s*(?=[^\s'"`])([^,}\n]+)/g, m => namesAHue(m[1]))

const lum = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map(c => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92)).reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0)
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

describe('a hue is never small text', () => {
  it('the hue set is derived from globals.css and includes the legacy aliases', () => {
    for (const t of ['--s-quality', '--moss', '--warn', '--accent', '--teal', '--amber', '--coral', '--session-race']) expect(HUE_TOKENS.has(t), t).toBe(true)
  })
  for (const [name, found, ok] of [['literal', literal, LITERAL_OK], ['computed', computed, COMPUTED_OK]] as const) {
    it(`🔴 ${name}: every hue-coloured text site is a named exception`, () => {
      const bad = Object.entries(found).filter(([f, n]) => !ok[f] || n > ok[f].count).map(([f, n]) => `${f} (${n})`)
      expect(bad, 'small text in a hue: use hueText() / a -strong shade / --ink-2').toEqual([])
    })
    it(`${name}: the exception list may only shrink`, () => {
      expect(Object.entries(ok).filter(([f, a]) => (found[f] ?? 0) < a.count).map(([f]) => f)).toEqual([])
    })
  }
  it('🔴 every shade hueText returns is >= 4.5:1 on --card', () => {
    const card = resolve('--card')
    for (const t of Array.from(HUE_TOKENS)) {
      const shade = hueText(`var(${t})`)
      const name = /^var\((--[a-z0-9-]+)\)$/.exec(shade)![1]
      expect(ratio(resolve(name), card), `${t} -> ${shade}`).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('🔴 the step list\'s section text is ink, never the hue', () => {
    const src = readFileSync('components/shared/SessionSteps.tsx', 'utf8')
    expect(src).toMatch(/const SECTION_TEXT = 'var\(--ink-2\)'/)
  })
})

// 6t-j — `onHue()` picks white or ink for text ON a hue fill. Every hue token (aliases included) is measured here, and
// the pick must be the better of the two and clear 4.5:1, except `--s-cross`, which clears neither (named in the owner).
describe('onHue — text on a hue fill', () => {
  const INK = resolve('--ink'), WHITE = resolve('--card')
  const CROSS = resolve('--s-cross')
  it('every hue token gets the better of white and ink, and that clears AA', () => {
    const wrong: string[] = []
    for (const t of Array.from(HUE_TOKENS)) {
      const v = resolve(t), w = ratio(WHITE, v), k = ratio(INK, v)
      const picked = onHue(`var(${t})`) === 'var(--ink)' ? k : w
      if (picked < Math.max(w, k)) wrong.push(`${t}: picked ${picked.toFixed(2)}, better ${Math.max(w, k).toFixed(2)}`)
      else if (picked < 4.5 && v !== CROSS) wrong.push(`${t}: ${picked.toFixed(2)} < 4.5`)
    }
    expect(wrong).toEqual([])
  })
})

