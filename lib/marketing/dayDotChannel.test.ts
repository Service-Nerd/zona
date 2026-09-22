import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * DAYDOT-TEALKEY-01 — a VISUAL CHANNEL is never keyed on a colour string.
 *
 * 🔴 THE DEFECT. Today's `DateStrip` sized its session dot with
 * `dotColor === 'var(--teal)' ? '6px' : '4px'`. `--teal` is on `CLAUDE.md`'s
 * BANNED list (retired in favour of `--moss`) and survives only as a
 * legacy alias in `globals.css`. So completion's ONLY non-colour channel was
 * a string comparison against a retired token: the moment anyone tidied the
 * producer to return `'var(--moss)'` — the correct token — the dot would
 * silently stop growing, and completion would be carried by colour alone,
 * against the standing rule that state never lives in colour alone (WCAG
 * 1.4.1). Nothing would have failed. Nobody would have filed a bug.
 *
 * That is D-17 — classify by a structural signal the producer stamps, never
 * by a display string another layer is allowed to rewrite — reappearing one
 * layer down, in the palette.
 *
 * ⚠️ THIS IS NOT `DESIGN-DAYDOT-CHANNEL-01`. That is the larger ruling (Design
 * Board § 6q, wave 3): session type, completion, skip and move currently share
 * ONE colour channel on `PlanCalendar`'s rail, and completion overwrites the
 * type entirely. This file guards only the booby trap, and says so, because a
 * check whose name overstates its reach is how a green tick comes to mean
 * something it does not.
 */

/**
 * The defect SHAPE, not its ingredients: a comparison whose right-hand side is
 * a colour token, selecting between two LENGTHS.
 *
 * ⚠️ THE FIRST VERSION OF THIS WAS TOO LOOSE and produced three false
 * positives — it fired on any line that set a `fontSize` and separately
 * contained a `===` yielding a colour, which is ordinary, correct code. A
 * guard that fires on ordinary work gets switched off, which this repo has
 * twice recorded as equivalent to having no guard. Bound the shape.
 */
const COLOUR_KEYED_GEOMETRY =
  /[=!]==\s*'var\(--[a-z0-9-]+\)'\s*\?\s*'-?[\d.]+(px|rem|em|%)'\s*:\s*'-?[\d.]+(px|rem|em|%)'/

/**
 * ⚠️ COMMENTS ARE STRIPPED, and the reason is recorded. The first run of this
 * gate fired on the doc comment in `getDot` that QUOTES the old expression to
 * explain the defect — the same class as the S2 gate firing on the prose
 * `'Close. Bit of fine-tuning to do.'`. A guard that punishes you for
 * documenting the thing it guards is a guard that gets deleted along with the
 * documentation.
 */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const e of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(rel) }
      else if (/\.tsx$/.test(e.name) && !e.name.includes('.test.')) out.push(rel)
    }
  }
  walk('app'); walk('components')
  return out
}

describe('DAYDOT-TEALKEY-01 — geometry never branches on a colour', () => {
  it('no component decides a SIZE by comparing against a colour token', () => {
    // Bounded: an equality comparison whose right-hand side is a colour token,
    // on a line that also sets a geometric property. Grepping for the token
    // alone would fire on every legitimate `background:` in the app, and a
    // guard that fires on ordinary work gets switched off.
    const offenders: string[] = []
    for (const f of tsxFiles()) {
      const src = stripComments(readFileSync(join(process.cwd(), f), 'utf8'))
      for (const m of Array.from(src.matchAll(new RegExp(COLOUR_KEYED_GEOMETRY, 'g')))) {
        offenders.push(`${f}: ${m[0].slice(0, 80)}`)
      }
    }
    expect(
      offenders,
      'a visual channel keyed on a colour string. Branch on the STATE — a colour token can be '
      + 'renamed, aliased or retired without anything failing (DAYDOT-TEALKEY-01)',
    ).toEqual([])
  })

  it('the day dot still has a size channel for completion', () => {
    // ⚠️ The fix must not quietly DELETE the redundancy it was protecting.
    // Falsified by flattening both branches to one size.
    const src = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const i = src.indexOf('Session dot')
    expect(i, 'the day dot moved; re-point this assertion').toBeGreaterThan(0)
    const block = src.slice(i, i + 500)
    expect(block, 'completion must still change the dot SIZE, not only its colour')
      .toMatch(/complete\s*\?\s*'6px'\s*:\s*'4px'/)
  })

  it('the producer no longer emits the retired --teal token', () => {
    const src = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
    const i = src.indexOf('function getDot(')
    expect(i, 'getDot moved; re-point this assertion').toBeGreaterThan(0)
    expect(src.slice(i, i + 900), "--teal is on CLAUDE.md's BANNED list").not.toMatch(/return \{ colour: 'var\(--teal\)'/)
  })
})
