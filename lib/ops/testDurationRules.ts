/**
 * SUITE-CONTENTION-01 — the two arithmetic rules behind `npm run check:slow`, as pure
 * functions, in a module that can be imported without running anything.
 *
 * 🔴 WHY THEY LIVE HERE AND NOT IN THE SCRIPT, and it is not tidiness.
 * `scripts/check-test-duration.ts` is a SCRIPT: it reads `.vitest-report.json` at module
 * scope, loops, prints and calls `process.exit`. Importing a function from it therefore
 * **runs the whole gate**, and on a non-zero verdict `process.exit(1)` kills the vitest
 * worker — the suite reports *"no tests"* rather than a failure.
 *
 * ⚠️ THE FIRST CUT OF `testDurationGate.test.ts` DID EXACTLY THAT, and its twelve arms
 * passed only because the gate happened to be green at the time. **Found by a
 * falsification that stayed green**: unwiring the rule-3 branch should have turned an
 * arm red and instead produced "no tests", because the mutation made the gate exit 1 and
 * took the worker with it. A test whose result depends on the current contents of
 * `.vitest-report.json` is not a test of these rules.
 *
 * So the script imports from here, and the test imports from here. Neither imports the
 * other.
 */

/** From `vitest.config.ts`'s `slowTestThreshold`. The script reads the real value and
 *  passes it in; this default exists so the rules are callable on their own. */
export const REPORT_MS_DEFAULT = 1_000

/**
 * A test must be meaningfully above the REPORTING threshold before "you have added a
 * slow test" is a claim worth failing on.
 *
 * ⚠️ NOT ARBITRARY. `check:slow`'s own first run failed on `hooksGate.test.ts`, which
 * measured 793, 847 and 1,063 ms on three consecutive full-suite runs — it sits ON the
 * 1,000 ms line and crosses it with ordinary machine noise. A gate that fires depending
 * on which side of its own boundary a test landed this minute is the cry-wolf shape
 * NOISE-GATE-01 names, and the disabling move for it is deleting the check.
 */
export const NEW_FAIL_MS_MULTIPLE = 1.5

/** A step change, not creep. */
export const DRIFT_TOLERANCE = 1.4

/**
 * A load factor that is absent, zero or nonsense must not divide a measurement away.
 * An unmeasurable load degrades to the OLD absolute behaviour, never to no check — a
 * gate switched off by a missing field is this repo's most-recorded gate failure.
 */
function safe(load: number): number {
  return Number.isFinite(load) && load > 0 ? load : 1
}

/**
 * RULE 1 — is this un-baselined test a slow NEWCOMER, or just a normal test on a busy
 * machine?
 *
 * 🔴 IT USED TO COMPARE ABSOLUTE MILLISECONDS WHILE RULE 2 BELOW ALREADY DID NOT
 * (`CI-SLOW-LOAD-01`), and `LOAD` — the variable that fixes it — was declared three
 * lines above it in the script. `SUITE-CONTENTION-01`, 2026-10-15: `sessionReconcile
 * "(distance, km)"` failed this rule at **1,572 ms on a 3.32x run** — 473 ms normalised,
 * and 965 ms on a quiet one. The same morning it produced **seven** findings at 3.16x and
 * **zero** at 1.61x, none belonging to the commit under test.
 *
 * `load` is this run's suite total over the baseline's. It mixes machine contention with
 * SUITE GROWTH since the baseline was written, and both belong here: a test at 1,572 ms
 * in a suite 3.3x heavier than when the line was drawn is not a 1,572 ms test, whichever
 * cause did it.
 */
export function newSlowVerdict(
  ms: number,
  load: number,
  reportMs: number = REPORT_MS_DEFAULT,
  failMultiple: number = NEW_FAIL_MS_MULTIPLE,
): { verdict: 'fails' | 'listed'; normalisedMs: number; failsAboveMs: number } {
  const normalisedMs = Math.round(ms / safe(load))
  const failsAboveMs = Math.round(reportMs * failMultiple)
  return { verdict: normalisedMs >= failsAboveMs ? 'fails' : 'listed', normalisedMs, failsAboveMs }
}

/**
 * The load factor RULE 3 must use for ONE test: the rest of the suite's growth, excluding
 * the test being judged from both sides.
 *
 * 🔴 WHY, MEASURED (2026-11-08, `CHECK-SLOW-NOISE-01`). `LOAD = SUITE_MS / BASE_SUITE_MS`
 * includes the test under evaluation, so **a test that grows inflates the denominator it is
 * measured against and partially hides itself.** The bigger its share, the more it hides.
 *
 * 📐 Falsified against a real 9-worker report: `targetedGrid`'s main arm is **14.0% of the
 * suite** and rule 3 first fired at **k = 3.5x**, not at the declared `DRIFT_TOLERANCE` of
 * 1.4x. Predicted 3.47 from the share and measured 3.5 by stepping k through 2 / 3 / 3.5 / 4 /
 * 5. **A tolerance that reads 1.4 in the source and behaves as 3.5 on the largest test in the
 * suite is not a tolerance.** Excluding self moves it to ~3.0; the remaining gap is a
 * LEGITIMATE share decline (25.9% of the suite when baselined, 14.0% now) and rule 3 is right
 * to allow that.
 *
 * ⚠️ IT DEGRADES, NEVER DISAPPEARS. If either exclusion leaves a non-positive total — a
 * single-test suite, a baseline entry larger than the recorded total — it falls back to the
 * whole-suite ratio, which is the old behaviour. A gate switched off by an edge case is this
 * repo's most-recorded gate failure.
 *
 * 🔴 BOTH RULES USE IT, AND THE FIRST CUT OF THIS CHANGE DID NOT — caught by
 * `testDurationGate.test.ts`'s own arm *"rule 3 still normalises, so the two rules cannot
 * drift apart again"*, which exists because rule 3 was right and rule 1 was wrong for three
 * weeks and nothing compared them. Moving only rule 3 onto a per-test load **re-created that
 * divergence inside the commit that was meant to improve it.** Rule 1 judges a test with no
 * baseline entry, so it passes `baselineMs: 0` — the baseline total legitimately never
 * included a newcomer, so only the numerator excludes it. **Exclude the test from whichever
 * sides it exists on; one owner, two callers.**
 */
export function loadForTest(
  suiteMs: number,
  baseSuiteMs: number,
  ms: number,
  baselineMs: number,
): number {
  const whole = safe(baseSuiteMs > 0 ? suiteMs / baseSuiteMs : 1)
  const restNow = suiteMs - ms
  const restBase = baseSuiteMs - baselineMs
  if (!(restNow > 0) || !(restBase > 0)) return whole
  return safe(restNow / restBase)
}

/**
 * RULE 3 — has a baselined test taken a STEP UP in its share of the suite?
 *
 * ⚠️ `baselineMs * load` is what this test WOULD have cost at the baseline share under
 * today's load. Comparing against that removes the machine and leaves the code.
 *
 * 🔴 AND THE PREMISE FAILS FOR ONE SHAPE, WHICH IS WHAT `isVolatile` IS FOR. The rule
 * reasons that a busier machine scales EVERY test. A test that shells out to a process
 * is not scheduled by this suite at all — it waits for a free core, and that wait is far
 * more volatile than the aggregate. Measured on `hooksGate.test.ts`: **483 / 492 /
 * 602 ms isolated** against **1,094 / 1,108 / 1,196 / 3,172 ms** in the full suite, a
 * **6.5x** swing on a run whose aggregate moved **1.84x**, with no change to the test.
 *
 * ⚠️ WHAT A VOLATILE DECLARATION COSTS, SAID PLAINLY: rule 3 can no longer catch a
 * genuine step change in that test. Rules 1 and 2 still apply, and the baseline entry's
 * `reason` must carry the measured isolated cost so the next reader can check it by
 * hand. The real fix is not to spawn — `GATE-SPAWN-VOLATILITY-01`.
 */
export function driftVerdict(
  ms: number,
  baselineMs: number,
  load: number,
  isVolatile = false,
  tolerance: number = DRIFT_TOLERANCE,
): 'fails' | 'ok' | 'skipped' {
  if (isVolatile) return 'skipped'
  return ms > baselineMs * safe(load) * tolerance ? 'fails' : 'ok'
}
