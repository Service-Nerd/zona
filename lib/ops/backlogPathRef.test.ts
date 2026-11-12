// OPS-VERIFY-CI-LOCAL-DIVERGE-01 — `backlog-verify.mjs` passed on this machine and failed every
// CI job, and the whole difference was one `existsSync` call.
//
// 🔴 WHAT HAPPENED. `ULTRA-VOICE-REPURPOSED-01` names
// `coaching-review/2026-11-02/generated-plans.md` — a 1.6 MB generated corpus output matched by
// `.gitignore:32`. It is on the machine that generated it, so `existsSync` said "fine" and the
// script exited 0; a fresh checkout has never had it, so the same script, same commit, exited 1.
// **`verify: All jobs have failed`, while `npm run backlog:verify` was green locally all day.**
//
// ⚠️ AND I HAD BEEN RUNNING IT ALL DAY WITHOUT SEEING IT, because every invocation was piped into
// a `grep` for the counts — which discards the exit code. "Do not pipe away your instrumentation"
// is a lesson already in this repo, paid again.
//
// ⚠️ The pre-existing git fallback could not have caught it: it globs the BASENAME
// (`git ls-files '*generated-plans.md'`), and a file ignored in every dated folder is tracked
// nowhere, so that glob is empty by construction.
//
// 🔑 THE FIX IS A FUNCTION THAT CANNOT ASK THE FILESYSTEM. Every input to `classifyPathRef` comes
// from git, so its answer is identical on the authoring machine and in CI. **The signature is the
// guarantee** — there is no `exists` parameter to pass — and the first arm below asserts exactly
// that, because a future "just check the disk as a fallback" is how this comes back.
//
// ⚠️ Unit-tested rather than end-to-end on purpose: the script takes **43 seconds**, so running it
// twice (once in a clean worktree) to gate itself was never affordable. What WAS done once, by
// hand, and recorded here: the old script exits 1 and the new one exits 0 in the same
// `git worktree` at the same commit, which is the falsification this file cannot perform.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// ⚠️ NOT from `backlog-verify.mjs` itself: that is a SCRIPT, so importing it runs the whole
// 43-second verification and calls `process.exit`, which kills the vitest worker. The predicate
// lives in its own module for exactly the reason `lib/ops/testDurationRules.ts` does — and I
// made the mistake first, which is how I know the error message.
import { classifyPathRef } from '../../scripts/lib/backlog-path-ref.mjs'

type Inputs = { tracked: boolean; ignored: boolean; basenameTracked: boolean; declaredDead: boolean }
const NONE: Inputs = { tracked: false, ignored: false, basenameTracked: false, declaredDead: false }
const classify = (o: Partial<Inputs>) => classifyPathRef({ ...NONE, ...o }) as string

describe('🔴 the verdict cannot depend on the local filesystem', () => {
  it('takes no `exists` input at all — the signature IS the guarantee', () => {
    // If someone adds an `exists` escape hatch, this is what says so. A comment would not.
    const src = readFileSync('scripts/lib/backlog-path-ref.mjs', 'utf8')
    const sig = src.slice(src.indexOf('export function classifyPathRef'))
      .slice(0, src.slice(src.indexOf('export function classifyPathRef')).indexOf(')') + 1)
    expect(sig).toContain('tracked')
    expect(sig.toLowerCase(), 'the classifier must not be able to ask the disk').not.toContain('exist')
  })

  it('🔑 a path that exists ONLY on this machine is DEAD, which is what CI sees', () => {
    // The exact shape that broke CI, minus the ignore rule: present locally, never committed.
    // There is no input by which this function could be told it exists, so it cannot be fooled.
    expect(classify({})).toBe('dead')
  })

  it('and the decision is total — every combination resolves, none falls through', () => {
    const seen = new Set<string>()
    for (const tracked of [false, true])
      for (const ignored of [false, true])
        for (const basenameTracked of [false, true])
          for (const declaredDead of [false, true])
            seen.add(classify({ tracked, ignored, basenameTracked, declaredDead }))
    // ⚠️ `Array.from`, NOT `[...seen]` — CLAUDE.md § TypeScript documents that spread on a
    // `Set<string>` fails this project's target (TS2802), and I wrote the spread anyway. vitest
    // was green because esbuild does not typecheck; `tsc` caught it in `verify:ci`.
    expect(Array.from(seen).sort()).toEqual(['artefact', 'dead', 'declared', 'moved', 'tracked'])
  })
})

describe('the four verdicts, and the order between them', () => {
  it('tracked wins over everything — a committed file is never dead', () => {
    expect(classify({ tracked: true })).toBe('tracked')
    expect(classify({ tracked: true, ignored: true, declaredDead: true })).toBe('tracked')
  })

  it('🔴 gitignored is an ARTEFACT, not a dead reference', () => {
    // A generated corpus output is legitimately named by an item and legitimately absent from
    // every checkout. Calling it dead is what failed the build; calling it nothing would make it
    // silent, so it is listed and does not fail.
    expect(classify({ ignored: true })).toBe('artefact')
    expect(classify({ ignored: true, basenameTracked: true }), 'ignored outranks a basename hit')
      .toBe('artefact')
  })

  it('a basename tracked elsewhere is MOVED — the lenient arm, kept', () => {
    expect(classify({ basenameTracked: true })).toBe('moved')
  })

  it('and a declared dead-by-design entry is the last word before `dead`', () => {
    expect(classify({ declaredDead: true })).toBe('declared')
    expect(classify({ declaredDead: true, basenameTracked: true }),
      'a real file outranks a declaration that it is missing').toBe('moved')
  })
})
