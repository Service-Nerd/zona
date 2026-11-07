import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { probeLiveness, MUTATIONS } from './invariantLiveness'
import { INVARIANT_CODES } from './invariants'

/**
 * Test-coverage proposal #5 — "prove each invariant can still fire. Any rule
 * that cannot be made to fail is dead." (Owed to the founder since 2026-09-07,
 * built 2026-09-11.)
 *
 * `verify:invariants` proves 93 rules are registered, declared, and do not
 * FALSE-fire on three canonical cases. Nothing proved the opposite property:
 * that a rule can fire at all. This repo has shipped a green tick with nothing
 * behind it more than once — `--section-gap`, the decorative-config family, D9's
 * `flexShrink` that could never fire, §97's two inert gates — so "it is checked"
 * has needed independent evidence for a while.
 *
 * ⚠️ THE OBVIOUS MEASUREMENT IS THE WRONG ONE. 86 of 93 invariants never fire
 * across 621 generated plans, and that is what a HEALTHY engine looks like — an
 * invariant is supposed to be silent. Silence cannot distinguish a working rule
 * from a dead one. So the battery breaks valid plans deliberately and records
 * which rules wake up.
 *
 * A rule nothing wakes is UNPROVEN, not proven dead. It lands in the baseline
 * with a reason, and the baseline may only SHRINK.
 */

const BASELINE = JSON.parse(
  readFileSync('lib/plan/__fixtures__/invariantLivenessBaseline.json', 'utf8'),
) as { _: string; reasons: Record<string, string>; unproven: Record<string, string> }

const report = probeLiveness()

describe('invariant liveness — a rule that cannot fail is not a check', () => {
  it('the probe is real: it wakes rules, and it does not wake everything', () => {
    // Guards both failure modes of a vacuous harness. If it woke nothing the
    // battery is broken; if it woke everything it is not discriminating and the
    // baseline below would be meaningless.
    expect(report.plansProbed).toBeGreaterThan(5)
    expect(MUTATIONS.length).toBeGreaterThan(30)
    expect(report.woken.size).toBeGreaterThan(25)
    expect(report.woken.size).toBeLessThan(INVARIANT_CODES.length)
  })

  it('every invariant is either PROVEN wakeable or recorded as unproven, with a reason', () => {
    const unaccounted = (INVARIANT_CODES as readonly string[])
      .filter(c => !report.woken.has(c) && !(c in BASELINE.unproven))
    expect(unaccounted, [
      'A NEW invariant landed that no mutation can wake.',
      '',
      'That is not automatically a defect — it may guard a plan SHAPE this harness',
      'never builds. But it has to be answered rather than assumed:',
      '  · add a mutation to MUTATIONS that breaks what it guards (preferred), or',
      '  · run `npm run invariant:liveness -- --write` and classify it in the',
      '    baseline as `corpus` (the harness cannot build that shape) or',
      '    `mutation` (the battery does not reach that field yet).',
      '',
      'Never classify it `unclassified` to get green. That column is the debt.',
    ].join('\n')).toEqual([])
  })

  it('the unproven list only ever shrinks', () => {
    const regressed = Object.keys(BASELINE.unproven).filter(c => !report.unwoken.includes(c))
    // A code leaving the list is GOOD — it means a mutation now wakes it. This
    // asserts the baseline was updated to match, so the debt count stays honest.
    expect(regressed, [
      `${regressed.length} invariant(s) are now wakeable but still listed as unproven.`,
      'Run `npm run invariant:liveness -- --write` to pay the debt down.',
    ].join('\n')).toEqual([])
  })

  it('the recorded reasons are from the fixed set', () => {
    const bad = Object.entries(BASELINE.unproven)
      .filter(([, r]) => !['corpus', 'mutation', 'static', 'unclassified'].includes(r))
    expect(bad).toEqual([])
  })

  it('the baseline carries no key the test ignores', () => {
    // 🔴 LIVENESS-BASELINE-METADATA-01. `generated`, `wokenCount` and
    // `totalInvariants` lived in this fixture and were dereferenced by NOTHING —
    // the decorative-config class, in a fixture rather than a config file.
    //
    // ⚠️ The gate is not here because an unread key is untidy. It is here because
    // THIS FILE IS WHERE A HUMAN LOOKS to answer "how many invariants are there
    // and how many wake", it answered 118/107 against a live registry of 139 for
    // 18 days, and that is where CLAUDE.md's stale 118 came from. A number in a
    // JSON fixture reads as MEASURED and gets quoted onward.
    //
    // The live counts already have owners — INVARIANT_CODES.length and
    // probeLiveness().woken — recomputed on every run by the arms above. A second
    // copy in a fixture is the duplicate that drifted.
    const READ_KEYS = ['_', 'reasons', 'unproven']
    const extra = Object.keys(BASELINE).filter(k => !READ_KEYS.includes(k))
    expect(extra, [
      `the baseline holds ${extra.length} key(s) this test never reads: ${extra.join(', ')}`,
      '',
      'An unread key in a fixture goes stale silently and reads as measured.',
      'Either assert it here, or do not write it in scripts/invariant-liveness.ts.',
    ].join('\n')).toEqual([])
  })
})
