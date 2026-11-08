// The rules-of-hooks gate must be ALIVE, not merely wired.
//
// HOOKS-LINT-01, 2026-09-12. `eslint-plugin-react-hooks` ships with Next and
// has been installed here for the life of the repo, but there was no eslint
// config at all, so `rules-of-hooks` had never once run over this code. It
// found HOOKS-ORDER-01 (the Coach crash) in about three seconds after an hour
// of manual searching, and HOOKS-ORDER-02 latent in TodayScreen alongside it.
//
// `npm run verify:hooks` now runs it on every build. But a gate that passes is
// indistinguishable from a gate that cannot fire — the exact lesson of the
// invariant-liveness work (`npm run invariant:liveness`), and of the four
// checks that were silently dead on first write. So this proves BOTH
// directions on every run:
//
//   1. a file with a known violation makes the gate exit NON-ZERO, naming
//      `react-hooks/rules-of-hooks`;
//   2. a file without one makes it exit ZERO.
//
// Fixtures are written to a temp dir, never committed — a committed fixture
// carrying a deliberate violation would either be linted by the gate itself or
// have to be excluded from it, and an exclusion is the thing that rots.
//
// If (1) fails, the gate has stopped seeing violations and every green run
// since is worth nothing. Do not "fix" it by deleting the assertion.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// eslint ships no type declarations and `@types/eslint` is not installed. A dev dependency
// for one test file's types is weight; the surface used here is four fields, so it is declared
// locally and narrowly. If this drifts from the real API the test fails at RUNTIME, loudly,
// which is the right failure direction for a gate that exists to prove it can go red.
// @ts-expect-error — eslint ships no .d.ts and `@types/eslint` is deliberately not installed.
// ⚠️ `@ts-expect-error`, never `@ts-ignore`: if eslint or its types ever arrive, THIS LINE goes
// red and the suppression gets deleted rather than outliving its reason.
import { ESLint as ESLintUntyped } from 'eslint'

type LintMessage = { ruleId: string | null; message: string; severity: number }
type ESLintCtor = new (opts: {
  useEslintrc: boolean
  overrideConfigFile: string
  cwd: string
}) => { lintText(code: string, opts: { filePath: string }): Promise<{ messages: LintMessage[] }[]> }
const ESLint = ESLintUntyped as unknown as ESLintCtor

const CONFIG = '.eslintrc.hooks.json'

const VIOLATION = `
import { useState } from 'react'
export function Broken({ ready }: { ready: boolean }) {
  if (!ready) return null
  const [n, setN] = useState(0)
  return <button onClick={() => setN(n + 1)}>{n}</button>
}
`

const CLEAN = `
import { useState } from 'react'
export function Fine({ ready }: { ready: boolean }) {
  const [n, setN] = useState(0)
  if (!ready) return null
  return <button onClick={() => setN(n + 1)}>{n}</button>
}
`

/**
 * Run the repo's own hooks config over one source string, IN PROCESS.
 *
 * 🔴 IT USED TO SPAWN `npx eslint` AND THE DURATION WAS A COIN FLIP
 * (`GATE-SPAWN-VOLATILITY-01`, fixed 2026-11-08). Measured when filed: **483 / 492 / 602 ms in
 * isolation against 1,094 / 1,108 / 1,196 / 3,172 ms in the full suite** — a **6.5× swing** on a
 * run whose suite aggregate moved 1.84×. The cost is not eslint; it is `npx` resolving a binary
 * and a cold Node process, twice, while nine vitest workers fight for the same cores.
 *
 * `SUITE-CONTENTION-01` bounded it by declaring both arms `volatile: true` in the duration
 * baseline, which exempts them from `check:slow`'s rule 3 — **a real loss, stated there: rule 3
 * can no longer catch a genuine step change in these two arms.** The declaration was the bound,
 * never the fix. The Node API removes the spawn at source, so the flag can be dropped rather
 * than carried.
 *
 * ⚠️ WHAT THE SPAWN WAS BUYING, AND HOW IT IS KEPT. Running the binary proved the CONFIG FILE
 * and the PLUGIN find the violation; it never proved anything about `npx` itself. `lintText`
 * loads the same `.eslintrc.hooks.json` through the same eslint, so the liveness claim is
 * unchanged — and the third arm below asserts `verify:hooks` still points at that same file, so
 * the config under test cannot drift away from the config the gate runs.
 */
async function runGate(source: string): Promise<{ failed: boolean; out: string }> {
  // `useEslintrc: false` + `overrideConfigFile` is the API form of the gate's own
  // `--no-eslintrc --config ./.eslintrc.hooks.json`. eslint 8 flat-config is NOT in use here.
  const eslint = new ESLint({ useEslintrc: false, overrideConfigFile: CONFIG, cwd: process.cwd() })
  const results = await eslint.lintText(source, { filePath: 'HooksGateFixture.tsx' })
  const messages = results.flatMap(r => r.messages)
  return {
    failed: messages.some(m => m.severity === 2),
    out: messages.map(m => `${m.ruleId ?? '?'}: ${m.message}`).join('\n'),
  }
}

describe('rules-of-hooks gate (HOOKS-LINT-01)', () => {
  it('goes RED on a hook called after an early return', async () => {
    const { failed, out } = await runGate(VIOLATION)
    expect(failed, 'the gate stopped seeing violations — every green run since is worth nothing').toBe(true)
    expect(out).toContain('react-hooks/rules-of-hooks')
  })

  it('stays GREEN when the same hook sits above the early return', async () => {
    const { failed, out } = await runGate(CLEAN)
    expect(failed, `clean source was rejected: ${out}`).toBe(false)
  })

  // 🔴 THE ARM THAT REPLACES THE SPAWN'S ONLY REAL GUARANTEE (GATE-SPAWN-VOLATILITY-01).
  // Linting in process proves the CONFIG finds the violation. It cannot prove that config is the
  // one `npm run verify:hooks` actually runs — and a test that lints a config nothing uses is the
  // hollow shape this repo keeps paying for. So: the script must still name this file.
  it('is testing the config the real gate runs', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> }
    const script = pkg.scripts['verify:hooks']
    expect(script, 'npm run verify:hooks must exist — it is the gate this test proves alive').toBeTruthy()
    expect(script, `verify:hooks must lint with ${CONFIG}`).toContain(CONFIG)
    expect(script, 'verify:hooks must disable eslintrc discovery, as this test does').toContain('--no-eslintrc')
  })
})
