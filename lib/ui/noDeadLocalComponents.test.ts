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

// WEEKTHEME-PROP-DEAD-01 (2026-10-09) — a dead PROP, which the arm above cannot see.
//
// 🔴 `noDeadLocalComponents` finds a component nothing renders. It cannot find a
// PROP nothing reads, and `weekTheme` was exactly that: derived in `PlanCalendar` and
// `TodayScreen`, carried through `onSessionTap` -> `onOpenSession` -> `DashboardClient`,
// and handed to `SessionPopupInner` as a prop it DESTRUCTURED AND NEVER READ. 15
// references across 5 files, terminating in nothing.
//
// ⚠️ Filed separately from `WEEK-THEME-DEAD-01`'s 98-line deletion on purpose: that
// was a removal, this is a signature change across 5 files with no runner-facing
// effect. Bundling would have widened a clean deletion into a refactor.
describe('WEEKTHEME-PROP-DEAD-01 — the dead prop stays gone', () => {
  const files = tsxFiles()

  it('nothing in app/ or components/ names weekTheme', () => {
    const offenders: string[] = []
    for (const f of files) {
      if (/\bweekTheme\b/.test(readFileSync(f, 'utf8'))) {
        offenders.push(f.replace(/^.*\/(app|components)\//, '$1/'))
      }
    }
    expect(offenders, `weekTheme is back:\n  ${offenders.join('\n  ')}`).toEqual([])
  })

  // ⚠️ THE VACUITY ARM, and it is not decoration here. The arm above passes
  // trivially if the file walk breaks or if `week.theme` stops existing — and
  // `week.theme` must KEEP existing: it still has one reachable render
  // (`TodayScreen`'s maintenance-transition line, routed through `renderPlanProse`
  // by COACH-INTRO-TOKEN-01) and the engine still writes it.
  it('week.theme itself still exists and is still rendered somewhere', () => {
    const all = files.map(f => readFileSync(f, 'utf8')).join('\n')
    expect(all, 'week.theme has vanished entirely — this test is now vacuous')
      .toMatch(/maintThemeLine|\.theme\b/)
    expect(all, 'the one reachable theme render no longer goes through the owner')
      .toContain('renderPlanProse')
  })

  // The signature narrowed, so the contract had to narrow with it.
  it('the PlanCalendar contract documents the 2-arg onSessionTap', () => {
    const doc = readFileSync(join(__dirname, '..', '..', 'docs', 'contracts',
      'components', 'plan-calendar.md'), 'utf8')
    expect(doc).toMatch(/onSessionTap:\s*\(session: SessionTapPayload, weekN: number\)\s*=>\s*void/)
    expect(doc, 'the contract still documents a weekTheme argument')
      .not.toMatch(/onSessionTap:[^\n]*weekTheme/)
  })
})

