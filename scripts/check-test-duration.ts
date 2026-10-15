/**
 * CI-SLOW-DRIFT-01 — "is a test drifting toward the timeout wall?", answered
 * mechanically instead of printed.
 *
 *   npm run check:slow          # reads the report npm run test just wrote
 *   npm run check:slow -- --write   # re-baseline, WITH A DECLARED REASON
 *
 * ── WHY ──────────────────────────────────────────────────────────────────────
 * `targetedGrid.test.ts` went red in CI on the old 5,000 ms default. It was not
 * a regression: both sides of that day's change measured 8.65s -> 8.77s
 * (+1.4%). The test had been over the line for weeks. `vitest.config.ts` sets
 * `slowTestThreshold: 1000` precisely so "drift toward the wall is VISIBLE in
 * the run output before it is red" — and it worked exactly as designed. The
 * number was printed on every green run for weeks and nobody reads a green run.
 *
 * This repo's own recorded lesson: a rule that holds only while someone
 * remembers is not a rule. Printing is remembering.
 *
 * ── WHAT IT GATES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────────────
 * Three rules, in descending order of how much I trust them:
 *
 *  1. NEW SLOW TEST (the one that earns its keep). A test not in the baseline
 *     FAILS once its LOAD-NORMALISED duration clears the line. This is the
 *     moment the decision is cheap — a test appearing at 9s is a choice, not a
 *     discovery made six weeks later on a loaded CI runner.
 *
 *     🔴 IT USED TO COMPARE ABSOLUTE MILLISECONDS, AND RULE 3 BELOW ALREADY DID
 *     NOT (CI-SLOW-LOAD-01). SUITE-CONTENTION-01, 2026-10-15: `sessionReconcile
 *     "(distance, km)"` failed this rule at **1,572 ms on a 3.32x run** — 473 ms
 *     normalised, and 965 ms on a quiet one. The same morning the rule produced
 *     **SEVEN** findings at 3.16x and **ZERO** at 1.61x, none of them belonging
 *     to the commit under test. **The remedy had been applied to one of two
 *     rules in the same file**, and the variable that fixes it was declared
 *     three lines above. The hard wall (rule 2) stays absolute on purpose: a
 *     timeout is an absolute thing.
 *
 *  2. HARD WALL. No test may exceed `HARD_FRACTION` of `testTimeout`.
 *
 *  3. STEP-CHANGE DRIFT. A baselined test may not exceed its recorded duration
 *     by more than `DRIFT_TOLERANCE`.
 *
 * ⚠️ RULE 3 IS DELIBERATELY LOOSE AND THAT IS NOT AN OVERSIGHT. Wall-clock
 * duration varies with machine and load; a tight tolerance would fail on a busy
 * laptop, and NOISE-GATE-01 says a check that cries wolf gets disabled, which
 * this repo records as equal to having no check. So rule 3 catches a
 * STEP-CHANGE (someone doubling a grid), not the +1.4% creep that caused the
 * original incident. The creep is caught by the baseline being a COMMITTED
 * NUMBER that has to be re-written, in a diff, with a reason — the same
 * mechanism as `cohort:shape`. Never re-baseline to make this green.
 *
 * ⚠️ WHAT THIS CANNOT SEE. It measures the LOCAL machine under full-suite
 * contention. It cannot measure CI, and the two are not a simple multiple:
 * CI-TIMEOUT-01 measured a 3.5x runner on one case IN ISOLATION, and applying
 * that factor to a contended local number projects `targetedGrid` past the 30s
 * wall — which CI demonstrably does not hit. Those are different measurements
 * and multiplying them is the denominator error this repo has paid for. The CI
 * projection below is printed as ORIENTATION, never as a gate.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

const REPORT   = join(process.cwd(), '.vitest-report.json')
const BASELINE = join(process.cwd(), 'lib/plan/__fixtures__/testDurationBaseline.json')

/** From `vitest.config.ts`. Read here rather than restated, so they cannot drift. */
const TEST_TIMEOUT_MS = (() => {
  const cfg = readFileSync(join(process.cwd(), 'vitest.config.ts'), 'utf8')
  const m = cfg.match(/testTimeout:\s*([\d_]+)/)
  if (!m) throw new Error('cannot read testTimeout from vitest.config.ts')
  return Number(m[1].replace(/_/g, ''))
})()
const REPORT_MS = (() => {
  const cfg = readFileSync(join(process.cwd(), 'vitest.config.ts'), 'utf8')
  const m = cfg.match(/slowTestThreshold:\s*([\d_]+)/)
  if (!m) throw new Error('cannot read slowTestThreshold from vitest.config.ts')
  return Number(m[1].replace(/_/g, ''))
})()


// 🔴 THE RULES LIVE IN A MODULE, NOT IN THIS SCRIPT. This script EXECUTES at import
// time and calls `process.exit`, so a test importing a function from here ran the
// WHOLE GATE and died with it on a non-zero verdict — the suite reported "no tests"
// instead of a failure. Found by a falsification that stayed green, not by review.
// See `lib/ops/testDurationRules.ts`. SUITE-CONTENTION-01, 2026-10-15.
import {
  newSlowVerdict, driftVerdict, NEW_FAIL_MS_MULTIPLE, DRIFT_TOLERANCE,
} from '../lib/ops/testDurationRules'

/** Orientation only — CI-TIMEOUT-01's measured runner ratio, in isolation. */
const CI_RATIO_FOR_ORIENTATION = 3.5

/** A test at 70% of its budget is in danger even before CI is slower. */
const HARD_FRACTION = 0.7

interface BaselineEntry {
  file: string; title: string; ms: number; reason: string; budgetMs?: number
  /**
   * Exempt from RULE 3 ONLY. For a test whose cost is dominated by an external
   * PROCESS SPAWN rather than by work this suite schedules.
   *
   * 🔴 RULE 3's PREMISE DOES NOT HOLD FOR THESE, which is why an escape hatch is
   * correct rather than lazy. The rule reasons that *"a busier machine scales EVERY
   * test, so a test's SHARE of the suite's own total is load-invariant."* A test that
   * shells out to `npx` is not scheduled by this suite at all — it waits for a free
   * core, and that wait is far more volatile than the aggregate.
   *
   * 📐 MEASURED 2026-10-15 on `hooksGate.test.ts`: **483 / 492 / 602 ms in isolation**
   * against **1,094 / 1,108 / 1,196 / 3,172 ms** in the full suite. A **6.5x** swing on
   * a run where the suite aggregate moved **1.84x**, with no change to the test.
   *
   * ⚠️ WHAT IS LOST, SAID PLAINLY: rule 3 can no longer catch a genuine step change in
   * a volatile test. Rules 1 and 2 still apply, so a newcomer and the hard wall are
   * unaffected, and the entry's `reason` must carry the measured isolated cost so the
   * next reader can check it by hand. ⚠️ THE REAL FIX IS NOT TO SPAWN — eslint has a
   * Node API — which is `GATE-SPAWN-VOLATILITY-01`, filed rather than bolted on here.
   */
  volatile?: true
}

let SUITE_MS = 0
function readSlowTests(): Array<{ file: string; title: string; ms: number }> {
  if (!existsSync(REPORT)) {
    console.error(`✗ ${REPORT} not found. Run \`npm run test\` first (it writes the report).`)
    process.exit(2)
  }
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  const out: Array<{ file: string; title: string; ms: number }> = []
  let total = 0
  // ⚠️ THE DENOMINATOR. Rule 3 used to compare absolute milliseconds against a
  // baseline of absolute milliseconds, which is not a property of the CODE: the
  // same test measured 2,085 ms in the full parallel suite and ~700 ms in
  // isolation across three runs on the same commit. So the gate went red for
  // reasons that said nothing about the change, `npm run verify` sat at exit 1
  // all day, and a permanently-red gate is the same as no gate.
  //
  // A busier machine scales EVERY test, so a test's SHARE of the suite's own
  // total is load-invariant. That is the number rule 3 compares now. The hard
  // wall stays in absolute ms, because a timeout is an absolute thing.
  //
  // 🔴 THIS SENTENCE USED TO INCLUDE "and the new-slow-test rule", and it was
  // TRUE when written. SUITE-CONTENTION-01 made it false in the same commit that
  // fixed the rule — the third "a comment that was true when it was written"
  // in this repo in one day. Rule 1 normalises too now; only the wall does not.
  // `testDurationGate.test.ts` asserts the claim and the code agree.
  let suiteMs = 0
  for (const suite of report.testResults ?? []) {
    const file = String(suite.name).replace(process.cwd() + '/', '')
    for (const t of suite.assertionResults ?? []) {
      total++
      const ms = Math.round(t.duration ?? 0)
      suiteMs += ms
      if (ms >= REPORT_MS) out.push({ file, title: t.title, ms })
    }
  }
  SUITE_MS = suiteMs
  // An empty report is a probe that reached nothing, not a fast suite.
  if (total === 0) {
    console.error('✗ the report contains no tests at all. That is a broken report, not a fast suite.')
    process.exit(2)
  }
  console.log(`Read ${total} tests from the last full-suite run (measured under contention).`)
  return out.sort((a, b) => b.ms - a.ms)
}

const slow = readSlowTests()
const write = process.argv.includes('--write')

if (write) {
  const entries: BaselineEntry[] = slow.map(s => {
    const prev = existsSync(BASELINE)
      ? (JSON.parse(readFileSync(BASELINE, 'utf8')).tests as BaselineEntry[])
          .find(b => b.file === s.file && b.title === s.title)
      : undefined
    return { ...s, reason: prev?.reason ?? 'TODO — state why this test is allowed to be slow.', ...(prev?.budgetMs ? { budgetMs: prev.budgetMs } : {}) }
  })
  writeFileSync(
    BASELINE,
    JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), testTimeoutMs: TEST_TIMEOUT_MS, suiteMs: SUITE_MS, tests: entries }, null, 2) + '\n',
  )
  console.log(`✓ wrote ${entries.length} entries to ${BASELINE}.`)
  console.log('  Say in the commit WHICH number moved and why. Never re-baseline to go green.')
  process.exit(0)
}

// ⚠️ THIS GATES WHERE THE BASELINE WAS MEASURED, AND ONLY THERE.
// In CI the durations come from a different machine under a different load, so
// comparing them to a dev-machine baseline is comparing two different
// measurements — the denominator error the header warns about, and it would
// turn a green build red for a reason that says nothing about the commit.
// CI's protection against a runaway test is `testTimeout` itself, which is what
// CI-TIMEOUT-01 raised to 30 s. This check's job is to make drift a DECISION at
// commit time, which happens locally.
if (process.env.CI) {
  console.log('\nCI detected — reporting only.')
  console.log('The baseline is a local measurement; CI durations are not comparable to it.')
  console.log('A runaway test is caught in CI by testTimeout, not by this check.')
  for (const s of slow) console.log(`  ${String(s.ms).padStart(6)} ms  ${s.file} · ${s.title.slice(0, 60)}`)
  process.exit(0)
}

const baselineDoc = JSON.parse(readFileSync(BASELINE, 'utf8'))
const baseline: BaselineEntry[] = baselineDoc.tests
// The suite total the baseline was measured against. Absent on a baseline
// written before CI-SLOW-LOAD-01, in which case rule 3 falls back to absolute
// ms exactly as before -- degrade to the old behaviour, never to no check.
const BASE_SUITE_MS: number | null = typeof baselineDoc.suiteMs === 'number' && baselineDoc.suiteMs > 0
  ? baselineDoc.suiteMs : null
const LOAD = BASE_SUITE_MS && SUITE_MS > 0 ? SUITE_MS / BASE_SUITE_MS : 1
if (BASE_SUITE_MS) {
  console.log(`Suite total ${SUITE_MS} ms against a baseline of ${BASE_SUITE_MS} ms — this run is ${LOAD.toFixed(2)}x.`)
  console.log('Rule 3 compares each test\'s SHARE of that total, so a busy machine cannot trip it.')
}
const hardMs = Math.round(TEST_TIMEOUT_MS * HARD_FRACTION)
const failures: string[] = []

console.log(`\nBudget ${TEST_TIMEOUT_MS} ms · hard wall ${hardMs} ms (${HARD_FRACTION * 100}%) · report at ${REPORT_MS} ms\n`)

for (const s of slow) {
  const b = baseline.find(x => x.file === s.file && x.title === s.title)
  const pct = ((s.ms / TEST_TIMEOUT_MS) * 100).toFixed(1)
  const ci  = Math.round(s.ms * CI_RATIO_FOR_ORIENTATION)
  const delta = b ? `${s.ms >= b.ms ? '+' : ''}${(((s.ms - b.ms) / b.ms) * 100).toFixed(1)}%` : 'NEW'
  console.log(`  ${String(s.ms).padStart(6)} ms  ${pct.padStart(5)}% of budget  ${delta.padStart(7)}  ${s.file} · ${s.title.slice(0, 50)}`)
  console.log(`          (orientation only: x${CI_RATIO_FOR_ORIENTATION} isolated-CI ratio = ~${ci} ms — NOT a gate, see header)`)

  if (!b) {
    const v = newSlowVerdict(s.ms, LOAD, REPORT_MS)
    if (v.verdict === 'listed') {
      console.log(`          (listed, not gated: ${v.normalisedMs} ms at this run's ${LOAD.toFixed(2)}x load, under ${v.failsAboveMs} ms — too close to the reporting line to call)`)
      continue
    }
    failures.push(
      `NEW SLOW TEST — ${s.file} · "${s.title}" at ${s.ms} ms ` +
      `(${v.normalisedMs} ms normalised for this run's ${LOAD.toFixed(2)}x load).\n` +
      `    Make it faster, or add it to ${BASELINE} with a reason. Deciding now is cheap;\n` +
      `    discovering it on a loaded CI runner in six weeks is not.`,
    )
    continue
  }
  // ⚠️ A TEST'S OWN BUDGET, NOT THE GLOBAL ONE. `targetedGrid` declares
  // `}, 120_000)` at its call site and this rule was measuring it against the
  // 30,000 ms GLOBAL `testTimeout` — so a test at 18% of its real budget was
  // reported as being at 73% of a budget that does not apply to it. That is the
  // wrong denominator, which is the failure class this repo has recorded more
  // times than any other. A baseline entry may declare `budgetMs`; without one
  // the global applies, which is right for a newcomer that has justified nothing.
  const budgetMs = b.budgetMs ?? TEST_TIMEOUT_MS
  const wallMs = Math.round(budgetMs * HARD_FRACTION)
  if (s.ms > wallMs) {
    failures.push(`HARD WALL — ${s.file} · "${s.title}" at ${s.ms} ms is over ${HARD_FRACTION * 100}% of its ${budgetMs} ms budget.`)
  }
  // ⚠️ SHARE, NOT MILLISECONDS. `b.ms * LOAD` is what this test WOULD have cost
  // at the baseline share under today's load. Comparing against that removes the
  // machine from the measurement and leaves the code.
  const expectedMs = b.ms * LOAD
  if (b.volatile) {
    console.log(`          (rule 3 skipped: declared process-spawn volatile — ${b.reason.slice(0, 70)}…)`)
  } else if (driftVerdict(s.ms, b.ms, LOAD, b.volatile) === 'fails') {
    const shareNow = SUITE_MS > 0 ? ((s.ms / SUITE_MS) * 100).toFixed(2) : '?'
    const shareBase = BASE_SUITE_MS ? ((b.ms / BASE_SUITE_MS) * 100).toFixed(2) : '?'
    failures.push(
      `STEP CHANGE — ${s.file} · "${s.title}" went ${b.ms} -> ${s.ms} ms ` +
      `(share ${shareBase}% -> ${shareNow}% of the suite, >${DRIFT_TOLERANCE}x at this run's ${LOAD.toFixed(2)}x load).\n` +
      `    This is a step change, not noise. Say what grew and why, then re-baseline.`,
    )
  }
}

for (const b of baseline) {
  // Only worth mentioning for a test that was genuinely slow — a registered
  // entry near the reporting line would print this every other run.
  // ⚠️ `b.ms` is the BASELINE's own measurement, taken at the baseline's load, so
  // it is compared raw. Normalising it would be comparing a number to itself
  // through a factor that does not apply to it.
  if (b.ms >= REPORT_MS * NEW_FAIL_MS_MULTIPLE && !slow.some(s => s.file === b.file && s.title === b.title)) {
    console.log(`  · ${b.file} · ${b.title.slice(0, 50)} — now under ${REPORT_MS} ms. Drop the baseline entry.`)
  }
}

if (failures.length) {
  console.log(`\n✗ ${failures.length} duration finding(s):\n`)
  failures.forEach(f => console.log(`  ${f}\n`))
  process.exit(1)
}
console.log(`\n✓ ${slow.length} slow test(s), all baselined, none over the wall or stepped.`)
