import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

/**
 * STRENGTH-REP-BLOCKS-01 (Coaching Board 2026-10-28, C, Blagrove) — the general rep cycle is not a "toning" goal, and
 * no surface may claim strength tones anything: that is an outcome claim the evidence does not support. Comments are
 * prose and pass; a string or JSX text naming tone/toning is copy and fails.
 */
const ROOTS = ['app', 'components', 'lib', 'packages']
const files = (dir: string): string[] => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  if (statSync(p).isDirectory()) return f === 'node_modules' ? [] : files(p)
  return /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) ? [p] : []
})
/** The copy in a file: its string literals, template text and JSX text, read by the TypeScript parser so a comment
 *  (prose) never counts and a `/*` inside a string never hides what follows it (code review, 2026-10-28). */
function copyIn(src: string, file = 'x.tsx'): string[] {
  const out: string[] = []
  const walk = (n: ts.Node) => {
    if (ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) out.push(n.text)
    ts.forEachChild(n, walk)
  }
  walk(ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS))
  return out
}
const CLAIM = /\b(toning|tone up|toned up|tone your|tones your|get toned)\b/i
const claims = (src: string, file?: string) => copyIn(src, file).some(t => CLAIM.test(t))

describe('no toning claim on any surface', () => {
  it('no runner-facing copy names toning', () => {
    const hits = ROOTS.flatMap(files).filter(p => claims(readFileSync(p, 'utf8'), p))
    expect(hits).toEqual([])
  })
  it('🔴 the matcher catches the claim and ignores the comment', () => {
    expect(claims(`const t = 'Tone up your legs'`)).toBe(true)
    expect(claims(`const C = () => <p>Get toned for summer</p>`)).toBe(true)
    expect(claims(`// no toning claim here\nconst x = 1`)).toBe(false)
    expect(claims(`const tier = 'how it is TONED'`)).toBe(false)
    // A glob inside a string is not the start of a comment.
    expect(claims(`const g = 'lib/*'\nconst C = () => <p>Tone up your legs</p>\n/* a real comment */`)).toBe(true)
  })
})
