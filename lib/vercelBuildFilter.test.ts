import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

/**
 * OPS-DEPLOY-FILTER-01 — the Vercel build filter, inside `npm run verify`.
 *
 * The filter itself is bash, because Vercel's ignoreCommand runs a shell in the
 * build container with no repo toolchain. Its falsification suite is bash for
 * the same reason. This wrapper exists so the suite actually RUNS: a check that
 * only executes when somebody remembers to type it is a check this repo has
 * already recorded as equivalent to no check at all (the eslint rule that
 * shipped with Next for a year and had never once run).
 *
 * ⚠️ The wrong-direction failure is the silent one. A filter that skips a build
 * it should have run ships nothing and presents as a successful deploy. So the
 * suite asserts BUILD on every ambiguous case, not just SKIP on the clear ones.
 */
describe('vercel build filter', () => {
  it('passes its own falsification suite in both directions', () => {
    const root = path.resolve(__dirname, '..')
    const out = execFileSync('bash', ['scripts/vercel-should-build.test.sh'], {
      cwd: root,
      encoding: 'utf8',
    })
    expect(out).toContain('0 failed')
    expect(out).not.toContain('FAIL')
    // The suite is worthless if it stops reaching cases. Assert the count too,
    // so a silently-skipped case fails rather than reading as a clean run.
    expect(out).toMatch(/6 passed, 0 failed/)
  })
})
