import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// ⚠️ FROM THE RULES MODULE, NOT FROM THE SCRIPT. Importing from
// `scripts/check-test-duration.ts` RUNS THE GATE — it reads the report at module scope
// and calls `process.exit`, so these arms passed only while the gate happened to be
// green, and a mutation that turned it red killed the worker and reported "no tests"
// instead of a failure. Found by a falsification that stayed green.
import {
  newSlowVerdict, driftVerdict, loadForTest, baselineStaleVerdict,
  DRIFT_TOLERANCE, BASELINE_STALE_GROWTH,
} from '@/lib/ops/testDurationRules'

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
    // Both rules now reach the SAME load factor through the same module, which is the
    // structural reason they cannot diverge again — the previous divergence was two
    // independent expressions, one of which nobody compared to the other.
    // 🔄 WIDENED 2026-11-08 (CHECK-SLOW-NOISE-01) AND THE CLAIM IS STRONGER, NOT LOOSER.
    // Both rules used to be handed the suite-wide `LOAD`. That factor includes the test being
    // judged, so a test that grows inflates its own denominator: measured, `targetedGrid` is
    // 14.0% of the suite and rule 3 first fired at **3.5x** against a declared tolerance of
    // 1.4x. Both now reach `loadForTest` in the same module — rule 1 with `baselineMs: 0`,
    // because a newcomer is absent from the baseline total by definition.
    //
    // 🔴 THIS ARM CAUGHT THE FIRST CUT, WHICH MOVED ONLY RULE 3 and so re-created the very
    // divergence it was written for. Keep it asserting that BOTH reach the same owner.
    expect(SCRIPT).toMatch(/newSlowVerdict\(s\.ms,\s*newLoad/)
    expect(SCRIPT).toMatch(/driftVerdict\(s\.ms,\s*b\.ms,\s*testLoad/)
    // ⚠️ NAMED FIELDS, so these cannot assert an argument ORDER and do not need to: swapping
    // the pairs is a compile error now, not a silent inversion (see `loadForTest`'s docblock).
    expect(SCRIPT, 'rule 1 must reach the shared per-test load owner')
      .toMatch(/newLoad = [^\n]*loadForTest\(\{[^}]*baselineMs: 0/)
    expect(SCRIPT, 'rule 3 must pass the test\'s OWN baseline, not zero')
      .toMatch(/testLoad = [^\n]*loadForTest\(\{[^}]*baselineMs: b\.ms/)
    expect(SCRIPT, 'the rules must come from the module, not be redefined here')
      .toContain("from '../lib/ops/testDurationRules'")
    expect(SCRIPT, 'the script must not re-export the rules — that is what ran the gate')
      .not.toContain('export function')
  })

  /**
   * 🔴 THE SECOND MECHANISM, found by the gate firing on its own commit. Rule 3's
   * premise — *"a busier machine scales EVERY test, so a test's SHARE of the suite's
   * own total is load-invariant"* — is FALSE for a test that shells out to a process.
   * `hooksGate.test.ts` runs `npx eslint` on one temp fixture, so it waits for a free
   * core instead of being scheduled by this suite.
   *
   * 📐 MEASURED: **483 / 492 / 602 ms isolated** against **1,094 / 1,108 / 1,196 /
   * 3,172 ms** in the full suite — a **6.5x** swing on a run whose aggregate moved
   * **1.84x**, with no change to the test.
   */
  // ── 🔴 `loadForTest` IS CALLED HERE, AND THE FIRST CUT ONLY REGEXED THE SOURCE ──────
  //
  // Code review, 2026-11-08: the arms added with this function asserted that the SCRIPT
  // contains `newLoad = … loadForTest(` and `testLoad = … loadForTest(`. Both stayed green
  // when the function body was reverted to `return whole` — a full undo of the fix — and
  // also when the rule-1 arguments were SWAPPED to `loadForTest(SUITE_MS, BASE_SUITE_MS, 0,
  // s.ms)`, which inverts the exclusion and masks slow newcomers. **A source assertion
  // proves a call site exists; it cannot prove the call is right.** These arms call it.
  describe('loadForTest — the per-test denominator', () => {
    it('1. excludes the test from BOTH sides when it has a baseline entry', () => {
      // Rest-of-suite is unchanged (100 both sides), so the load is exactly 1 — the test
      // itself tripled and that is rule 3's business, not the denominator's.
      expect(loadForTest({ suiteMs: 130, baseSuiteMs: 110, ms: 30, baselineMs: 10 })).toBeCloseTo(1, 6)
      // And the whole-suite ratio it replaces would have said 1.18x, inflating the threshold.
      expect(130 / 110).toBeCloseTo(1.1818, 3)
    })

    it('2. excludes a NEWCOMER from the numerator only', () => {
      // `baselineMs: 0` — the entry does not exist, so nothing comes off the baseline side.
      expect(loadForTest({ suiteMs: 150, baseSuiteMs: 100, ms: 50, baselineMs: 0 })).toBeCloseTo(1, 6)
      // 🔴 THE ARGUMENT ORDER IS LOAD-BEARING AND A SWAP IS SILENT. Inverting it subtracts
      // the newcomer's cost from the BASELINE total instead, which lowers the denominator,
      // raises the load, and so hides a slow newcomer. Pinned as a distinct number.
      expect(loadForTest({ suiteMs: 150, baseSuiteMs: 100, ms: 0, baselineMs: 50 })).toBeCloseTo(3, 6)
    })

    it('3. a growing test can no longer inflate its own threshold — THE REAL INCIDENT', () => {
      // 📐 The measured case, with the numbers from the report rather than a toy share.
      // `targetedGrid`'s main arm, baselined at 21,963 ms in an 84,821 ms suite, measured at
      // 27,291 ms in a 195,052 ms one. The rest of the suite is 167,761 ms either way.
      const B_MS = 21_963, B_SUITE = 84_821, REST_NOW = 195_052 - 27_291
      const fires = (load: (ms: number) => number) => {
        for (let k = 1; k < 6; k += 0.001) {
          const ms = 27_291 * k
          if (driftVerdict(ms, B_MS, load(ms)) === 'fails') return Number(k.toFixed(3))
        }
        return Infinity
      }
      // The OLD factor: the suite total INCLUDES the grown test, so it rises with k.
      const whole = fires(ms => (REST_NOW + ms) / B_SUITE)
      // The NEW one: the test is off both sides, so the factor is constant.
      const perTest = fires(ms => loadForTest({ suiteMs: REST_NOW + ms, baseSuiteMs: B_SUITE, ms, baselineMs: B_MS }))
      expect(whole).toBeCloseTo(3.496, 2)
      expect(perTest).toBeCloseTo(3.007, 2)
      // 🔴 AND THE HONEST ATTRIBUTION, WHICH THE FIRST WRITE-UP HAD BACKWARDS. Self-exclusion
      // is worth 0.49 of the 2.12 gap; the remaining 1.63 was the six-week-stale `suiteMs`,
      // which `loadForTest` cannot touch and `baselineStaleVerdict` now gates.
      expect(whole - perTest).toBeCloseTo(0.49, 1)
      expect(perTest - 1.375).toBeCloseTo(1.63, 1)
    })

    it('4. fires at the DECLARED tolerance once the denominator is honest', () => {
      // The claim the source makes. k just under and just over 1.4, rest-of-suite flat.
      const base = 1_000, rest = 10_000
      for (const [k, want] of [[1.39, 'ok'], [1.41, 'fails']] as const) {
        const ms = base * k
        const load = loadForTest({ suiteMs: rest + ms, baseSuiteMs: rest + base, ms, baselineMs: base })
        expect(driftVerdict(ms, base, load), `k=${k}`).toBe(want)
      }
      expect(DRIFT_TOLERANCE).toBe(1.4)
    })

    it('5. DEGRADES to the whole-suite ratio, never to no check', () => {
      // The documented branch, unreachable from the real callers and so untested until now.
      // A single-test suite: excluding it leaves 0, which must not divide a measurement away.
      expect(loadForTest({ suiteMs: 50, baseSuiteMs: 40, ms: 50, baselineMs: 40 })).toBeCloseTo(50 / 40, 6)
      expect(loadForTest({ suiteMs: 50, baseSuiteMs: 40, ms: 60, baselineMs: 10 })).toBeCloseTo(50 / 40, 6)   // restNow negative
      expect(loadForTest({ suiteMs: 50, baseSuiteMs: 40, ms: 10, baselineMs: 60 })).toBeCloseTo(50 / 40, 6)   // restBase negative
      // And a zero/nonsense baseline total degrades to 1, not to Infinity or NaN.
      expect(loadForTest({ suiteMs: 50, baseSuiteMs: 0, ms: 10, baselineMs: 5 })).toBe(1)
      expect(Number.isFinite(loadForTest({ suiteMs: 50, baseSuiteMs: Number.NaN, ms: 10, baselineMs: 5 }))).toBe(true)
    })
  })

  // ── 🔴 THE OTHER DENOMINATOR, WHICH HAD NO GATE AND WAS THE BIGGER ONE ─────────────
  describe('baselineStaleVerdict — the denominator cannot rot in silence', () => {
    it('fires on growth past the declared line, and not before', () => {
      expect(BASELINE_STALE_GROWTH).toBe(1.15)
      expect(baselineStaleVerdict(1_150, 1_000).verdict).toBe('ok')      // exactly the line
      expect(baselineStaleVerdict(1_151, 1_000).verdict).toBe('fails')
      expect(baselineStaleVerdict(900, 1_000).verdict).toBe('ok')        // a shrinking suite is fine
      expect(baselineStaleVerdict(1_200, 1_000).growth).toBeCloseTo(1.2, 6)
    })

    it('⚠️ it must NOT be gateable on load — that is why it reads COUNT', () => {
      // Contention scales durations on a FIXED set of tests, so the count is unchanged and
      // this stays silent. Firing on a busy machine is the cry-wolf behaviour
      // SUITE-CONTENTION-01 was written to remove: a 3.32x contended run is normal here.
      expect(baselineStaleVerdict(7_394, 7_394).verdict).toBe('ok')
      // And the real stale case: ~4,300 tests at the 2026-09-24 baseline against 7,394.
      expect(baselineStaleVerdict(7_394, 4_300).verdict).toBe('fails')
    })

    it('a baseline with no testCount is UNKNOWN, never a silent pass', () => {
      // Degrades: a baseline written before the field existed must not fail the build. But it
      // must also not claim freshness, so the verdict is a third value the script prints.
      expect(baselineStaleVerdict(7_394, undefined).verdict).toBe('unknown')
      expect(baselineStaleVerdict(undefined, 7_394).verdict).toBe('unknown')
      expect(baselineStaleVerdict(7_394, 0).verdict).toBe('unknown')
      expect(baselineStaleVerdict(7_394, undefined).growth).toBeNull()
    })

    it('the committed baseline records a testCount and is fresh', () => {
      const base = JSON.parse(readFileSync('lib/plan/__fixtures__/testDurationBaseline.json', 'utf8'))
      expect(typeof base.testCount, 'the baseline must record testCount or freshness is unknowable').toBe('number')
      expect(base.testCount).toBeGreaterThan(0)
      // ⚠️ A register with a TODO reason is the debt-register failure this repo records.
      for (const e of base.tests as { file: string; reason: string }[]) {
        expect(e.reason, `${e.file}: a baseline entry must state WHY, not TODO`).not.toMatch(/^TODO/)
      }
    })

    it('the script reaches it, and treats unknown as unknown', () => {
      expect(SCRIPT).toMatch(/baselineStaleVerdict\(TEST_COUNT, baselineDoc\.testCount/)
      expect(SCRIPT, 'an unknown freshness must be SAID, not silently passed')
        .toContain("stale.verdict === 'unknown'")
      expect(SCRIPT, 'and --write must start recording the count').toMatch(/testCount: TEST_COUNT/)
    })
  })

  describe('rule 3 and process-spawn volatility', () => {
    it('a genuine step change still FAILS at any load', () => {
      // 1,000 -> 3,000 ms is a doubling of share at 1.5x load. That is the rule working.
      expect(driftVerdict(3_000, 1_000, 1.5)).toBe('fails')
      // And it is load-aware: the same 3,000 ms on a 3x run is the SAME share.
      expect(driftVerdict(3_000, 1_000, 3)).toBe('ok')
    })

    it('a DECLARED volatile entry is skipped — and only rule 3', () => {
      expect(driftVerdict(3_172, 1_094, 1.84)).toBe('fails')
      expect(driftVerdict(3_172, 1_094, 1.84, true)).toBe('skipped')
      // ⚠️ IT MUST NOT BECOME A BLANKET EXEMPTION. Rule 1 is a different function and
      // is untouched by the flag, so a volatile NEWCOMER is still gated.
      expect(newSlowVerdict(9_000, 1.84).verdict).toBe('fails')
    })

    it('🔄 the volatile set is EMPTY now, and that is the fix landing', () => {
      // 🔴 THIS ARM USED TO ASSERT `.toBe(2)` — both `hooksGate` arms. It went red on
      // 2026-11-08 and the red was CORRECT: `GATE-SPAWN-VOLATILITY-01` removed the `npx
      // eslint` spawn, so the two arms dropped from 1,094 / 1,106 ms to **189 ms** and fell
      // below the 1,000 ms reporting line entirely. They are not un-flagged; they are not in
      // the baseline at all. 📐 The spread that justified the flag collapsed from **6.5x**
      // (483/492/602 isolated vs 1,094/1,108/1,196/3,172 in-suite) to **1.23x** (171/172/211
      // isolated vs 189 in-suite). **The declaration was the bound; this is the fix.**
      //
      // ⚠️ AN EMPTY POPULATION MUST NOT MAKE AN ARM VACUOUS. The per-entry standard below
      // still runs for whatever lands next, and the FLAG'S MECHANISM is proven by the
      // `driftVerdict` arms above and the script-branch arm below, neither of which depends
      // on an entry existing. If this count ever goes up, the entry must earn it.
      const base = JSON.parse(readFileSync('lib/plan/__fixtures__/testDurationBaseline.json', 'utf8'))
      const vol = (base.tests as { file: string; reason: string; volatile?: true }[])
        .filter(e => e.volatile)
      expect(vol.length, 'the volatile set changed — is the new entry really spawn-bound, and was the spawn avoidable?').toBe(0)
      for (const e of vol) {
        expect(e.reason, `${e.file}: a volatile entry must name the ISOLATED cost`)
          .toMatch(/ISOLATION|isolated/i)
        expect(e.reason, `${e.file}: and why rule 3's premise fails for it`)
          .toMatch(/spawn/i)
      }
    })

    it('🔴 `--write` must CARRY a volatile declaration, not silently delete it', () => {
      // Found 2026-11-08 while re-baselining for SUITE-POOL-WALLCLOCK-01. `reason` and
      // `budgetMs` survived a re-baseline and `volatile` did NOT, with nothing saying so — so
      // `npm run check:slow -- --write`, the routine maintenance command, silently removed a
      // declared exemption, and rule 3 would then start crying wolf on the one shape its
      // premise is known to be false for. **An exemption a routine command can delete without
      // a diff line is not a declaration.** All three are carried now; removing one is an
      // edit someone makes on purpose.
      const carry = SCRIPT.slice(SCRIPT.indexOf('if (write) {'), SCRIPT.indexOf('writeFileSync('))
      for (const field of ['reason', 'budgetMs', 'volatile']) {
        expect(carry, `--write must carry ${field} forward from the previous entry`)
          .toContain(`prev?.${field}`)
      }
    })

    it('the volatile flag reaches the real gate, not just this test', () => {
      // A predicate nothing calls is the decorative-config class. Asserted on the
      // source, because the call site is a branch rather than a value.
      expect(SCRIPT).toMatch(/if \(b\.volatile\) \{/)
      expect(SCRIPT).toContain('rule 3 skipped: declared process-spawn volatile')
    })
  })
})
