import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { newSlowVerdict } from '@/scripts/check-test-duration'

/**
 * SUITE-CONTENTION-01 — `check:slow`'s rule 1 is load-normalised, and the script
 * has tests at all.
 *
 * 🔴 WHY THIS FILE EXISTS, TWICE OVER.
 *
 * **One: the script had NO tests.** `grep -rl check-test-duration --include=*.test.ts`
 * returned nothing, while this repo's standing rule is that a measurement script is a
 * check and a check needs a test. The defect it carried was arithmetic — the kind a
 * unit test catches in milliseconds and a 160-second suite run catches only if you
 * happen to be loaded that minute.
 *
 * **Two: the remedy had been applied to one of two rules in the same file.**
 * `CI-SLOW-LOAD-01` made rule 3 (step-change drift) compare each test's SHARE of the
 * suite total, with a header arguing the exact case: *"the same test measured 2,085 ms
 * in the full parallel suite and ~700 ms in isolation."* **Rule 1 was left comparing
 * absolute milliseconds**, and the variable that fixes it was declared three lines
 * above it.
 *
 * 📐 MEASURED 2026-10-15, four runs on one unchanged commit:
 *
 * | run | load | rule-1 findings |
 * |---|---|---|
 * | `verify`, with a second session running its own suite | **3.16x** | **7** |
 * | `verify`, quiet | **3.32x** | **1** (`sessionReconcile` at 1,572 ms) |
 * | `npm test` + `check:slow`, quiet | **1.61x** | **0** |
 * | clean worktree at HEAD, no uncommitted work | ~1.6x | **0** |
 *
 * Not one of the nine distinct tests belonged to the commit under test. Every one is a
 * plan-corpus generator sitting in the 0.6–1.6 s band, and `sessionReconcile
 * "(distance, km)"` measures **965 ms** on a quiet run.
 *
 * ⚠️ WHAT IS DELIBERATELY *NOT* NORMALISED: the hard wall (rule 2). A timeout is an
 * absolute thing, and the file's own header argues it. This test pins that too, because
 * "normalise everything" is the obvious over-correction.
 */

const SCRIPT = readFileSync('scripts/check-test-duration.ts', 'utf8')

/** The real figures from the four runs above, so the arms are not hypotheticals. */
const QUIET_LOAD   = 1.61
const LOADED_LOAD  = 3.32
const SESSION_RECONCILE_LOADED_MS = 1572
const SESSION_RECONCILE_QUIET_MS  = 965

describe('SUITE-CONTENTION-01 — rule 1 measures the code, not the machine', () => {
  it('🔴 THE INCIDENT: 1,572 ms at 3.32x is LISTED, not gated', () => {
    const v = newSlowVerdict(SESSION_RECONCILE_LOADED_MS, LOADED_LOAD)
    expect(v.verdict).toBe('listed')
    // 1572 / 3.32 = 473 — not remotely near the 1,500 ms line.
    expect(v.normalisedMs).toBe(473)
    expect(v.failsAboveMs).toBe(1500)
  })

  it('…and the same test on a quiet run was never a finding either', () => {
    // The point of the pair: the OLD rule's answer changed between these two runs
    // while the code did not. The new rule's answer is the same both times.
    const loaded = newSlowVerdict(SESSION_RECONCILE_LOADED_MS, LOADED_LOAD)
    const quiet  = newSlowVerdict(SESSION_RECONCILE_QUIET_MS, QUIET_LOAD)
    expect(quiet.verdict).toBe('listed')
    expect(loaded.verdict).toBe(quiet.verdict)
  })

  it('🔴 THE OTHER DIRECTION, which is the whole risk: a 9 s newcomer still FAILS at 3.32x', () => {
    // An arm proving only that things stop failing cannot tell a fixed gate from a
    // disabled one. The file's header makes this exact promise — *"a test appearing at
    // 9s is a choice"* — so the promise is asserted.
    const v = newSlowVerdict(9_000, LOADED_LOAD)
    expect(v.verdict).toBe('fails')
    expect(v.normalisedMs).toBe(2711)
  })

  it('a newcomer right at the line is decided by its normalised value, both ways', () => {
    // At 1x the line is unmoved from the old behaviour: 1,499 lists, 1,500 fails.
    expect(newSlowVerdict(1_499, 1).verdict).toBe('listed')
    expect(newSlowVerdict(1_500, 1).verdict).toBe('fails')
    // At 2x it takes twice as long to earn a failure, and exactly twice.
    // ⚠️ 2,999 is NOT the boundary: 2999/2 is 1499.5 and `Math.round` takes it to
    // 1,500. Found by the arm going red — a boundary case asserted from arithmetic
    // done in my head is how an off-by-one ships inside a test that looks careful.
    expect(newSlowVerdict(2_998, 2).verdict).toBe('listed')
    expect(newSlowVerdict(2_999, 2).verdict).toBe('fails')
    expect(newSlowVerdict(3_000, 2).verdict).toBe('fails')
  })

  it('⚠️ an unmeasurable load degrades to the OLD absolute rule, never to NO rule', () => {
    // `LOAD` is 1 when the baseline carries no `suiteMs` (one written before
    // CI-SLOW-LOAD-01). A zero, a NaN or a negative must not divide the measurement
    // away and hand back a permanent pass — that would be a gate switched off by a
    // missing field, which is this repo's most-recorded gate failure.
    for (const bad of [0, -1, NaN, Infinity]) {
      expect(newSlowVerdict(9_000, bad as number).verdict,
        `load=${bad} must fall back to absolute, not pass everything`).toBe('fails')
      expect(newSlowVerdict(900, bad as number).verdict).toBe('listed')
    }
  })

  it('the verdict is a FUNCTION OF THE CODE: same test, five loads, one answer', () => {
    // The property the item was filed about — "a gate whose answer depends on what else
    // is running is the NOISE-GATE-01 shape". A test that genuinely costs 900 ms at
    // baseline load scales with the suite, so every run must agree.
    const trueCostMs = 900
    const answers = [1, 1.61, 2.5, 3.16, 3.32].map(load =>
      newSlowVerdict(Math.round(trueCostMs * load), load).verdict)
    expect(new Set(answers).size, `verdict moved with load: ${answers.join(', ')}`).toBe(1)
    expect(answers[0]).toBe('listed')

    // And the same for one that genuinely IS slow.
    const slowAnswers = [1, 1.61, 3.32].map(load =>
      newSlowVerdict(Math.round(4_000 * load), load).verdict)
    expect(new Set(slowAnswers).size).toBe(1)
    expect(slowAnswers[0]).toBe('fails')
  })

  it('⚠️ the HARD WALL is still absolute, and that is deliberate', () => {
    // Over-correcting by normalising rule 2 would let a test crawl toward a real
    // timeout while the suite grew around it. Asserted on the source, because the rule
    // is a few lines of inline comparison against `budgetMs` rather than a function —
    // and a source assertion is the honest instrument for "this code was NOT changed".
    expect(SCRIPT).toContain('const budgetMs = b.budgetMs ?? TEST_TIMEOUT_MS')
    expect(SCRIPT).toContain('if (s.ms > wallMs) {')
    // `s.ms`, not a normalised value, inside the wall comparison.
    expect(SCRIPT).not.toMatch(/wallMs[\s\S]{0,80}normalisedMs/)
    // ⚠️ WHITESPACE-NORMALISED. The first cut used a plain `toContain` and went red
    // on a phrase that IS in the file but WRAPPED across two comment lines — the
    // matcher was wrong, not the source. A prose assertion over wrapped comments
    // has to collapse whitespace or it is asserting the line width.
    const prose = SCRIPT.replace(/\s+/g, ' ')
    expect(prose, 'the reason the wall stays absolute must stay written down')
      .toContain('a timeout is an absolute thing')

    // 🔴 AND THE CLAIM BESIDE IT MUST NOT GO STALE AGAIN. That comment read "the
    // hard wall and the new-slow-test rule stay in absolute ms" — true when
    // written, falsified by this very change, and the THIRD such comment found in
    // this repo in one day. The code and the sentence are now checked together.
    expect(prose,
      'a comment still claims the new-slow-test rule is absolute. It normalises.')
      .not.toContain('the new-slow-test rule stay in absolute ms')
  })

  it('rule 3 still normalises, so the two rules cannot drift apart again', () => {
    // The adjacent register: rule 3 was right and rule 1 was wrong for three weeks
    // because nothing compared them. This arm is that comparison.
    expect(SCRIPT).toContain('const expectedMs = b.ms * LOAD')
    expect(SCRIPT).toMatch(/newSlowVerdict\(s\.ms,\s*LOAD\)/)
  })
})
