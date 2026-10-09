import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// WEEK-THEME-DEAD-01 (2026-10-09) — a locally-declared component with NO render
// site is dead code that READS LIKE LIVE CODE.
//
// ── WHY, AND IT IS THE FOURTH TIME ───────────────────────────────────────────
// `PlanCoachingCard` (72 lines) rendered `week.theme` as raw prose, with **zero
// render sites** — its only one was removed by `93dfe76e` (DESIGN-V3,
// 2026-09-21, "the weeks ARE the Plan screen") and the component stayed for 18
// days. Measured: 49 unresolved `{{zone2_ceiling}}` tokens live in `week.theme`
// across 11 of 34 plans, so that component was **one JSX line away** from showing
// 11 runners a raw template token.
//
// ⚠️ AND IT HAD THREE TWINS I NEARLY LEFT BEHIND. Written as a check for the one
// component I had just deleted, this arm found `IconStrava`, `IconMore` and
// `Card` in the same file — 26 more lines, all residue of rulings already taken
// (Phase 1 removed the Strava nav entry; ADR-007 replaced System B, and `Card`
// still referenced `--card-bg` / `--border-col`). **The remedy was a mechanism, so
// it had to be grepped for the SHAPE before closing** — `QUIT-TAB-DEAD-01` and
// `SMOKE-PLUMBING-01` are the same class, and "an unreachable consumer reads
// exactly like a consumer" is the recorded lesson.
//
// ── WHAT IT CHECKS ───────────────────────────────────────────────────────────
// Every `function Xxx(` declared in a non-test `.tsx` under `app/` or
// `components/` must be rendered as `<Xxx` somewhere in that same tree. The
// population is WALKED, not listed.

const ROOTS = ['app', 'components']

function tsxFiles(): string[] {
  const out: string[] = []
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name)
      if (e.isDirectory()) { if (!/node_modules|\.next/.test(p)) walk(p) }
      else if (p.endsWith('.tsx') && !p.includes('.test.')) out.push(p)
    }
  }
  for (const r of ROOTS) walk(join(__dirname, '..', '..', r))
  return out
}

/**
 * Declared, non-default-exported components.
 *
 * ⚠️ `export default function` is EXCLUDED on purpose: it is imported by whatever
 * name the importer chooses, so `<Name` in this tree proves nothing about it. Those
 * are covered by the import graph instead — an unimported default export fails the
 * build or the linter, not this.
 */
function localComponents(src: string): string[] {
  return Array.from(src.matchAll(/^function ([A-Z]\w+)\s*\(/gm)).map(m => m[1]!)
}

describe('WEEK-THEME-DEAD-01 — no locally-declared component is unrendered', () => {
  const files = tsxFiles()
  const all = files.map(f => readFileSync(f, 'utf8')).join('\n')

  // The vacuity arm. An empty file list or a regex that stops matching makes every
  // other arm here pass, and this repo has shipped that green tick before.
  it('walks the tree and finds components to check', () => {
    expect(files.length, 'no .tsx files walked').toBeGreaterThan(100)
    const declared = files.flatMap(f => localComponents(readFileSync(f, 'utf8')))
    expect(declared.length, 'no local components parsed — the regex moved').toBeGreaterThan(50)
  })

  it('every one is rendered somewhere in app/ or components/', () => {
    const dead: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const name of localComponents(src)) {
        if (!new RegExp(`<${name}[\\s/>]`).test(all)) {
          dead.push(`${f.replace(/^.*\/(app|components)\//, '$1/')}: ${name}`)
        }
      }
    }
    expect(dead, `declared and never rendered — delete it, or render it:\n  ${dead.join('\n  ')}`)
      .toEqual([])
  })
})
