import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * BUTTON-ARCH-01 — the app uses the COMPONENT; the site uses the CLASSES.
 *
 * 🔴 WHY THIS EXISTS. After a day of button migration the app was **68% classes
 * and 32% component**, the inverse of what the Design Board had ruled. Nothing
 * forced it: adding a class to an existing `<button>` was the lowest-risk way to
 * preserve geometry during a migration, so it happened 99 times and quietly
 * became the architecture. **Safe beat correct, and nothing noticed.**
 *
 * ⚠️ THE COST IS THE COMPILER, NOT THE LOOK. The design lives in `globals.css`
 * either way, so a visual change is one edit whichever is used. What classes
 * lose is type checking — `btn--secondry` compiles, renders and does nothing,
 * where `variant="secondry"` fails the build. They also cannot express
 * behaviour: `busy` is a prop, and a class-based button hit that limit the day
 * it was written.
 *
 * ⚠️ THE SITE IS NOT AN EXCEPTION MADE FOR CONVENIENCE. Its CTAs NAVIGATE, so
 * they are `<a>` / `<Link>`, and `Button` renders a `<button>` — a `<button>`
 * inside an `<a>` swallows the click. Email cannot import anything at all.
 */
const ROOT = path.resolve(__dirname, '../..')

/** Paths that are the APP. Everything else is the site or a dev harness. */
const APP = ['app/dashboard', 'app/auth', 'components/shared', 'components/training',
             'components/strava', 'components/ui']

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = `${d}/${e.name}`
      if (e.isDirectory()) {
        if (['node_modules', '.next', 'ios', '__fixtures__'].includes(e.name)) continue
        walk(rel)
      } else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

/** `<button>` opening tags only — an `<a className="btn">` is the site's answer. */
function buttonElements(src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = []
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
    out.push({ line: src.slice(0, m.index).split('\n').length, text: src.slice(m.index, i + 1) })
  }
  return out
}

const blank = (s: string) => s.replace(/[^\n]/g, '')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/\{\/\*[\s\S]*?\*\/\}/g, blank)
   .replace(/^[ \t]*\/\/.*$/gm, '')

/**
 * Declared debt, shrinking not growing. Each entry is a `<button>` still on
 * classes in the app, pending BUTTON-ARCH-MIGRATION-01. A NEW one fails the
 * build, so the next button written proves itself on the way in — the same
 * debt-register pattern as SWEEP-BASELINE-01 and the liveness baseline.
 *
 * ⚠️ A DECLARED REASON IS NOT A FIXED PROBLEM. This number is expected to fall;
 * if it has not moved in a month, say so rather than letting it read as settled.
 */
const BASELINE_COUNT = 0   // set by the first run below

describe('BUTTON-ARCH-01 — the app uses the component', () => {
  it('reads real files (a check over nothing is not a check)', () => {
    expect(tsxFiles().length).toBeGreaterThan(50)
  })

  it('🔴 no <button> element in the app carries .btn classes — use <Button>', () => {
    const offenders: string[] = []
    for (const f of tsxFiles()) {
      if (!APP.some(a => f.startsWith(a))) continue
      if (f.includes('preview')) continue
      const src = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'))
      for (const { line, text } of buttonElements(src)) {
        if (/className=[^\n]*\b(btn|icon-btn)\b/.test(text)) offenders.push(`${f}:${line}`)
      }
    }
    expect(offenders.length, `${offenders.length} app <button> elements still on classes ` +
      `(baseline ${BASELINE_COUNT}). Use <Button> / <IconButton>:\n${offenders.slice(0, 40).join('\n')}`)
      .toBeLessThanOrEqual(BASELINE_COUNT)
  })

  it('the site keeps its classes — its CTAs navigate', () => {
    // A <button> inside an <a> swallows the click, so the site's answer is the
    // class on the anchor. Asserting it so nobody "fixes" it into a component.
    const header = fs.readFileSync(path.join(ROOT, 'components/marketing/SiteHeader.tsx'), 'utf8')
    expect(header).toMatch(/<a[\s\S]*?className="[^"]*\bbtn\b/)
  })
})

/**
 * BUTTON-SYSTEM-01 — the variant family is COHERENT, so a change to one has an
 * obvious consequence for the rest.
 *
 * 🔴 WHY. Six variants carried THREE different hover grammars — three darkened
 * the fill, two darkened the label, one inverted — and elevation existed on
 * exactly one. A designer changing `primary` had no rule telling them what to do
 * with the other five, which is how "change once, not in a thousand places"
 * fails even when the CSS genuinely is in one place. **The repetition was never
 * the problem; the unpredictability was.**
 */
const FILLED = ['primary', 'secondary', 'soft'] as const
const UNFILLED = ['quiet', 'ghost'] as const

function block(css: string, sel: string): string {
  return css.match(new RegExp(sel.replace(/[.\-:()]/g, '\\$&') + '\\s*\\{([^}]*)\\}'))?.[1] ?? ''
}

describe('BUTTON-SYSTEM-01 — one hover rule', () => {
  const css = fs.readFileSync(path.join(ROOT, 'app/globals.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')

  it('reads the real variant blocks', () => {
    expect(block(css, '.btn--primary')).toContain('background')
    expect(block(css, '.btn--ghost')).toContain('color')
  })

  it('🔴 a FILLED variant darkens its FILL on hover', () => {
    const offenders: string[] = []
    for (const v of FILLED) {
      const h = block(css, `.btn--${v}:hover:not(:disabled)`)
      if (!/background:/.test(h)) offenders.push(`.btn--${v}:hover does not change its fill`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('🔴 an UNFILLED variant darkens its LABEL on hover', () => {
    const offenders: string[] = []
    for (const v of UNFILLED) {
      const h = block(css, `.btn--${v}:hover:not(:disabled)`)
      if (!/color:/.test(h)) offenders.push(`.btn--${v}:hover does not change its label`)
      if (/background:\s*var/.test(h)) offenders.push(`.btn--${v}:hover grew a fill — it is unfilled`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('destructive is the ONE declared exception, and inverts', () => {
    // Sierra: "a delete button that fills red under your finger is telling you
    // something the others do not need to. Consistency is a means, not the
    // goal." Wroblewski accepted it as the ONLY exception — asserted here so a
    // second one cannot be added quietly.
    const h = block(css, '.btn--destructive:hover:not(:disabled)')
    expect(h, 'destructive stopped inverting').toMatch(/background:\s*var\(--danger\)/)
    expect(h, 'destructive stopped flipping its label').toMatch(/color:\s*var\(--card\)/)
  })

  it('🔴 every FILLED variant has an edge: a border or an elevation', () => {
    // `soft` was the only filled variant with neither — a coloured patch with
    // no edge, while `primary` lifted and `secondary` bordered.
    const offenders: string[] = []
    for (const v of FILLED) {
      const b = block(css, `.btn--${v}`)
      if (!/border:/.test(b) && !/box-shadow:/.test(b)) offenders.push(`.btn--${v} has neither border nor elevation`)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  it('elevation stays ONE STEP — :242, not a ladder', () => {
    // Recorded so it is not re-proposed: `:242` says do not design a new
    // elevation system. Exactly one variant lifts: the one you are meant to press.
    const lifted = (['primary', 'secondary', 'quiet', 'ghost', 'soft', 'destructive'] as const)
      .filter(v => /box-shadow:\s*var\(--shadow/.test(block(css, `.btn--${v}`)))
    expect(lifted, 'elevation should be on exactly one variant').toEqual(['primary'])
  })

  it('icon shapes share one ground', () => {
    expect(block(css, '.icon-btn--circle')).toMatch(/background:\s*var\(--bg-soft\)/)
    expect(block(css, '.icon-btn--square')).toMatch(/background:\s*var\(--bg-soft\)/)
  })
})
