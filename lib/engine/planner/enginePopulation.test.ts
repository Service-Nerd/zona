// ADR-027 B4f — the engine-population helper's own gate.
//
// 🔴 IT HAD NONE, AND THAT IS HOW IT SHIPPED THE 405-LINE BLIND SPOT AGAIN. `stripComments` was
// written block-pass-then-line-pass, so a `//` comment containing a `/*` opened a block that blanked
// real code to the next `*/`. 📐 Measured after the fix: **92 code lines across 10 tracked non-test
// files under `lib/` that the old ordering blanked and the correct one keeps** (code review measured
// 248 across 21 on a wider scope — different method, same defect).
//
// ⚠️ AND RESTORING THE BROKEN VERSION LEFT THE WHOLE SUITE GREEN — 67 arms across the four suites
// that read through it. Every one asserts what the engine CONTAINS, and a blanked window contains
// nothing. **That is exactly what `scripts/lib/strip-comments.test.py` records** ("restoring the
// broken version left four suites ALL GREEN"), in Python, for the same function. So this file tests
// the reader directly rather than through a consumer.
import { describe, it, expect } from 'vitest'
import { stripComments, engineSources, engineCode, engineRegion } from './__enginePopulation'

describe('stripComments — one ordered pass', () => {
  const kept = (src: string) => stripComments(src).replace(/ +$/gm, '')

  it('🔴 a `//` containing `/*` does NOT blank the next line — the whole defect', () => {
    expect(kept('const a = 1 // see /* note\nconst b = 2')).toBe('const a = 1\nconst b = 2')
  })

  it('🔴 and it does not run on to a later `*/` either', () => {
    const src = 'const a = 1 // open /*\nconst b = 2\nconst c = 3 /* real */\nconst d = 4'
    const out = kept(src).split('\n')
    expect(out[1], 'line 2 must survive').toBe('const b = 2')
    expect(out[3], 'line 4 must survive').toBe('const d = 4')
  })

  it('blanks a real block comment, across lines, and keeps the line count', () => {
    const src = 'const a = 1\n/* hidden\n   still hidden */\nconst b = 2'
    const out = stripComments(src).split('\n')
    expect(out).toHaveLength(4)
    expect(out[1].trim()).toBe('')
    expect(out[2].trim()).toBe('')
    expect(out[3]).toBe('const b = 2')
  })

  it('a `//` or `/*` inside a STRING is code, not prose', () => {
    expect(kept(`const a = "// not a comment"`)).toBe(`const a = "// not a comment"`)
    expect(kept(`const b = '/* also not */'`)).toBe(`const b = '/* also not */'`)
  })

  it('code after a block comment on the same line survives', () => {
    expect(stripComments('/* x */ const c = 3').trim()).toBe('const c = 3')
  })

  it('🔻 its two declared limits, asserted so a future fix is deliberate', () => {
    // Both are FALSE BLANKS, which is the better trade than a guard firing on prose — the same
    // judgement `scripts/lib/strip-comments.py` records, and lexing either properly needs a parser.
    // (1) quote state is per LINE, so a template literal's continuation reads as code.
    const tmpl = 'const a = `start\nlib/plan/* and a star\n`'
    expect(stripComments(tmpl).split('\n')[1], 'a `/*` in a template continuation blanks the rest')
      .not.toBe('lib/plan/* and a star')
    // (2) a regex ending in `//` reads as a line comment.
    expect(kept('const r = /a//\nconst s = 1').split('\n')[0]).toBe('const r = /a')
  })
})

describe('engineSources / engineRegion', () => {
  it('spans the old engine and L3, and never itself', () => {
    const paths = engineSources().map(s => s.path)
    expect(paths).toContain('lib/plan/ruleEngine.ts')
    expect(paths.filter(p => p.startsWith('lib/engine/planner/')).length).toBeGreaterThanOrEqual(4)
    // ⚠️ Its own header cites `deloadWeeks.has(` and `isLongRun(` as evidence, so counting itself
    // would make every arm fire on prose about the arm.
    expect(paths).not.toContain('lib/engine/planner/__enginePopulation.ts')
    expect(paths.every(p => !p.endsWith('.test.ts'))).toBe(true)
  })

  it('🔴 engineRegion THROWS when a marker is in no engine file — a deleted guard still fails', () => {
    // This is the difference between following a move and tolerating a deletion, which is the one
    // thing the three relocation-broken pins existed to distinguish.
    expect(() => engineRegion('function applyTaperLongRunCap(', 5)).not.toThrow()
    expect(() => engineRegion('function thisDoesNotExistAnywhere(', 5)).toThrow(/is in no engine file/)
  })

  it('engineCode is the stripped concatenation, so a count over it ignores prose', () => {
    const code = engineCode()
    expect(code.length).toBeGreaterThan(100_000)
    expect(code).not.toMatch(/FREE — infrastructure/)   // a header comment, blanked
    expect(code).toMatch(/export function applyTaperLongRunCap/)
  })
})
