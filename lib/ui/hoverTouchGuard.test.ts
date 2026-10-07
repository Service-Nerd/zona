// HOVER-STICKY-TOUCH-01 — every `:hover` is guarded by `@media (hover: hover)`.
//
// 🔴 On iOS WKWebView a tapped element KEEPS its `:hover` style until the runner
// taps elsewhere. `app/globals.css` carried **9 unguarded hover rules**, so any
// button could sit in its hover state indefinitely — and `destructive` is the
// family's most dramatic inversion, turning an outlined red button into a SOLID
// red rectangle. The founder photographed exactly that, on a button whose own
// component comment says it "does NOT become a filled red rectangle".
//
// ⚠️ MEASURED: at rest the button computes `rgb(255,255,255)` / `rgb(184,69,69)`;
// the only rule in the file producing solid `--danger` with `--card` text is the
// hover one. The older-build alternative was ruled out — before
// `DESTRUCTIVE-WIRING-01` that button was `variant="ghost"`.
//
// ⚠️ WHAT THIS DOES NOT PROVE. Chrome's touch emulation did NOT reproduce the
// sticky state, so the diagnosis rests on the CSS and the pixels rather than a
// reproduction, and **nothing has run on a device.** The guard is correct
// regardless: a finger has no hover.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const CSS = readFileSync(join(__dirname, '..', '..', 'app', 'globals.css'), 'utf8')
/** Strip comments — a `:hover` inside prose is documentation, not a rule. */
const CODE = CSS.replace(/\/\*[\s\S]*?\*\//g, '')

describe('HOVER-STICKY-TOUCH-01 — a finger has no hover', () => {
  it('the file still contains hover rules, so this is not vacuous', () => {
    expect((CODE.match(/:hover/g) ?? []).length,
      'no :hover rules found at all — the matcher has drifted and this file asserts nothing')
      .toBeGreaterThan(5)
  })

  it('every :hover rule sits inside @media (hover: hover)', () => {
    const unguarded = CODE.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => line.includes(':hover') && !/@media\s*\(\s*hover:\s*hover\s*\)/.test(line))
    expect(unguarded.map(u => `globals.css:${u.n}  ${u.line.slice(0, 90)}`),
      `${unguarded.length} unguarded :hover rule(s). On iOS the style STICKS after a tap, so the ` +
      'control sits in its hover state until the runner taps elsewhere. Wrap it in ' +
      '@media (hover: hover).').toEqual([])
  })

  it('and a pointing device still gets them', () => {
    // The guard must not be so tight that hover is removed entirely — that would
    // be a different regression (every control flat on desktop and the website).
    expect((CODE.match(/@media\s*\(\s*hover:\s*hover\s*\)/g) ?? []).length,
      'the hover rules were deleted rather than guarded').toBeGreaterThan(5)
  })
})
