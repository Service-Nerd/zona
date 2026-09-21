import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * BUNDLE-BOUNDARY-01 — the rule engine may not cross into a client bundle.
 *
 * ⚠️ THIS REGRESSED TWICE IN ONE SITTING AND BOTH TIMES I FOUND IT BY
 * MEASURING, NOT BY LOOKING. Rendering the app's real screens in the
 * marketing device still (DESIGN-V3) means the marketing page touches
 * modules the app uses, and two of those edges dragged the whole plan
 * engine into the browser:
 *
 *   1. `PlanCalendar` imported `getCurrentWeekIndex` from the `@/lib/plan`
 *      BARREL, which also exports `savePlanForUser` and therefore imports
 *      the invariants engine, the zod schema, the ops recorder and the
 *      charity re-anchor. Homepage First Load JS: **110 kB -> 249 kB.**
 *   2. `PhoneFrame.tsx` imported `buildDemoPlanScreen` so it could read the
 *      week count. `TabbedPhone` is `'use client'` and imports `TodayStill`
 *      from that file — and a client import pulls the whole MODULE graph,
 *      not the symbol. **114 kB -> 251 kB**, and the component I suspected
 *      (the race arc) turned out to be innocent: stubbing it changed nothing
 *      because the edge was two files away.
 *
 * ⚠️ NEITHER SHOWED UP IN ANY TEST, ANY TYPE ERROR, OR ANY SCREENSHOT. The
 * page looked perfect at 251 kB. A silent 2.2x on the one page where crawl
 * budget and Lighthouse actually matter is exactly the class this repo keeps
 * writing down: correct output, wrong cost, nothing watching.
 *
 * So this walks the import graph from every `'use client'` file under
 * `components/marketing/` and fails if it can reach a banned module.
 */

const ROOT = process.cwd()

/** Modules no marketing client component may reach, and why. */
const BANNED: { path: string; why: string }[] = [
  { path: 'lib/plan/ruleEngine', why: 'the plan generator — generate on the server and pass data' },
  { path: 'lib/plan.ts', why: 'the plan BARREL: it re-exports fetch/save, which pull invariants + zod. Import lib/plan/weekResolution instead' },
  { path: 'lib/plan/invariants', why: 'the validator runs on generated plans, never in a browser' },
  { path: 'lib/plan/schema', why: 'the zod plan schema' },
  { path: 'lib/marketing/demoPlanScreen', why: 'it calls generateRulePlan — take its OUTPUT as a prop' },
]

function resolve(spec: string, fromFile: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(ROOT, spec.slice(2))
  else if (spec.startsWith('.')) base = join(ROOT, fromFile, '..', spec)
  else return null // node_modules — not ours to police here
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    if (existsSync(base + ext) && !existsSync(base + ext + '/')) return (base + ext).slice(ROOT.length + 1)
  }
  return null
}

/**
 * Import specifiers, with `import type` and inline `type` specifiers dropped:
 * a type-only edge is erased at compile time and drags nothing. That
 * distinction is load-bearing — `DemoBlockView` crosses this boundary as a
 * type on purpose.
 */
function imports(src: string): string[] {
  const out: string[] = []
  const re = /^\s*import\s+(type\s+)?([\s\S]*?)from\s+['"]([^'"]+)['"]/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    if (m[1]) continue                                   // `import type { X } from`
    const clause = m[2]
    // `import { type A, type B } from` is also fully erased.
    const named = clause.match(/\{([\s\S]*)\}/)
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]) && !/^\s*[A-Za-z_$][\w$]*\s*,/.test(clause)) continue
    out.push(m[3])
  }
  return out
}

// ⚠️ `Array.from`, never `[...map.keys()]` — the repo tsconfig target makes
// a spread over a Map/Set iterator a hard type error. Documented in
// CLAUDE.md and it still caught me; `npx tsc --noEmit` passed and only
// `npm run verify` failed, which is the check that matters.
function reach(entry: string): Map<string, string[]> {
  const seen = new Map<string, string[]>()
  const walk = (file: string, path: string[]) => {
    if (seen.has(file)) return
    seen.set(file, path)
    const abs = join(ROOT, file)
    if (!existsSync(abs)) return
    for (const spec of imports(readFileSync(abs, 'utf8'))) {
      const next = resolve(spec, file)
      if (next) walk(next, [...path, next])
    }
  }
  walk(entry, [entry])
  return seen
}

describe('BUNDLE-BOUNDARY-01 — the engine stays on the server', () => {
  const entries = ['components/marketing/TabbedPhone.tsx']

  it.each(entries)('%s cannot reach the plan engine', entry => {
    expect(readFileSync(join(ROOT, entry), 'utf8'), `${entry} should be a client component`)
      .toContain("'use client'")

    const graph = reach(entry)
    const hits = BANNED
      .filter(b => graph.has(b.path))
      .map(b => `${b.path} — ${b.why}\n      via ${graph.get(b.path)!.join('\n       -> ')}`)

    expect(hits, `A client component reaches server-only modules:\n\n    ${hits.join('\n\n    ')}\n`)
      .toEqual([])
  })

  it('the walker actually resolves a deep graph, so an empty result means something', () => {
    // A green result is only evidence if the walk reached past the entry
    // file. The first cut of a check like this can pass by resolving nothing.
    const graph = reach('components/marketing/TabbedPhone.tsx')
    expect(graph.size, 'the import walk should reach well past the entry file').toBeGreaterThan(10)
    expect(Array.from(graph.keys())).toContain('components/training/PlanCalendar.tsx')
    expect(Array.from(graph.keys())).toContain('lib/plan/weekResolution.ts')
  })
})
