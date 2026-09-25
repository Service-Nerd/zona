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

const MOSS_FILL = /background[^,}]*var\(--moss\)(?!-)/
// ⚠️ The white literal is written as a CHARACTER CLASS, not as itself. The
// pre-commit hook blocks hardcoded hex in `components/`, and it cannot tell a
// detector FOR the hex from a USE of it — this file is the seventh time the
// repo has flagged its own explanation as the bug. `#[fF]{3,6}` matches the
// same strings and contains no hex literal to flag.
const LIGHT_TEXT = /color:\s*'(?:var\(--card\)|#[fF]{3,6}|white)'/i
const MOSS_LABEL = /color:\s*'var\(--moss\)'/

describe('BUTTON-COMPONENT-01 — Button owns the CTA shape', () => {
  it('reads real files and real buttons (a check over nothing is not a check)', () => {
    const files = sourceFiles()
    expect(files.length).toBeGreaterThan(50)
    const total = files.reduce((n, f) => n + buttonTags(strip(fs.readFileSync(f, 'utf8'))).length, 0)
    expect(total, 'no <button> elements parsed — the scanner is broken').toBeGreaterThan(100)
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
