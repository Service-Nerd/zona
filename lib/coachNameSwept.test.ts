// BRAND-COACHNAME-HARDCODED-01 — the TREE half. `.githooks/pre-commit` reads STAGED files only.
//
// 🔴 A guard scoped to the diff cannot see the tree, which this repo already learned on colour:
// the one live hardcoded hex in the whole app survived because nothing had touched that file for
// months, and `sweep:colours` exists for exactly that reason. The same applies here — and it was
// not hypothetical: widening the commit guard's population to `lib/` revealed EIGHT committed
// literals it had never been able to see, including two live lock-screen push bodies and three
// AI prompts saying "You are Kit".
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
// ⚠️ `packages/` IS IN THE POPULATION — it holds runner-facing strength copy and was outside
// both this sweep and the commit guard, while `aiRouteMaxDuration.test.ts` already walks it.
const ROOTS = ['lib', 'app', 'components', 'packages']
/** The one place the literal may exist. Everything else reads `BRAND.coachName`. */
const DEFINITION = /^const COACH_NAME = 'Kit'$/

/** 🔴 THE SHARED STRIPPER, NOT A SECOND ONE, AND IN `--stream` MODE (code review + a 30 s
 *  timeout). The first cut hand-rolled a scanner here, duplicating
 *  `scripts/lib/strip-comments.py` — which that file calls "the single implementation" — and
 *  the copy was not string-aware, truncating 63 lines across 39 files including
 *  `lib/brand.ts`'s own `url: 'https:`. Calling it per file then spawned ~700 python
 *  processes and timed out the suite at 44 s while passing standalone. `--stream` is the mode
 *  that exists for this: one process per batch, `path:lineno:text` out.
 *  ⚠️ Batched because an argv of 700 paths is near the platform limit. */
function strippedLines(files: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < files.length; i += 200) {
    const batch = files.slice(i, i + 200)
    out.push(...execFileSync('python3', ['-I', join(ROOT, 'scripts/lib/strip-comments.py'), '--stream', ...batch],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }).split('\n'))
  }
  return out
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (/-preview$/.test(name)) continue          // design harnesses, 404 in production
      out.push(...walk(p)); continue
    }
    if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(p)
  }
  return out
}

describe('BRAND-COACHNAME-HARDCODED-01 — the coach name is defined once', () => {
  const files = ROOTS.flatMap(r => walk(join(ROOT, r)))

  // `check:slow` flagged this at 2161 ms, so the stripper only sees files whose RAW text
  // already holds the word. Sound in the one direction that matters: stripping overwrites
  // comment text with spaces in place, and the character before a surviving `Kit` can only
  // become a space if it was the closing slash of a block comment, which is a word boundary
  // already. A stripped hit implies a raw hit, so the filter can only drop files that could
  // not have matched.
  const candidates = files.filter(f => /\bKit\b/.test(readFileSync(f, 'utf8')))

  it('the sweep reaches the tree it claims to', () => {
    // An empty population passes vacuously, which is how a sweep comes to mean nothing.
    expect(files.length, 'the walker found nothing — this whole file is vacuous').toBeGreaterThan(300)
    expect(files.some(f => f.includes('/lib/coaching/'))).toBe(true)
    expect(files.some(f => f.includes('/components/'))).toBe(true)
  })

  it('🔴 no file outside the definition line holds the literal', () => {
    const hits: string[] = []
    for (const row of strippedLines(candidates)) {
      // `path:lineno:text` — split on the first two colons only, because the text can hold them.
      const m = /^(.*?):(\d+):(.*)$/.exec(row)
      if (!m) continue
      const [, path, lineno, text] = m
      if (!/\bKit\b/.test(text!)) continue
      const rel = path!.startsWith(ROOT) ? path!.slice(ROOT.length + 1) : path!
      // 🔴 THE EXEMPTION IS `lib/brand.ts`'s LINE, NOT THE LINE IN ANY FILE (code review).
      // Matched on the line alone, a duplicate `const COACH_NAME = 'Kit'` in a second file
      // passed both this arm and the hook — the duplicate hardcode the item exists to stop,
      // admitted by the exemption written to stop it.
      if (rel === 'lib/brand.ts' && DEFINITION.test(text!.trim())) continue
      hits.push(`${rel}:${lineno}`)
    }
    expect(hits,
      'the coach name is hardcoded outside `const COACH_NAME`. Use `BRAND.coachName`. The '
      + 'pre-commit guard reads STAGED files only, so a file nobody has touched keeps its '
      + 'literal forever — this arm is the tree half.').toEqual([])
  })
})
