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

    // The suite is worthless if it stops reaching cases, so the count is
    // asserted too — but NOT by restating the number here.
    //
    // ⚠️ IT WAS, AND IT BROKE THE MOMENT THE SUITE GREW. This line read
    // `/14 passed, 0 failed \(14 cases ran\)/` while the shell script
    // asserted 14 itself. Two owners of one number: adding the five cases
    // that cover the `HEAD^` defect turned this red for no reason connected
    // to the filter, on the same commit as the fix. The shell script owns
    // its own case count (it exits non-zero if the tally is short, which
    // `execFileSync` would throw on); this asserts the SHAPE and a floor,
    // so it cannot drift and cannot silently accept a shrinking suite.
    const tally = out.match(/(\d+) passed, 0 failed \((\d+) cases ran\)/)
    expect(tally, 'the suite must print its tally').not.toBeNull()
    expect(tally![1], 'every case that ran must have passed').toBe(tally![2])
    expect(Number(tally![2]), 'the suite must not shrink below its known coverage')
      .toBeGreaterThanOrEqual(19)
  })
})
