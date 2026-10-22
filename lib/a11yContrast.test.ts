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

// ── DOC-TOKEN-DRIFT-01 (2026-10-14) ─────────────────────────────────────────
// 🔴 `CLAUDE.md`'s design-system table said `--mute` is `#8A857D`. It has been
// `#6D6963` since `A11Y-CONTRAST-01` darkened it to clear AA — the whole point
// of that ship. The doc carried the value the fix REPLACED.
//
// ⚠️ FOUND BY ACCIDENT, which is the argument for the arm. I was computing a
// ghost button's contrast against the footer, took the hex from the table
// because that is what the table is for, and got **3.14:1 — a fail**. The real
// token measures **4.67 — a pass**. One stale row turned a correct control into
// a defect in my own report, and the next reader to copy a hex out of that
// table has no way to know which rows are current.
//
// ⚠️ IT CHECKS THE ROWS THAT EXIST, NOT THAT EVERY TOKEN HAS A ROW. CLAUDE.md's
// table is a curated subset by design; demanding completeness would fire on
// every new internal token and a gate that cries wolf gets switched off.
describe('DOC-TOKEN-DRIFT-01 — CLAUDE.md states the live hex for every token it names', () => {
  const DOC = fs.readFileSync(path.resolve(__dirname, '../CLAUDE.md'), 'utf8')
  const rows = Array.from(DOC.matchAll(/\|\s*`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9A-Fa-f]{6})`/g))
    .map(m => [m[1], m[2].toUpperCase()] as const)

  it('the population is real — a doc with no rows would pass everything', () => {
    expect(rows.length).toBeGreaterThanOrEqual(10)
    expect(rows.map(r => r[0])).toContain('--mute')
  })

  it('🔴 no row states a hex that globals.css no longer defines', () => {
    const drift: string[] = []
    for (const [name, docHex] of rows) {
      const live = token(name)?.toUpperCase()
      if (!live) continue            // a doc-only or aliased name is not this arm's business
      if (live !== docHex) drift.push(`${name}: CLAUDE.md says ${docHex}, globals.css says ${live}`)
    }
    expect(drift, drift.join('\n')).toEqual([])
  })
})

// ── A11Y-APP-TEXT-CONTRAST-01 (FOUNDER-TYPE-18PX-01, Design Board 2026-10-14) ──
//
// 🔴 THE SCANNER FOR THIS EXACT FAILURE ALREADY EXISTED AND POINTED AT TWO MARKETING
// FILES. `A11Y-MOCKUP-CONTRAST-01` above has `MOCKUPS = [PhoneFrame, TabbedPhone]`. The
// APP — every screen a paying runner actually uses — was in no population at all.
//
// Found when the founder said the founder-note page "does not look right". Sampled from
// his own screenshot: the pull-line carrying `BRAND.coreTruth` rendered `#6B8E6B`
// (`--moss`) on `--bg` = **3.24:1**, against AA's 4.5, while every other line on the page
// was `--ink-2` at 9.95. **The one sentence the page exists to deliver was the faintest
// text on it.** The 12px mailto — the only tappable thing besides the back arrow — was the
// same colour.
//
// ⚠️ A SURFACES LIST, NOT THE WHOLE APP, AND THE REASON IS A MEASUREMENT. Pointed at every
// app file this finds **69 candidate sites** (37 `--moss`, 19 `--warn`, 7 `--mute-2`,
// 6 `--danger`). That is a CANDIDATE population and not a defect count: a static check
// cannot know the rendered GROUND, and the sibling scanner's own header records throwing
// away a ratio version after it produced **seven confident wrong findings** by pairing text
// with a 6px dot's fill. Several of the 69 are moss-on-moss-tinted selected states, where
// the correct bar is 3:1 for graphics. **So the list grows one audited surface at a time**,
// which is the `SWEEP-BASELINE-01` pattern, and a file on it has been looked at.
//
// ⚠️ WHAT IT STILL CANNOT PROVE: that the ground under any of these is `--bg`. It forbids
// the TOKEN on small text, exactly as the mockup arm does, because which token carries
// small text is statically decidable and where it lands is not.
describe('A11Y-APP-TEXT-CONTRAST-01 — audited app surfaces use AA-capable text tokens', () => {
  /** Audited surfaces. ADD a file when you have looked at it; never to silence a failure. */
  const SURFACES = ['app/dashboard/FounderNoteScreen.tsx']
  const LARGE_PX = 24
  const BANNED: Record<string, string> = {
    '--moss': '--moss-strong (3.24 -> 4.82 on --bg)',
    '--warn': '--warn-strong',
    '--mute-2': '--mute',
    '--danger': '--danger-strong',
  }

  /** ⚠️ BOUND THE STYLE OBJECT BY BRACE DEPTH. Never a proximity window — that is the
   *  recorded failure that produced seven wrong findings in the sibling scanner. */
  function colouredText(src: string): { token: string; size: number; line: number }[] {
    const out: { token: string; size: number; line: number }[] = []
    for (const m of Array.from(src.matchAll(/style=\{\{/g))) {
      let i = m.index! + 'style={{'.length
      let depth = 1
      while (i < src.length && depth > 0) {
        const c = src[i]
        if (c === '{') depth++
        else if (c === '}') depth--
        i++
      }
      const obj = src.slice(m.index! + 'style={{'.length, i - 1)
      const col = /(?:^|[\s,])color:\s*(?:[^,}]*\?\s*)?'var\((--[a-z0-9-]+)\)'/.exec(obj)
      const size = /(?:^|[\s,])fontSize:\s*'(\d+)px'/.exec(obj)
      if (!col || !size) continue
      out.push({ token: col[1]!, size: Number(size[1]), line: src.slice(0, m.index!).split('\n').length })
    }
    return out
  }

  it('the scanner reaches real declarations on every listed surface', () => {
    // An empty population passes the arm below in silence — four of this repo's
    // measured check defects were exactly that.
    for (const f of SURFACES) {
      const n = colouredText(fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8')).length
      expect(n, `${f}: the scanner found no sized, coloured text — re-anchor it`).toBeGreaterThan(2)
    }
  })

  it('the detector fires on the real defect and ignores a large-text use', () => {
    // Both directions, against the ACTUAL shipped defect rather than an invented one.
    const probe = (s: string) => colouredText(s).filter(t => t.size < LARGE_PX && BANNED[t.token])
    expect(probe(`<p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--moss)' }}>x</p>`)).toHaveLength(1)
    expect(probe(`<p style={{ fontSize: '18px', color: 'var(--ink)' }}>x</p>`)).toHaveLength(0)
    expect(probe(`<p style={{ fontSize: '26px', color: 'var(--moss)' }}>x</p>`)).toHaveLength(0)
    // a FILL is a graphic at 3:1, not text — `background` must never be read as `color`
    expect(probe(`<span style={{ fontSize: '12px', background: 'var(--moss)' }} />`)).toHaveLength(0)
  })

  it('🔴 no sub-AA token carries small text on an audited surface', () => {
    const fails: string[] = []
    for (const f of SURFACES) {
      for (const { token, size, line } of colouredText(fs.readFileSync(path.resolve(__dirname, '..', f), 'utf8'))) {
        if (size >= LARGE_PX) continue
        if (BANNED[token]) fails.push(`${f}:${line} — ${token} on ${size}px text. Use ${BANNED[token]}.`)
      }
    }
    expect(fails, fails.join('\n')).toEqual([])
  })
})

// 🔴 A11Y-APP-TEXT-SWEEP-01 (Design Board 2026-10-22, 6t-j) — the rest of the app, not one audited file.
// Re-measured before the sitting: 69 candidates had become 19, because ACCENT-TEXT-CONTRAST/VARIABLE (6t-g/6t-h,
// `lib/ui/accentText.test.ts`) already hold every moss, warn and session-hue small-text site. This holds the
// rest: `--mute-2` (1.90:1) is never text, the Strava orange is a mark and never words, and white text never sits on a hue fill white cannot clear (it takes `--moss-strong` /
// `--warn-strong`, or `onHue()` picks ink).
// ⚠️ WHAT IT CANNOT SEE: text styled by className or a CSS module, and a colour passed through a variable other
// than the hue owners (`hueText`, `onHue`), which carry their own arms.
describe('A11Y-APP-TEXT-SWEEP-01 — no faint small text anywhere in the app (6t-j)', () => {
  const ROOT = path.resolve(__dirname, '..')
  const decl = new Map(Array.from(CSS.matchAll(/\n\s*(--[a-z0-9-]+):\s*([^;]+);/g), m => [m[1]!, m[2]!.trim()] as [string, string]))
  const resolve = (n: string, d = 0): string => {
    const v = decl.get(n) ?? ''
    const r = /^var\((--[a-z0-9-]+)\)$/.exec(v)
    return r && d < 8 ? resolve(r[1]!, d + 1) : v.toUpperCase()
  }
  const WHITE = resolve('--card')
  // `--danger` is NOT here: it measures 5.28 on --card and 4.65 on --bg, so it clears AA as text (the 2026-10-14
  // candidate list counted it, and the 6t-j sitting carried that forward without re-measuring).
  const BANNED_TEXT = new Set(['--mute-2', '--strava'].map(resolve))
  const HUE_BASE = ['--s-easy', '--s-long', '--s-quality', '--s-inter', '--s-race', '--s-recov', '--s-strength', '--s-cross', '--moss', '--warn']
  /** Hue fills white cannot clear at 4.5:1, derived from globals.css so a new alias is seen. */
  const WHITE_FAILS = new Set(HUE_BASE.map(resolve).filter(v => /^#[0-9A-F]{6}$/.test(v) && ratio(WHITE, v) < 4.5))

  function files(dir: string, out: string[] = []): string[] {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f)
      if (fs.statSync(p).isDirectory()) { if (!/-preview$/.test(f)) files(p, out) }
      else if (/\.tsx$/.test(f) && !/\.test\./.test(f)) out.push(p)
    }
    return out
  }
  /** Every var() token in one property's expression, so BOTH branches of a ternary are read. */
  const tokensOf = (obj: string, prop: string): string[] => {
    const m = new RegExp(`(?:^|[\\s,{])${prop}:\\s*([^\\n]*?)(?:,\\s*\\n|,\\s*[a-zA-Z]+:|$)`, 'm').exec(obj)
    return m ? Array.from(m[1]!.matchAll(/var\((--[a-z0-9-]+)\)/g), x => x[1]!) : []
  }
  /** ⚠️ Bounded by brace depth, never a proximity window (the sibling scanner's seven wrong findings). */
  function styleObjects(src: string): { obj: string; line: number }[] {
    const out: { obj: string; line: number }[] = []
    for (const m of Array.from(src.matchAll(/style=\{\{/g))) {
      let i = m.index! + 'style={{'.length, depth = 1
      while (i < src.length && depth > 0) { const c = src[i]; if (c === '{') depth++; else if (c === '}') depth--; i++ }
      out.push({ obj: src.slice(m.index! + 'style={{'.length, i - 1), line: src.slice(0, m.index!).split('\n').length })
    }
    return out
  }
  function findings(src: string): string[] {
    const out: string[] = []
    for (const { obj, line } of styleObjects(src)) {
      const size = /(?:^|[\s,])fontSize:\s*'(\d+)px'/.exec(obj)
      if (!size || Number(size[1]) >= 24) continue
      const colours = tokensOf(obj, 'color')
      for (const t of colours) if (BANNED_TEXT.has(resolve(t))) out.push(`${line}: ${t} as ${size[1]}px text`)
      if (colours.some(t => resolve(t) === WHITE)) {
        for (const t of tokensOf(obj, 'background')) {
          if (WHITE_FAILS.has(resolve(t))) out.push(`${line}: white ${size[1]}px text on ${t} (${ratio(WHITE, resolve(t)).toFixed(2)}:1)`)
        }
      }
    }
    return out
  }
  const SOURCES = [...files(path.join(ROOT, 'components')), ...files(path.join(ROOT, 'app'))]
    .map(f => [path.relative(ROOT, f), fs.readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')] as const)

  it('the detector fires on each ruled defect and on a ternary\'s second branch, and ignores what it should', () => {
    expect(findings(`<span style={{ fontSize: '11px', color: 'var(--mute-2)' }}>x</span>`)).toHaveLength(1)
    expect(findings(`<span style={{ fontSize: '11px', color: on ? 'var(--ink)' : 'var(--mute-2)' }}>x</span>`)).toHaveLength(1)
    expect(findings(`<span style={{ fontSize: '10px', color: 'var(--strava)' }}>x</span>`)).toHaveLength(1)
    expect(findings(`<b style={{ fontSize: '14px', background: 'var(--warn)', color: 'var(--card)' }}>x</b>`)).toHaveLength(1)
    expect(findings(`<b style={{ fontSize: '14px', background: 'var(--accent)', color: 'var(--card)' }}>x</b>`)).toHaveLength(1)
    expect(findings(`<b style={{ fontSize: '14px', background: 'var(--moss-strong)', color: 'var(--card)' }}>x</b>`)).toHaveLength(0)
    expect(findings(`<b style={{ fontSize: '14px', background: 'var(--s-easy)', color: 'var(--card)' }}>x</b>`)).toHaveLength(0)
    expect(findings(`<b style={{ fontSize: '52px', color: 'var(--mute-2)' }}>–</b>`)).toHaveLength(0)
    expect(findings(`<i style={{ width: '8px', background: 'var(--mute-2)' }} />`)).toHaveLength(0)
  })

  it('reaches the app: hundreds of sized style objects across both trees, so a green is not an empty population', () => {
    const sized = SOURCES.reduce((n, [, s]) => n + styleObjects(s).filter(o => /fontSize:\s*'\d+px'/.test(o.obj)).length, 0)
    expect(sized).toBeGreaterThan(500)
    expect(SOURCES.some(([f]) => f.startsWith('app/'))).toBe(true)
  })

  it('no file in the app carries faint small text', () => {
    const hits = SOURCES.flatMap(([f, s]) => findings(s).map(h => `${f}:${h}`))
    expect(hits, `6t-j: use --mute for meta text, --mute on Strava words (orange on the mark only), the -strong fill under white text, or onHue() on a hue fill.\n${hits.join('\n')}`).toEqual([])
  })
})
