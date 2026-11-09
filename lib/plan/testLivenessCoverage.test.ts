import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { SUBJECTS } from '../../scripts/lib/liveness-subjects'

const ROOT = join(__dirname, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'test-liveness.ts')
const OWNER = join(ROOT, 'scripts', 'lib', 'liveness-subjects.ts')

/** 🔴 THE REAL OBJECT, NOT ITS SOURCE TEXT (code review, 2026-11-09).
 *
 *  The first cut of this gate regex-matched the map out of `test-liveness.ts`, and
 *  review found two fail-open defects in it within the hour: a row with `// ` in
 *  front still counted, so commenting one out removed it from the harness with
 *  every arm green; and the block boundary was `line === '}'` exactly, so ONE
 *  TRAILING SPACE on the closing brace widened the region into `NO_SUBJECT` and
 *  took the parsed count 31 -> 38, leaving the ratchet slack by seven.
 *
 *  ⚠️ Both are "bound the region, never grep the file" — the rule this file's own
 *  header cites — broken in the file that cites it. The map is now its own module
 *  and both the harness and this gate import it, so there is no parse to get
 *  wrong and no second copy to drift. */
const KEYS = Object.keys(SUBJECTS)
const ALL_SUBJECTS = Array.from(new Set(Object.values(SUBJECTS).flat()))
const subjectsOf = (key: string): string[] => SUBJECTS[key] ?? []

describe('TEST-LIVENESS-COVERAGE-01 — the mutation map is consistent with its own claim', () => {
  it('reads a real map — an empty population passes every other arm', () => {
    // `CLEAN — 0 files` was the first answer the colour sweep gave when it had
    // selected nothing. Refuse it here too.
    expect(KEYS.length, 'SUBJECTS keys parsed').toBeGreaterThan(20)
    expect(ALL_SUBJECTS.length, 'declared mutation subjects parsed').toBeGreaterThan(20)
  })

  it('🔴 ONE OWNER — nothing outside the module declares a map of its own', () => {
    // The row-proof arm this replaces asked "did my regex read every row?", which
    // is a question that only exists because there was a regex. Importing the
    // object answers it by construction. What is still worth asserting is that
    // the harness did not keep a copy: a second declaration would agree with this
    // one only by accident, which is the register this repo keeps
    // (deloadCadence, tierResolution, SESSION-KM-01, OPS-AI-OWNER-01).
    const script = readFileSync(SCRIPT, 'utf8')
    expect(script, 'test-liveness.ts declares its own SUBJECTS again')
      .not.toMatch(/const\s+SUBJECTS\s*[:=]/)
    expect(script, 'test-liveness.ts declares its own NO_SUBJECT again')
      .not.toMatch(/const\s+NO_SUBJECT\s*[:=]/)
    expect(script, 'the harness no longer imports the owner')
      .toContain("from './lib/liveness-subjects'")
    expect(existsSync(OWNER), 'the owner module is gone').toBe(true)
  })

  it('every key is a live test file, and every subject a live source file', () => {
    for (const k of KEYS) {
      expect(existsSync(join(ROOT, k)), `SUBJECTS key ${k} does not exist`).toBe(true)
    }
    for (const s of ALL_SUBJECTS) {
      expect(existsSync(join(ROOT, s)), `declared subject ${s} does not exist`).toBe(true)
    }
  })

  it('🔴 A — a declared SUBJECT whose own co-named test exists is mapped', () => {
    // Otherwise the harness reports on that source through a NEIGHBOUR's
    // assertions and never through the test written for it, which reads in the
    // output as if the source were covered.
    const gaps = ALL_SUBJECTS
      .map(s => s.replace(/\.ts$/, '.test.ts'))
      .filter(t => existsSync(join(ROOT, t)) && !KEYS.includes(t))
    expect(gaps, 'these sources are mutation subjects but their own tests never run against them')
      .toEqual([])
  })

  it('🔴 B — a key whose co-named source exists lists it among its subjects', () => {
    const drifted = KEYS
      .map(k => ({ k, co: k.replace(/\.test\.ts$/, '.ts') }))
      .filter(({ co }) => existsSync(join(ROOT, co)))
      .filter(({ k, co }) => !subjectsOf(k).includes(co))
      .map(({ k, co }) => `${k} does not mutate ${co}`)
    expect(drifted, 'a mapping names a consumer and not the module the test is named for')
      .toEqual([])
  })

  it('the covered count is ratcheted — it may rise, it must not silently fall', () => {
    // Raise this WITH THE REASON IN THE COMMIT, exactly as cohort:shape and
    // check:slow require. A fall means an entry was deleted, and that wants a look.
    expect(KEYS.length, 'SUBJECTS keys').toBeGreaterThanOrEqual(31)
  })

  it('the harness PRINTS its own coverage, and the figure is derived not written', () => {
    const src = readFileSync(SCRIPT, 'utf8')
    // Behavioural intent, asserted on the one thing a comment cannot fake: the
    // share must be computed from a live file count at runtime.
    expect(src).toMatch(/coverage: \$\{mapped\} of \$\{all\.length\}/)
    // ⚠️ AND THE STALE LITERAL MUST NOT COME BACK AS CODE — stripping comments
    // first, because `HOOK-RGBA-COMMENTS-01` is exactly this: searching for the
    // hardcoded value finds the COMMENT ABOUT the hardcoded value. Both this file
    // and the script's own header quote "22 of 373" to explain why it was wrong.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    expect(code, 'a hardcoded coverage figure is back in the code').not.toMatch(/\d+ of \d+ test files/)
  })

  it('states the denominator the same way the suite is globbed', () => {
    // A coverage figure measured over a different population than vitest runs
    // would be the denominator error this repo keeps paying for. Both are
    // lib + components + packages.
    const vitest = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')
    // ⚠️ EXACTLY these three, not "at least" them (code review, 2026-11-09). A
    // fourth include would silently FLATTER the printed share, because the
    // numerator would not grow with it — the denominator error this repo keeps
    // paying for, in the figure written to stop a denominator error.
    const include = vitest.match(/include:\s*\[([^\]]*)\]/)?.[1] ?? ''
    expect(include, 'vitest include could not be read — re-point this arm').not.toBe('')
    const globs = Array.from(include.matchAll(/'([^']+)'/g)).map(m => m[1])
    expect(globs.sort(), 'the vitest include set changed — the coverage denominator is wrong')
      .toEqual(['components/**/*.test.ts', 'lib/**/*.test.ts', 'packages/**/*.test.ts'])
    const counted = execFileSync('find', ['lib', 'components', 'packages', '-name', '*.test.ts'],
      { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    expect(counted.length).toBeGreaterThan(700)
  })
})
