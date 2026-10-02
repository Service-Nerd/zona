import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// CI-CHAIN-OWNER-01 — EVERY STEP IN `verify` RUNS IN CI, OR SAYS WHY NOT.
//
// 🔴 WHAT THIS COST. `.github/workflows/verify.yml` used to enumerate the chain's
// steps by hand. On 2026-09-15 someone noticed three were missing, added them,
// and wrote the cause into the file: "this file was never updated, because it
// enumerates steps individually rather than calling the chain." By 2026-10-02
// FOUR were missing again, and two of them — `review:cohort` and `audit:plans` —
// had never run in CI once, since either script existed.
//
// `review:cohort` is the coaching cohort ratchet. It had been red on main for
// over nine days, against a baseline that was HAND-EDITED instead of regenerated:
// one cell written as 16.9 where the engine produced 16.7, carrying forward a
// drift that was already in the file. Nothing caught it. It was found by a human
// typing the full command — the one act this workflow exists to make unnecessary.
//
// ⚠️ A HAND-COPIED LIST IS THE DEFECT, NOT THE OMISSION. Fixing the list again
// would be the third round of the same repair. So `verify:ci` is now the single
// owner of what must pass, CI calls it, and this test is what stops the two
// drifting: a step added to `verify` alone fails the build.
//
// ⚠️ WHAT IT CANNOT CHECK: whether a step PASSES on a runner. Adding a step to CI
// can fail for environment reasons (no git identity, a slower clock, a missing
// binary) that no local test can see. That is what the first push after this
// commit is for, and the workflow change is one line to revert.

const ROOT = join(__dirname, '..', '..')
const WORKFLOW = join(ROOT, '.github', 'workflows', 'verify.yml')

/**
 * Steps a `npm run a && npm run b` chain runs, in order.
 * Anything that is not an `npm run <script>` link (a bare command, an env
 * assignment) is ignored — those are not chain steps and have no CI equivalent.
 */
function chainSteps(script: string): string[] {
  return script
    .split('&&')
    .map(s => s.trim())
    .map(s => /^npm run ([\w:-]+)$/.exec(s)?.[1])
    .filter((s): s is string => !!s)
}

function scripts(): Record<string, string> {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts
}

/** Every `npm run <script>` the workflow invokes, from its `run:` lines. */
function ciInvokes(): Set<string> {
  const yml = readFileSync(WORKFLOW, 'utf8')
  const out = new Set<string>()
  for (const m of Array.from(yml.matchAll(/^\s*(?:- )?run: *npm run ([\w:-]+)/gm))) out.add(m[1]!)
  return out
}

/**
 * The ONLY steps allowed out of `verify:ci`, each with the reason, because an
 * exemption without a reason is just a shorter list — which is the defect.
 */
const CI_EXEMPT: Record<string, string> = {
  'check:slow':
    'Compares wall-clock test durations against a locally-recorded baseline, so it is '
    + 'machine-dependent by construction. A loaded runner would trip it for reasons that have '
    + 'nothing to do with the code, and a gate that cries wolf gets ignored. Its own header '
    + 'says it cannot measure CI.',
}

describe('CI runs the whole verify chain (CI-CHAIN-OWNER-01)', () => {
  // ⚠️ VACUITY FIRST. An empty population passes every other arm in this file,
  // and this repo has shipped that green tick more than once. Rename `verify`,
  // reshape the chain, or move the workflow and this fails rather than going
  // quiet.
  it('can read both chains and the workflow at all', () => {
    const s = scripts()
    expect(chainSteps(s.verify ?? '').length).toBeGreaterThan(1)
    expect(chainSteps(s['verify:ci'] ?? '').length).toBeGreaterThan(5)
    expect(ciInvokes().size).toBeGreaterThan(0)
  })

  it('leaves no step of `verify` out of `verify:ci` without a written reason', () => {
    const s = scripts()
    const ci = new Set(chainSteps(s['verify:ci'] ?? ''))
    const missing = chainSteps(s.verify ?? '')
      .filter(step => step !== 'verify:ci')
      .filter(step => !ci.has(step) && !(step in CI_EXEMPT))
    expect(missing).toEqual([])
  })

  // The inverse arm, and the one that rots. A step that leaves `verify`
  // entirely leaves a stale exemption behind, which reads as a considered
  // decision about something that no longer exists.
  it('carries no stale exemption', () => {
    const s = scripts()
    const inVerify = new Set([
      ...chainSteps(s.verify ?? ''),
      ...chainSteps(s['verify:ci'] ?? ''),
    ])
    expect(Object.keys(CI_EXEMPT).filter(k => !inVerify.has(k))).toEqual([])
  })

  it('states a real reason for every exemption', () => {
    for (const [step, why] of Object.entries(CI_EXEMPT)) {
      expect(why.length, `${step} needs a reason, not a placeholder`).toBeGreaterThan(40)
    }
  })

  // 🔴 THE ARM THAT WOULD HAVE CAUGHT THE NINE DAYS. Covered either by CI
  // calling `verify:ci` itself (the intended shape) or by CI naming the step —
  // the second is allowed so splitting CI into parallel jobs stays possible, and
  // it still fails when a step is simply absent.
  it('actually runs every step of `verify:ci`', () => {
    const invoked = ciInvokes()
    if (invoked.has('verify:ci')) return
    const steps = chainSteps(scripts()['verify:ci'] ?? '')
    expect(steps.filter(step => !invoked.has(step))).toEqual([])
  })
})
