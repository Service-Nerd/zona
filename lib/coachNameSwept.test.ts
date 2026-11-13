// BRAND-COACHNAME-HARDCODED-01 — the TREE half. `.githooks/pre-commit` reads STAGED files only.
//
// 🔴 A guard scoped to the diff cannot see the tree, which this repo already learned on colour:
// the one live hardcoded hex in the whole app survived because nothing had touched that file for
// months, and `sweep:colours` exists for exactly that reason. The same applies here — and it was
// not hypothetical: widening the commit guard's population to `lib/` revealed EIGHT committed
// literals it had never been able to see, including two live lock-screen push bodies and three
// AI prompts saying "You are Kit".
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')
const ROOTS = ['lib', 'app', 'components']
/** The one place the literal may exist. Everything else reads `BRAND.coachName`. */
const DEFINITION = /^const COACH_NAME = 'Kit'$/

/** Blank comment CONTENT while preserving line numbers — a name in prose is not a hardcode, and
 *  deleting comment lines instead of blanking them misreports every line number
 *  (HOOK-RGBA-COMMENTS-01). */
function stripComments(src: string): string {
  const out: string[] = []
  let i = 0, block = false, line = false
  while (i < src.length) {
    const c = src[i], n = src[i + 1]
    if (block) { if (c === '*' && n === '/') { block = false; out.push('  '); i += 2; continue } out.push(c === '\n' ? '\n' : ' '); i++; continue }
    if (line) { if (c === '\n') { line = false; out.push('\n'); i++; continue } out.push(' '); i++; continue }
    if (c === '/' && n === '*') { block = true; out.push('  '); i += 2; continue }
    if (c === '/' && n === '/') { line = true; out.push('  '); i += 2; continue }
    out.push(c!); i++
  }
  return out.join('')
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

  it('the sweep reaches the tree it claims to', () => {
    // An empty population passes vacuously, which is how a sweep comes to mean nothing.
    expect(files.length, 'the walker found nothing — this whole file is vacuous').toBeGreaterThan(300)
    expect(files.some(f => f.includes('/lib/coaching/'))).toBe(true)
    expect(files.some(f => f.includes('/components/'))).toBe(true)
  })

  it('🔴 no file outside the definition line holds the literal', () => {
    const hits: string[] = []
    for (const f of files) {
      const lines = stripComments(readFileSync(f, 'utf8')).split('\n')
      lines.forEach((l, i) => {
        if (/\bKit\b/.test(l) && !DEFINITION.test(l.trim())) hits.push(`${f.slice(ROOT.length + 1)}:${i + 1}`)
      })
    }
    expect(hits,
      'the coach name is hardcoded outside `const COACH_NAME`. Use `BRAND.coachName`. The '
      + 'pre-commit guard reads STAGED files only, so a file nobody has touched keeps its '
      + 'literal forever — this arm is the tree half.').toEqual([])
  })
})
