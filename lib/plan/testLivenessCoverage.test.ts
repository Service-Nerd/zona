// testLivenessCoverage.test.ts — TEST-LIVENESS-COVERAGE-01.
//
// 🔴 WHY. `scripts/test-liveness.ts` is the harness built to catch a green tick
// with nothing behind it: it breaks the SOURCE each test claims to cover and
// checks the test notices. Its `SUBJECTS` map is DECLARED, never inferred, which
// is correct and deliberate ("a first-import-wins heuristic breaks silently the
// first time someone reorders an import block") — but NOTHING GREW IT and nothing
// reported that it was not growing. Its own header stated "22 of 373 test files,
// 5.9%" from 2026-09-24 to 2026-11-09; by then it was **27 of 761, 3.5%**, so the
// figure was wrong in both halves and in the flattering direction.
// **The harness against hollow tests was itself blind to 96% of the tests, and
// the file said 94%.**
//
// ⚠️ THE OBVIOUS GATE WOULD BE AN AMNESTY, AND THE ITEM SAID SO BEFORE I MEASURED
// IT. "Fail when a test imports from lib/ and has no entry" was measured two ways:
// test files reading source text = **295 of 761**; test files importing an
// already-declared subject = **307** (because `lib/plan.ts` is a barrel imported
// everywhere). A 300-entry baseline is a pile with a name, not a gate.
//
// 🔑 SO THIS GATE HOLDS THE MAP CONSISTENT WITH ITS OWN CLAIM instead, which is a
// population of FIVE and every one was a real gap:
//
//   A  a source the map already declares as a mutation subject, whose OWN co-named
//      test file is not a key — so the harness reported on that source through a
//      neighbour's assertions and never through the test written for it (4 cases:
//      effectiveSessions, loadRatioContext, weeklyZoneAggregate, plan)
//   B  a key whose co-named source exists and is NOT among its subjects — a mapping
//      that drifted (1 case: featureGates.test.ts named only its consumer, so a
//      mutation to the gate TABLE was never applied)
//
// ⚠️ WHAT IT DOES NOT DO: it does not make the share grow. Nothing schedules that,
// and saying so is the point — a declared reason is not a scheduled fix. The share
// is printed by the harness on every run so the gap is visible rather than implied.

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')
const SCRIPT = join(ROOT, 'scripts', 'test-liveness.ts')

/** The SUBJECTS object, bounded by its own braces.
 *
 *  🔴 BOUND THE REGION, NEVER GREP THE FILE. My own re-measurement of this item
 *  reported 34 keys because `grep -A 200` ran past the end of the object into
 *  later code. The real figure is 27. This repo has recorded that class four
 *  times, and I committed it while measuring the harness built to catch it. */
function subjectsBlock(): string {
  const src = readFileSync(SCRIPT, 'utf8')
  const i = src.indexOf('const SUBJECTS')
  expect(i, 'the SUBJECTS declaration has moved — re-point this gate').toBeGreaterThan(-1)
  const lines = src.slice(i).split('\n')
  const end = lines.findIndex(l => l === '}')
  expect(end, 'no closing brace at column 0 — the object shape changed').toBeGreaterThan(0)
  return lines.slice(0, end + 1).join('\n')
}

const BLOCK = subjectsBlock()
const KEYS = Array.from(BLOCK.matchAll(/'([^']+\.test\.ts)'\s*:/g)).map(m => m[1])

/** The subjects listed against one key. */
function subjectsOf(key: string): string[] {
  const at = BLOCK.indexOf(`'${key}'`)
  const seg = BLOCK.slice(at, BLOCK.indexOf(']', at) + 1)
  return Array.from(seg.matchAll(/'((?:lib|components|packages)\/[^']+\.ts)'/g))
    .map(m => m[1]).filter(p => p !== key)
}

const ALL_SUBJECTS = Array.from(new Set(KEYS.flatMap(subjectsOf)))

describe('TEST-LIVENESS-COVERAGE-01 — the mutation map is consistent with its own claim', () => {
  it('reads a real map — an empty population passes every other arm', () => {
    // `CLEAN — 0 files` was the first answer the colour sweep gave when it had
    // selected nothing. Refuse it here too.
    expect(KEYS.length, 'SUBJECTS keys parsed').toBeGreaterThan(20)
    expect(ALL_SUBJECTS.length, 'declared mutation subjects parsed').toBeGreaterThan(20)
  })

  it('🔴 PROVES IT READ EVERY ROW — a key-shaped line that does not parse fails, by line', () => {
    // DOC-AUDIT-REG-FORMAT-01: a pattern widened four times, each time because
    // someone found a row BY HAND. Any line mentioning a .test.ts path inside the
    // object must yield a key, or this gate is reporting on a subset it chose.
    const unparsed = BLOCK.split('\n')
      .map((l, n) => ({ l, n: n + 1 }))
      .filter(({ l }) => /\.test\.ts/.test(l) && !/^\s*\/\//.test(l))
      .filter(({ l }) => !/'[^']+\.test\.ts'\s*:/.test(l))
    expect(unparsed.map(u => `line ${u.n}: ${u.l.trim()}`),
      'a line names a test file and this gate could not read it as a key').toEqual([])
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
    expect(code, 'a hardcoded coverage figure is back in the code').not.toMatch(/\d+ of \d{3} test files/)
  })

  it('states the denominator the same way the suite is globbed', () => {
    // A coverage figure measured over a different population than vitest runs
    // would be the denominator error this repo keeps paying for. Both are
    // lib + components + packages.
    const vitest = readFileSync(join(ROOT, 'vitest.config.ts'), 'utf8')
    for (const dir of ['lib/', 'components/', 'packages/']) {
      expect(vitest, `vitest no longer globs ${dir} — the coverage denominator is wrong`)
        .toContain(`${dir}**/*.test.ts`)
    }
    const counted = execFileSync('find', ['lib', 'components', 'packages', '-name', '*.test.ts'],
      { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    expect(counted.length).toBeGreaterThan(700)
  })
})
