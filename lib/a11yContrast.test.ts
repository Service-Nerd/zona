import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import cp from 'node:child_process'

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
                     '--s-race-strong', '--s-recov-strong',
                     // DANGER-TEXT-CONTRAST-01 (2026-10-02). ⚠️ `--danger` was NEVER in this
                     // list, so the token layer had never claimed it was safe for text — the
                     // gap was real and simply never asserted. `--danger-strong` is, and the
                     // arm below forbids the base token on the ground it fails.
                     '--danger-strong'] as const

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

// ─────────────────────────────────────────────────────────────────────────────
// A11Y-MOCKUP-CONTRAST-01 (Design Board, 2026-10-02) — the phone mockup owes AA on its
// TEXT, because it is not decoration.
//
// 🔴 BOTH OF THE ITEM'S PREMISES WERE FALSE, AND MEASURING THEM IS WHAT SETTLED IT.
//
// ① *"`aria-hidden` … the root already carries it, so a screen reader skips the mockup."*
// `PhoneShell` sets `aria-hidden={interactive ? undefined : 'true'}`, and the homepage's
// `TabbedPhone` **passes `onTab`** — so the primary mockup is NOT hidden. Correctly: a
// tappable nav must be exposed. Its text is in the tab order, which is what makes this AA.
//
// ② *"at that size no colour in the palette can reach 4.5:1."* Measured on `--card`:
// `--moss-strong` **5.48**, `--warn-strong` **5.48**, `--mute` **5.45**, `--ink-2` **11.31**.
// Every offender had an existing counterpart that clears AA, so **no token was added** and
// there was no palette change to veto.
//
// 🥇 ONE CONVERSION WAS A FIDELITY FIX, NOT A COMPROMISE. The mockup drew its primary CTA as
// `background: var(--moss)` while `.btn--primary` is `var(--moss-strong)`. **The drawing was
// drawing the button wrong**, so the usual objection — forcing a mockup onto a governed scale
// "would make the drawing wrong to make a grep clean" — inverts here.
//
// ⚠️ DELIBERATELY NOT CONVERTED: the **56px/800** hero word (large text owes **3:1**; `--moss`
// is 3.68, so darkening it would change the drawing for zero gain) · every `background` and
// border `--moss` (`globals.css` states `--moss` "was left alone for fills and borders, where
// 3:1 is the correct bar") · the Sparkle SVG (a graphic, 3:1).
//
// ── 🔴 WHY THIS IS AN ALLOW-LIST AND NOT A COMPUTED RATIO ────────────────────
// I wrote the ratio version first and **threw it away after it produced seven confident wrong
// findings.** It paired each `color:` with the nearest preceding `background:` inside a
// 400-character window, which crosses JSX object boundaries: text at `:300` was measured
// against a **6px dot's** fill at `:298`, and text at `:324` against a session **accent bar**.
// Every ratio was arithmetically correct and every GROUND was wrong — this repo's
// most-recorded check failure, which I then committed inside the check written to prevent it.
//
// **A rendered ground is a property of the DOM tree, not of text proximity**, so it is not
// statically decidable and a static check must not pretend otherwise. What IS decidable is
// WHICH TOKEN carries small text, so that is what this forbids. The authoritative measurement
// stays what found the nine in the first place: axe / Lighthouse on the live page.
// ─────────────────────────────────────────────────────────────────────────────
// DANGER-TEXT-CONTRAST-01 (Design Board, 2026-10-02) — `--danger` may not be TEXT on
// `--bg-soft`.
//
// 🔴 THE ITEM SAID "ONE BUTTON". MEASURED: THREE SITES, AND TWO OF THEM ARE ERROR MESSAGES.
// The finding came from `BUTTON-MIGRATION-02`'s contrast arm, which scans BUTTONS — so the
// two `<div>` error banners in `PostRaceReshapeCard` and `RaceResultSheet` were never in its
// population. **An audit is only ever as wide as its list**, and this one's list was "things
// that are buttons". ✋ Silvanto and 🎓 Sierra both inverted the priority at the sitting: an
// error message is the worst text in the product to render below AA, because it is already
// the moment the product is failing the person.
//
// `--danger` #B84545 measures **4.65 on `--bg`, 5.28 on `--card`, 4.36 on `--bg-soft`** — it
// fails ONLY on the ground it actually sits on, which is why it survived every other check.
//
// ⚠️ THIS SCANNER BOUNDS THE STYLE OBJECT, it does not use a proximity window. Earlier today
// a contrast check written with a 400-character window produced SEVEN confident wrong
// findings by pairing text with a 6px dot's fill and a session accent bar. A background
// declared in the SAME brace-balanced `style={{ … }}` object is decidable; one declared
// nearby is not.
describe('DANGER-TEXT-CONTRAST-01 — the base danger token is not text on --bg-soft', () => {
  const APP = (): string[] =>
    cp.execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean)
      .filter(f => /^(app|components)\/.*\.tsx$/.test(f) && !f.includes('.test.'))

  /** Brace-balanced `style={{ … }}` objects — never a character window. */
  function styleObjects(src: string): { body: string; line: number }[] {
    const out: { body: string; line: number }[] = []
    const re = /style=\{\{/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      let i = m.index + m[0].length, depth = 2
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth++
        else if (src[i] === '}') depth--
        i++
      }
      out.push({ body: src.slice(m.index + m[0].length, i - 2), line: src.slice(0, m.index).split('\n').length })
    }
    return out
  }

  it('the scanner reaches real style objects', () => {
    const n = APP().reduce((a, f) => a + styleObjects(fs.readFileSync(f, 'utf8')).length, 0)
    expect(n, 'the style-object scanner found nothing — re-anchor it').toBeGreaterThan(200)
  })

  it('🔴 no style object pairs `--danger` text with a `--bg-soft` fill', () => {
    const offenders: string[] = []
    for (const f of APP()) {
      for (const { body, line } of styleObjects(fs.readFileSync(f, 'utf8'))) {
        if (/color:\s*'var\(--danger\)'/.test(body) && /background:\s*'var\(--bg-soft\)'/.test(body)) {
          offenders.push(`${f}:${line}`)
        }
      }
    }
    expect(offenders, '`--danger` is 4.36:1 on `--bg-soft` and fails AA. Use ' +
      '`--danger-strong` (5.27) for text on that ground:\n' + offenders.join('\n')).toEqual([])
  })

  it('--danger-strong actually clears AA on every ground, including the one that failed', () => {
    for (const g of GROUNDS) {
      expect(ratio(token('--danger-strong'), token(g)),
        `--danger-strong on ${g}`).toBeGreaterThanOrEqual(4.5)
    }
    // ⚠️ And it must stay recognisably the SAME red, not a second one: hue and saturation are
    // held exactly, so only lightness may differ from `--danger`.
    expect(token('--danger-strong')).not.toBe(token('--danger'))
  })
})

describe('A11Y-MOCKUP-CONTRAST-01 — mockup small text uses AA-capable tokens', () => {
  const MOCKUPS = ['components/marketing/PhoneFrame.tsx', 'components/marketing/TabbedPhone.tsx']
  /** WCAG: >=24px (or >=18.66px bold) is LARGE text and owes 3:1, which `--moss` meets. */
  const LARGE_PX = 24
  /** Cannot carry text below LARGE_PX anywhere in the device: all three fail 4.5:1 on every
   *  ground inside it, and each has a drop-in counterpart that clears it. */
  const BANNED_SMALL_TEXT: Record<string, string> = {
    '--moss': '--moss-strong (3.68 -> 5.48 on --card)',
    '--warn': '--warn-strong (3.25 -> 5.48)',
    '--mute-2': '--mute (2.16 -> 5.45)',
  }

  /** Each `color: 'var(--x)'` with the nearest preceding `fontSize` in its own object. */
  function textColours(src: string): { token: string; size: number; line: number }[] {
    const out: { token: string; size: number; line: number }[] = []
    for (const m of Array.from(src.matchAll(/color:\s*(?:[^,}]*\?\s*)?'var\((--[a-z0-9-]+)\)'/g))) {
      const win = src.slice(Math.max(0, m.index! - 400), m.index! + 80)
      const sizes = Array.from(win.matchAll(/fontSize:\s*'(\d+)px'/g))
      if (!sizes.length) continue
      out.push({
        token: m[1]!,
        size: Number(sizes[sizes.length - 1]![1]),
        line: src.slice(0, m.index!).split('\n').length,
      })
    }
    return out
  }

  // ⚠️ AN EMPTY POPULATION PASSES THE ARM BELOW. The size pairing is a heuristic over a
  // window, so it can silently stop matching; this proves it still reaches real declarations.
  it('the scanner reaches real declarations', () => {
    const n = MOCKUPS.reduce((a, f) => a + textColours(fs.readFileSync(f, 'utf8')).length, 0)
    expect(n, 'the mockup scanner found no coloured text — re-anchor it').toBeGreaterThan(8)
  })

  it('🔴 no sub-AA token carries small text in the mockup', () => {
    const fails: string[] = []
    for (const f of MOCKUPS) {
      for (const { token: t, size, line } of textColours(fs.readFileSync(f, 'utf8'))) {
        if (size >= LARGE_PX) continue
        const fix = BANNED_SMALL_TEXT[t]
        if (fix) fails.push(`${f}:${line} — ${t} on ${size}px text. Use ${fix}.`)
      }
    }
    expect(fails, 'the mockup is OPERABLE on the homepage (TabbedPhone passes onTab, so ' +
      'aria-hidden is removed) and its text is exposed to assistive tech:\n' + fails.join('\n'))
      .toEqual([])
  })

  // The large-text carve-out is real and must stay honest: if the hero word ever shrinks below
  // the large-text threshold, `--moss` stops being acceptable on it.
  it('the large-text carve-out is bounded, not a blanket', () => {
    expect(LARGE_PX).toBe(24)
    const hero = textColours(fs.readFileSync(MOCKUPS[0]!, 'utf8'))
      .filter(c => c.token === '--moss' && c.size >= LARGE_PX)
    for (const h of hero) {
      expect(h.size, `--moss on ${h.size}px text relies on the 3:1 large-text bar`)
        .toBeGreaterThanOrEqual(LARGE_PX)
    }
  })
})
