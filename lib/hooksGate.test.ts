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
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

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

/** Run the repo's own hooks config over one file. Returns exit code + output. */
function runGate(source: string): { code: number; out: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'hooks-gate-'))
  const file = path.join(dir, 'Fixture.tsx')
  writeFileSync(file, source, 'utf8')
  try {
    execFileSync(
      'npx',
      ['eslint', '--no-eslintrc', '--config', './.eslintrc.hooks.json', '--quiet', file],
      { cwd: process.cwd(), encoding: 'utf8', stdio: 'pipe' },
    )
    return { code: 0, out: '' }
  } catch (err: any) {
    return { code: err.status ?? -1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('rules-of-hooks gate (HOOKS-LINT-01)', () => {
  it('goes RED on a hook called after an early return', () => {
    const { code, out } = runGate(VIOLATION)
    expect(code).not.toBe(0)
    expect(out).toContain('react-hooks/rules-of-hooks')
  }, 60_000)

  it('stays GREEN when the same hook sits above the early return', () => {
    const { code } = runGate(CLEAN)
    expect(code).toBe(0)
  }, 60_000)
})
