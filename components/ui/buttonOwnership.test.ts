import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * BUTTON-COMPONENT-01 — every control that carries a LABEL on moss goes through
 * `Button`, and nothing hand-rolls the CTA shape again.
 *
 * 🔴 WHY THIS EXISTS AND WHY `a11yContrast.test.ts` COULD NOT DO IT. That file
 * asserts `white on --moss-strong >= 4.5`. True, and a fact about a TOKEN. It
 * was green while 27 primary CTAs used `--moss` at 3.68:1, 14 quiet buttons used
 * `--moss` as a label at 3.24:1, and the email CTA did the same — because a
 * token being legal is not the same as it being USED. Its own header says so.
 * This file reads the PRODUCER: the buttons themselves.
 *
 * ⚠️ IT KEYS ON FILL-PLUS-LABEL, NEVER ON MOSS ALONE, AND THAT IS THE WHOLE
 * DESIGN. 15 of the 66 moss buttons use moss as the SELECTED affordance, which
 * `ui-patterns.md` makes the only selected affordance and which is graphics at
 * 3:1, not text at 4.5:1. A check that fired on "moss in a button" would demand
 * the reversal of a standing rule and would be switched off within a day, which
 * this repo already records as equivalent to having no check (NOISE-GATE-01).
 *
 * ⚠️ FALSIFIED BOTH WAYS before being trusted (see the build log): putting a
 * single `background: 'var(--moss)'` + `color: 'var(--card)'` button back into
 * a screen turns it red, and a selected-state moss button leaves it silent.
 */

const ROOT = path.resolve(__dirname, '../..')

/** Source files a runner's buttons can live in. Marketing is included: the site
 *  renders the same tokens and `.cta-pill` is its own reviewed answer. */
function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (['node_modules', '.next', 'ios', '__fixtures__'].includes(e.name)) continue
        walk(p)
      } else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) {
        out.push(p)
      }
    }
  }
  for (const d of ['app', 'components']) walk(path.join(ROOT, d))
  return out
}

/** Each `<button ...>` opening tag, brace-balanced so a JSX style object survives. */
function buttonTags(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
  const re = /<button(?=[\s>])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    let i = re.lastIndex
    let depth = 0
    while (i < src.length) {
      const c = src[i]
      if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) break
      i++
    }
    out.push({ line: src.slice(0, m.index).split('\n').length, text: src.slice(m.index, i + 1) })
  }
  return out
}

/** Comments are stripped first: this repo has flagged its own explanation as the
 *  bug six times, and the Button component's header quotes the failing shape.
 *
 *  ⚠️ EACH COMMENT IS REPLACED BY ITS OWN NEWLINES, NOT BY NOTHING. The first
 *  cut deleted them outright, which shifted every line number after a comment
 *  and made this file report real offenders at lines that held something else.
 *  A gate whose coordinates are wrong gets distrusted and then ignored. */
const blank = (m: string) => m.replace(/[^\n]/g, '')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank)
   .replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
   // ⚠️ `[ \t]*`, NOT `\s*`. `\s` matches \n, so `^\s*//` swallows the blank
   // lines ABOVE a comment and every line number after it shifts. That is how
   // this file first reported a real offender 108 lines from where it lives.
   .replace(/^[ \t]*\/\/.*$/gm, '')

/**
 * 🔴 ALIASES ARE RESOLVED FROM `globals.css`, NOT HARDCODED, AND THIS FILE
 * SHIPPED WITHOUT IT (2026-09-25, found hours later while doing the next batch).
 *
 * `--accent: var(--moss)` is a System B legacy alias that `globals.css` keeps
 * deliberately. Two live primary CTAs paint themselves `var(--accent)` with
 * white text — the identical 3.68:1 failure this file exists to catch — and it
 * matched neither arm, because it compared the token NAME and the producer used
 * a different name for the same colour.
 *
 * ⚠️ THE FIX IS NOT A SECOND HARDCODED LIST. This repo has recorded that a
 * checker sharing the producer's hand-written list is blind to that list
 * exactly as the producer is. The alias graph is READ from the stylesheet, so a
 * legacy alias added tomorrow is covered without anyone remembering.
 */
function aliasesOf(root: string): string[] {
  const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
  const direct = new Map<string, string>()
  for (const m of Array.from(css.matchAll(/^\s*(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)\s*;/gm))) {
    direct.set(m[1]!, m[2]!)
  }
  const out = new Set<string>([root])
  let grew = true
  while (grew) {
    grew = false
    // Array.from: this tsconfig targets below es2015, so iterating a Map
    // directly fails `tsc --noEmit` while vitest runs it happily.
    for (const [from, to] of Array.from(direct)) {
      if (out.has(to) && !out.has(from)) { out.add(from); grew = true }
    }
  }
  return Array.from(out)
}
const MOSS_NAMES = aliasesOf('--moss')
/** `(?!-)` keeps `--moss-strong` / `--moss-soft` out: those are the ANSWER. */
const MOSS_VAR = `var\\((?:${MOSS_NAMES.join('|')})\\)(?!-)`
const MOSS_FILL = new RegExp(`background[^,}]*${MOSS_VAR}`)
// ⚠️ The white literal is written as a CHARACTER CLASS, not as itself. The
// pre-commit hook blocks hardcoded hex in `components/`, and it cannot tell a
// detector FOR the hex from a USE of it — this file is the seventh time the
// repo has flagged its own explanation as the bug. `#[fF]{3,6}` matches the
// same strings and contains no hex literal to flag.
const LIGHT_TEXT = /color:\s*'(?:var\(--card\)|#[fF]{3,6}|white)'/i
const MOSS_LABEL = new RegExp(`color:\\s*'${MOSS_VAR}'`)

describe('BUTTON-COMPONENT-01 — Button owns the CTA shape', () => {
  it('reads real files and real buttons (a check over nothing is not a check)', () => {
    const files = sourceFiles()
    expect(files.length).toBeGreaterThan(50)
    // ⚠️ COUNT BOTH SHAPES. This arm asserted `<button>` elements > 100 and went
    // RED the moment BUTTON-ARCH-01 migrated 95 of them to `<Button>` — the
    // sanity check failing because the codebase got BETTER. A floor on one
    // spelling is a floor that breaks when the spelling is the thing you change.
    const total = files.reduce((n, f) => {
      const src = strip(fs.readFileSync(f, 'utf8'))
      return n + buttonTags(src).length + (src.match(/<(Button|IconButton)(?=[\s>])/g) ?? []).length
    }, 0)
    expect(total, 'no controls parsed — the scanner is broken').toBeGreaterThan(100)
  })

  it('no hand-rolled primary CTA: moss fill under a light label', () => {
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      if (f.endsWith(path.join('components', 'ui', 'Button.tsx'))) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const { line, text } of buttonTags(src)) {
        if (MOSS_FILL.test(text) && LIGHT_TEXT.test(text)) {
          offenders.push(`${path.relative(ROOT, f)}:${line}`)
        }
      }
    }
    expect(offenders, `hand-rolled primary CTA (use <Button variant="primary">). ` +
      `White on --moss is 3.68:1 and AA needs 4.5:1:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no button uses --moss as its LABEL colour: 3.24:1 on --bg, 3.04:1 on --bg-soft', () => {
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      if (f.endsWith(path.join('components', 'ui', 'Button.tsx'))) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const { line, text } of buttonTags(src)) {
        if (MOSS_LABEL.test(text) && !MOSS_FILL.test(text)) {
          offenders.push(`${path.relative(ROOT, f)}:${line}`)
        }
      }
    }
    expect(offenders, `--moss as a button label fails AA on every ground. ` +
      `Use <Button variant="quiet"> (--moss-strong):\n${offenders.join('\n')}`).toEqual([])
  })

  it('`.cta-pill` is gone: the site and the app have ONE button definition', () => {
    // WEBSITE-BUTTON-UNIFY-01 (Design Board, 2026-09-25). `.cta-pill` was a
    // correct SLT ruling in 2026-09 — the site had NO hover state at all — and
    // `.btn` now carries its whole contract, so keeping it would be two
    // definitions of one button. It had already drifted: it supplied only the
    // three interaction states while each of its 3 call sites hand-typed its
    // own font-size, padding, radius and label colour, and all three differed.
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    // ⚠️ A RULE, not a mention. This file and globals.css both EXPLAIN the
    // deletion in prose, and a bare substring scan would flag the explanation
    // as the bug — seventh time in this repo.
    expect(css, 'a live .cta-pill rule is back').not.toMatch(/^\s*\.cta-pill[\s,{:]/m)

    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const src = strip(fs.readFileSync(f, 'utf8'))
      if (/className=[^\n]*\bcta-pill\b/.test(src)) offenders.push(path.relative(ROOT, f))
    }
    expect(offenders, `still applying the deleted class:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no marketing CTA hand-rolls a moss fill instead of using .btn', () => {
    // The site is where the second definition lived, so it gets its own arm:
    // an <a> or <button> under the marketing surfaces may not paint itself moss.
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      const isSite = rel.startsWith(path.join('components', 'marketing')) ||
        (rel.startsWith('app' + path.sep) && !rel.includes('dashboard') && !rel.includes('auth') &&
         !rel.includes('preview'))
      if (!isSite) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const tag of ['a', 'button']) {
        const re = new RegExp('<' + tag + '(?=[\\s>])', 'g')
        let m: RegExpExecArray | null
        while ((m = re.exec(src))) {
          let i = re.lastIndex, depth = 0
          while (i < src.length) {
            const c = src[i]
            if (c === '{') depth++
            else if (c === '}') depth--
            else if (c === '>' && depth === 0) break
            i++
          }
          const t = src.slice(m.index, i + 1)
          if (/background[^,}]*var\(--moss/.test(t) && !/className=[^\n]*\bbtn\b/.test(t)) {
            offenders.push(`${rel}:${src.slice(0, m.index).split('\n').length} <${tag}>`)
          }
        }
      }
    }
    expect(offenders, `marketing CTA painting itself instead of using .btn:\n${offenders.join('\n')}`).toEqual([])
  })

  it('Button carries no `use client`, so a server page can render it free', () => {
    // BUNDLE-BOUNDARY-01. `SiteHeader.tsx` and `app/charity-runners/page.tsx`
    // are SERVER components. Button uses no hook, no state and no browser API,
    // so the directive bought nothing and would have pushed a client boundary
    // onto a static page the first time anyone imported it. That class has cost
    // this repo 110kB -> 249kB and 114kB -> 251kB, both times silently.
    const src = fs.readFileSync(path.join(ROOT, 'components/ui/Button.tsx'), 'utf8')
    expect(src, 'Button.tsx regained a client directive').not.toMatch(/^\s*['"]use client['"]/m)
    expect(src, 'Button gained a hook — re-examine the directive').not.toMatch(/\buse(State|Effect|Ref|Memo|Callback|Reducer)\s*\(/)
  })

  it('every text-style button label clears AA on the worst ground it can sit on', () => {
    // BUTTON-MIGRATION-02, 2026-09-25. The moss arms above catch ONE colour.
    // This is the general rule: a button with no fill is a label, and a label
    // owes 4.5:1. Measured across the app, it found three `--warn` labels at
    // 2.69:1 (fixed to --warn-strong, 4.53:1) and one `--danger` at 4.36:1.
    //
    // ⚠️ GROUNDS ARE THE WORST CASE, NOT THE ACTUAL PARENT. Resolving each
    // button's real background means walking the JSX tree, and a check that
    // guesses the parent would be confidently wrong. Taking the worst of the
    // three grounds is conservative and cannot produce a false pass.
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    const hex = (n: string) => css.match(new RegExp(`^\\s*${n}:\\s*(#[0-9A-Fa-f]{6})\\s*;`, 'm'))?.[1] ?? null
    const srgb = (c: number) => (c /= 255, c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    const lum = (h: string) => {
      const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(1).slice(i, i + 2), 16))
      return 0.2126 * srgb(r!) + 0.7152 * srgb(g!) + 0.0722 * srgb(b!)
    }
    const ratio = (a: string, b: string) => {
      const [x, y] = [lum(a), lum(b)]
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }
    const GROUNDS = ['--bg', '--card', '--bg-soft'].map(hex).filter(Boolean) as string[]

    // Declared debt, with its reason — the pattern SWEEP-BASELINE-01 uses.
    // This is ONE 11px "Unlink this run?" confirm inside a --bg-soft row.
    // `--danger` is 4.36:1 there and there is NO `--danger-strong` token;
    // minting one is a palette addition and therefore the Design Board's,
    // not a migration's. Filed as DANGER-TEXT-CONTRAST-01.
    const BASELINE = new Set(['app/dashboard/DashboardClient.tsx:--danger'])

    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const { line, text } of buttonTags(src)) {
        if (!/background:\s*'(none|transparent)'/.test(text)) continue
        const m = text.match(/color:\s*'var\((--[a-z0-9-]+)\)'/)
        if (!m) continue
        const h = hex(m[1]!)
        if (!h) continue                        // an alias; the alias arm covers moss
        const worst = Math.min(...GROUNDS.map(g => ratio(h, g)))
        if (worst < 4.5 && !BASELINE.has(`${rel}:${m[1]}`)) {
          offenders.push(`${rel}:${line} ${m[1]} is ${worst.toFixed(2)}:1, AA needs 4.5`)
        }
      }
    }
    expect(offenders, `a text button's label fails AA:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔴 no icon-only control is unnamed: a glyph is not an accessible name', () => {
    // ICON-BUTTON-01, 2026-09-25. Measured: 5 controls with no accessible name.
    // One was truly silent (an SVG); four were the distance stepper, where a
    // screen-reader user hears "minus, plus, minus, plus" with nothing to say
    // which number each one moves.
    //
    // ⚠️ THE CLASSIFIER MUST NOT TREAT A JSX EXPRESSION AS EMPTY, AND MINE DID.
    // The census I took to brief the board stripped `{...}` from each button's
    // body and then called anything left textless an icon control. Two
    // FULL-WIDTH LABELLED buttons — a zone row and a disclosure header — came
    // back as "silent icon controls", so the brief said 14 and 7 when the truth
    // was 12 and 5. Here a body containing ANY `{expression}` is treated as
    // possibly-labelled and skipped: this check is biased toward passing, and
    // says so, rather than being confidently wrong about the count.
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      if (f.endsWith(path.join('components', 'ui', 'IconButton.tsx'))) continue
      const rel = path.relative(ROOT, f)
      const src = strip(fs.readFileSync(f, 'utf8'))
      const re = /<button(?=[\s>])/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        let i = re.lastIndex, depth = 0
        while (i < src.length) {
          const c = src[i]
          if (c === '{') depth++
          else if (c === '}') depth--
          else if (c === '>' && depth === 0) break
          i++
        }
        const tag = src.slice(m.index, i + 1)
        const close = src.indexOf('</button>', i)
        if (close === -1) continue
        const body = src.slice(i + 1, close)
        if (/aria-label/.test(tag)) continue
        if (/\{/.test(body)) continue           // may render text — biased to pass
        const text = body.replace(/<[^>]*>/g, '').trim()
        const iconOnly = (/<svg/.test(body) && !text) || (!!text && text.length <= 2)
        if (iconOnly) {
          offenders.push(`${rel}:${src.slice(0, m.index).split('\n').length} renders ${text || 'an svg'} and no name`)
        }
      }
    }
    expect(offenders, `an icon-only control with no accessible name — a screen ` +
      `reader announces a glyph or nothing:\n${offenders.join('\n')}`).toEqual([])
  })

  it('IconButton cannot be constructed without a name', () => {
    // The compiler is the enforcement, not a reviewer: `:860` records that the
    // 44px-circle rule was standing AND ignored by half its instances, which is
    // what a rule with no mechanism looks like.
    const src = fs.readFileSync(path.join(ROOT, 'components/ui/IconButton.tsx'), 'utf8')
    expect(src, 'ariaLabel became optional').toMatch(/\n\s*ariaLabel:\s*string\b/)
    expect(src, 'ariaLabel became optional').not.toMatch(/ariaLabel\?:/)
  })

  it('🔴 no raw <input type="number"> outside TextField', () => {
    // STEPPER-CONTROL-01 (c), 2026-09-25. `ManualRunModal` had a bare <input>
    // with nine inline styles sitting BESIDE `DurationPicker` — a component
    // that exists precisely so nobody hand-rolls a control. `ui-patterns.md`
    // § Ruler names the routing: a precise number the runner KNOWS is
    // `TextField`'s job. The 16px font that avoids the iOS focus-zoom trap is
    // `TextField`'s to own, which is the concrete reason this matters.
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      if (rel === path.join('components', 'shared', 'TextField.tsx')) continue
      if (rel.includes('preview')) continue          // dev harnesses
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const m of Array.from(src.matchAll(/<input(?=[\s>])[^>]*type="number"/g))) {
        offenders.push(`${rel}:${src.slice(0, m.index).split('\n').length}`)
      }
    }
    expect(offenders, `a raw numeric input outside TextField:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔴 the distance stepper ANNOUNCES its value, not just its buttons', () => {
    // The aria-labels added earlier today say what each BUTTON does. Pressing
    // "+" changed the number and told a screen-reader user nothing about the
    // RESULT — Sierra: "the tap count makes the app annoying; the silence makes
    // it unusable." The role belongs on the value readout, not the buttons.
    const src = strip(fs.readFileSync(path.join(ROOT, 'app/dashboard/DashboardClient.tsx'), 'utf8'))
    const spins = Array.from(src.matchAll(/role="spinbutton"/g))
    expect(spins.length, 'the distance readouts lost their spinbutton role').toBe(2)
    // A role with no value is a role that announces nothing.
    expect((src.match(/aria-valuenow=\{dist(Whole|Decimal)\}/g) ?? []).length,
      'a spinbutton with no aria-valuenow announces nothing').toBe(2)
  })

  it('🔴 a left-aligned control is not centred by `.btn`', () => {
    // GHOST-AFFORDANCE-01, 2026-09-25. `.btn` sets `justify-content: center`,
    // and the conversion dropped each call site's `display`/`alignItems`/
    // `justifyContent` as "owned by .btn". For a ROW-shaped control that is
    // wrong: 11 controls silently centred, and the founder saw one of them —
    // "Sign out" centred above a left-aligned "Delete account" in the same card.
    //
    // ⚠️ THE CLASS IS RIGHT AND THE SWEEP WAS WRONG. Centring is correct for a
    // button; these are rows. So the rule is not "stop centring", it is "a
    // control that declares its own alignment must keep it".
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      if (rel.includes('preview')) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const { line, text } of buttonTags(src)) {
        if (!/className="[^"]*\bbtn\b/.test(text)) continue
        const wantsLeft = /textAlign:\s*'left'/.test(text)
        const hasOwn = /justifyContent:\s*'/.test(text)
        if (wantsLeft && !hasOwn) offenders.push(`${rel}:${line}`)
      }
    }
    expect(offenders, `left-aligned but centred by .btn — give it its own ` +
      `justifyContent:\n${offenders.join('\n')}`).toEqual([])
  })

  it('one label, one treatment — within a context', () => {
    // `:457` (S3, "one CTA vocabulary") applied below the wizard. The founder
    // met "Log manually" looking like three different things and "Got it" like
    // three. GHOST-AFFORDANCE-01, 2026-09-25.
    //
    // ⚠️ THE BOARD'S TWO HALVES CONFLICT AS LITERALLY PHRASED, and this is where
    // it shows. Its success condition was "no label carries more than one
    // treatment", but it ALSO ruled a POSITIONAL rule: a control in a sentence
    // stays `ghost`, one that is a primary action on its screen takes a surface.
    // The same label legitimately appears in both — "Log manually" is a link
    // inside a sentence on one screen and a button on another. So the rule is
    // one treatment per CONTEXT, and `inline-target` is the context marker.
    // Recorded rather than resolved in favour of one half.
    const byLabel = new Map<string, Map<string, string[]>>()
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      if (rel.includes('preview')) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const { line, text } of buttonTags(src)) {
        const cm = text.match(/className="([^"]*)"/)
        if (!cm || !/\bbtn\b/.test(cm[1]!)) continue
        const v = cm[1]!.split(/\s+/).find(c => /^btn--(primary|secondary|quiet|ghost|soft|destructive)$/.test(c))
        if (!v) continue
        const close = src.indexOf('</button>', src.indexOf(text))
        let label = src.slice(src.indexOf(text) + text.length, close).replace(/<[^>]*>/g, '')
        label = label.replace(/\{[^}]*\?\s*'([^']*)'\s*:\s*'([^']*)'[^}]*\}/, '$2').trim()
        if (!label || label.length > 28 || /[{}]/.test(label)) continue
        const ctx = /inline-target/.test(cm[1]!) ? 'inline' : 'standalone'
        const key = `${label} [${ctx}]`
        if (!byLabel.has(key)) byLabel.set(key, new Map())
        const m = byLabel.get(key)!
        if (!m.has(v)) m.set(v, [])
        m.get(v)!.push(`${rel}:${line}`)
      }
    }
    const offenders: string[] = []
    for (const [key, variants] of Array.from(byLabel)) {
      if (variants.size <= 1) continue
      offenders.push(`${key}: ${Array.from(variants.keys()).join(' / ')}`)
    }
    expect(offenders, `a label rendered with more than one treatment in the ` +
      `same context:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔴 :240 — no session or phase colour fills a control', () => {
    // `design-rulings.md` :240, STANDING: "Type accent, not flood. Session
    // colour as left border, dot or chip; NEVER a full card background."
    //
    // 🔴 THIS RULE HAD NO MECHANICAL CHECK AND WAS BREACHED BY THREE PRIMARY
    // CTAs. The session screen filled "Match a run", "Mark as done" and
    // "Log without activity" with `config.color` — the session-TYPE colour — so
    // the control the runner is learning to find was a different colour every
    // day, depending on whether today was easy, quality or intervals. Silvanto
    // exercised the veto naming this row (SESSION-ACTIONS-01, 2026-09-25).
    //
    // Tokens are read from the stylesheet, never listed here: a ninth session
    // colour added tomorrow is covered without anyone remembering.
    const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    const accents = Array.from(css.matchAll(/^\s*(--(?:s|phase)-[a-z0-9-]+):/gm)).map(m => m[1]!)
    expect(accents.length, 'no session/phase colour tokens found — the scan is broken').toBeGreaterThan(5)
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      if (rel.includes('preview')) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const { line, text } of buttonTags(src)) {
        const bg = text.match(/background(?:Color)?:\s*'?([^,}]+)/)
        if (!bg) continue
        const v = bg[1]!
        // ⚠️ A CONDITIONAL FILL IS A SELECTED STATE, WHICH :240 PERMITS —
        // "left border, dot or CHIP". The distance/duration toggle paints its
        // ACTIVE segment with the session colour, and that is a chip, not a
        // flood. Measured before trusting the rule: without this the gate fires
        // on a legitimate affordance, and a check that cries wolf gets switched
        // off (NOISE-GATE-01, recorded twice in this repo).
        if (/\?/.test(v)) continue
        if (accents.some(a => v.includes(a))) offenders.push(`${rel}:${line} fills with ${v.trim()}`)
        // A variable named for the session's colour is the same breach by
        // another route — `config.color` is how this actually shipped.
        if (/\bconfig\.colou?r\b|\bsessionColou?r\b|\bz\.colour\b/.test(v)) {
          offenders.push(`${rel}:${line} fills with ${v.trim()} (a session colour by variable)`)
        }
      }
    }
    expect(offenders, `:240 "type accent, not flood" — a session colour may be ` +
      `a rail, dot or chip, never a control's fill:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔴 a FILLED control is on the shared system, whatever colour it is', () => {
    // 🔴 THE PROCESS GAP THE FOUNDER ASKED TO CLOSE. Every arm above keyed on
    // `--moss`, so a CTA painted ANY other colour was invisible to this file —
    // which is exactly how three `config.color` primaries shipped past it.
    // A control with a solid fill and a light label is a button, whatever the
    // fill, and it belongs to the system.
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      if (rel.includes('preview') || rel.startsWith(path.join('components', 'ui'))) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      for (const { line, text } of buttonTags(src)) {
        if (/className=[^\n]*\b(btn|icon-btn)\b/.test(text)) continue
        // 🔴 BOTH HALVES READ THROUGH A TERNARY, AND THEY DID NOT UNTIL
        // 2026-09-25. The manual-log Save button — the one the founder named
        // out loud, *"there is also a save button at the bottom"* — was a
        // hand-rolled primary CTA and this arm was green over it, because both
        // of its colours are CONDITIONAL: `background: hasData ? 'var(--teal)'
        // : 'var(--teal-dim)'` and `color: hasData ? 'var(--card)' : …`. The
        // old patterns anchored the quote directly after the colon, so a
        // control that expresses a DISABLED STATE — which is exactly what a
        // real primary CTA does — was invisible to the check written to find
        // primary CTAs. ⚠️ `--teal` is also a legacy ALIAS of `--moss`, so it
        // was doubly hidden; the alias graph is read elsewhere in this file for
        // the same reason.
        //
        // ⚠️ THE LOOKBEHIND IS NOT TIDYING. Without it `color:` matches inside
        // `borderColor:` and `backgroundColor:`, and now that the value may sit
        // behind a ternary the match window is wide enough for that to produce
        // a false positive on an ordinary bordered control.
        const filled = /background(?:Color)?:\s*[^,\n]*?'(var\(--[a-z0-9-]+\)|#[0-9A-Fa-f]{3,8})'/.test(text)
        const lightLabel = /(?<![A-Za-z])color:\s*[^,\n]*?('var\(--(?:card|card-bg)\)'|'#[fF]{3,6}'|'white')/.test(text)
        if (!filled || !lightLabel) continue
        // ⚠️ TWO NAMED EXCLUSIONS, BOTH BECAUSE THEY ARE A DIFFERENT SPECIES,
        // and both filed rather than silently restyled here.
        //
        // 1. A SELECTED-STATE CHIP in a multi-select. This file's own header
        //    protects the moss fill as the selected affordance — that is
        //    `ui-patterns.md`'s only selected treatment and it is graphics, not
        //    a CTA. Its white LABEL on moss is nonetheless a real 3.68:1, which
        //    is the SAME finding as `DANGER-TEXT-CONTRAST-01` and is folded
        //    into it; changing a selected state's appearance is a Design Board
        //    question, not a defect fix.
        // 2. A SEMANTIC AMBER CONFIRM on the pending-adjustment rail (ADR-012).
        //    Converting it to `primary` would repaint it moss and delete the
        //    meaning the amber carries. Same contrast item.
        const SPECIES_EXEMPT = new Set([
          'components/shared/ModifyPlanSheet.tsx',      // selected injury chip
          'components/shared/PendingAdjustmentBanner.tsx', // amber confirm, ADR-012
        ])
        if (SPECIES_EXEMPT.has(rel)) continue
        offenders.push(`${rel}:${line}`)
      }
    }
    expect(offenders, `a filled control outside the shared system — it is a ` +
      `button whatever colour it is:\n${offenders.join('\n')}`).toEqual([])
  })

  it('🔴 a control that lays itself out declares its own `display`', () => {
    // `.btn` sets `display: inline-flex`. That is right for a button and WRONG
    // for a row that lays itself out — and the conversion dropped `display` as
    // "owned by .btn", so a zone row's `gridTemplateColumns` became INERT and
    // its HR ranges sat wherever each description ended. The founder saw it
    // twice: "sign out is misaligned" and "the numbers for the ranges are all
    // over the place". Same root, two screens.
    //
    // ⚠️ The earlier arm checked `textAlign` + `justifyContent`. It could not
    // see this one, because that row HAD a `justifyContent` — what it had lost
    // was `display`. A check aimed at one symptom of a cause misses the others.
    const offenders: string[] = []
    for (const f of sourceFiles()) {
      const rel = path.relative(ROOT, f)
      if (rel.includes('preview')) continue
      const src = strip(fs.readFileSync(f, 'utf8'))
      const re = /<(button|Button|IconButton)(?=[\s>])/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        let i = re.lastIndex, depth = 0
        while (i < src.length) {
          const c = src[i]
          if (c === '{') depth++
          else if (c === '}') depth--
          else if (c === '>' && depth === 0) break
          i++
        }
        const t = src.slice(m.index, i + 1)
        const onSystem = m[1] !== 'button' || /className=[^\n]*\b(btn|icon-btn)\b/.test(t)
        if (!onSystem) continue
        const line = src.slice(0, m.index).split('\n').length
        if (/gridTemplate|gridColumn(?!s?:\s*')/.test(t) && !/display:\s*'grid'/.test(t)) {
          offenders.push(`${rel}:${line} declares grid columns, but .btn's inline-flex wins`)
        }
        // ⚠️ NO `flexDirection` ARM, AND THAT IS MEASURED. `.btn` sets
        // `inline-flex`, which IS a flex container — so `flexDirection: column`
        // works perfectly on it. The first cut flagged two controls that were
        // entirely correct. Only GRID properties are broken by inline-flex, so
        // only grid is checked. A check that cries wolf gets switched off, which
        // this repo records as equivalent to having no check.
      }
    }
    expect(offenders, `a control's own layout is being overridden by .btn:\n${offenders.join('\n')}`).toEqual([])
  })

  it('the email CTA does not use the failing fill', () => {
    // Email cannot use box-shadow (Outlook drops it), so the ruling gives it a
    // 1px --moss-deep border instead. The FILL still owes AA either way.
    const theme = fs.readFileSync(path.join(ROOT, 'lib/email/emailTheme.ts'), 'utf8')
    const templates = fs.readFileSync(path.join(ROOT, 'lib/email/trialEmailTemplates.ts'), 'utf8')
    const cta = templates.match(/function ctaButton[\s\S]*?\n}/)?.[0] ?? ''
    expect(cta, 'ctaButton() not found — the email CTA moved').toContain('background:')
    expect(cta, 'the email CTA still fills with the 3.68:1 moss').not.toMatch(/background:\$\{C\.moss\}/)
    expect(theme, 'emailTheme must carry the AA-clearing fill').toMatch(/\bmossStrong\b/)
  })
})
