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
 *  1. NEW SLOW TEST (the one that earns its keep). Any test at or above
 *     `REPORT_MS` that is not in the baseline FAILS. This is the moment the
 *     decision is cheap — a test appearing at 9s is a choice, not a discovery
 *     made six weeks later on a loaded CI runner.
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

/** A test at 70% of its budget is in danger even before CI is slower. */
const HARD_FRACTION = 0.7
/**
 * A test must be meaningfully above the REPORTING threshold before "you have
 * added a slow test" is a claim worth failing on.
 *
 * ⚠️ NOT ARBITRARY. This check's own first run failed on `hooksGate.test.ts`,
 * which measured 793, 847 and 1,063 ms on three consecutive full-suite runs —
 * it sits ON the 1,000 ms reporting line and crosses it with ordinary machine
 * noise. A gate that fires depending on which side of its own boundary a test
 * landed this minute is the cry-wolf shape NOISE-GATE-01 names, and the
 * disabling move for it is deleting the check. Everything at or above
 * REPORT_MS is still LISTED; only a genuinely slow newcomer fails.
 */
const NEW_FAIL_MS_MULTIPLE = 1.5
/** A step change, not creep. See the warning above. */
const DRIFT_TOLERANCE = 1.4
/** Orientation only — CI-TIMEOUT-01's measured runner ratio, in isolation. */
const CI_RATIO_FOR_ORIENTATION = 3.5

interface BaselineEntry { file: string; title: string; ms: number; reason: string }

function readSlowTests(): Array<{ file: string; title: string; ms: number }> {
  if (!existsSync(REPORT)) {
    console.error(`✗ ${REPORT} not found. Run \`npm run test\` first (it writes the report).`)
    process.exit(2)
  }
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  const out: Array<{ file: string; title: string; ms: number }> = []
  let total = 0
  for (const suite of report.testResults ?? []) {
    const file = String(suite.name).replace(process.cwd() + '/', '')
    for (const t of suite.assertionResults ?? []) {
      total++
      const ms = Math.round(t.duration ?? 0)
      if (ms >= REPORT_MS) out.push({ file, title: t.title, ms })
    }
  }
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
    return { ...s, reason: prev?.reason ?? 'TODO — state why this test is allowed to be slow.' }
  })
  writeFileSync(
    BASELINE,
    JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), testTimeoutMs: TEST_TIMEOUT_MS, tests: entries }, null, 2) + '\n',
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

const baseline: BaselineEntry[] = JSON.parse(readFileSync(BASELINE, 'utf8')).tests
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
    if (s.ms < REPORT_MS * NEW_FAIL_MS_MULTIPLE) {
      console.log(`          (listed, not gated: under ${Math.round(REPORT_MS * NEW_FAIL_MS_MULTIPLE)} ms — too close to the reporting line to call)`)
      continue
    }
    failures.push(
      `NEW SLOW TEST — ${s.file} · "${s.title}" at ${s.ms} ms.\n` +
      `    Make it faster, or add it to ${BASELINE} with a reason. Deciding now is cheap;\n` +
      `    discovering it on a loaded CI runner in six weeks is not.`,
    )
    continue
  }
  if (s.ms > hardMs) {
    failures.push(`HARD WALL — ${s.file} · "${s.title}" at ${s.ms} ms is over ${HARD_FRACTION * 100}% of the ${TEST_TIMEOUT_MS} ms budget.`)
  }
  if (s.ms > b.ms * DRIFT_TOLERANCE) {
    failures.push(
      `STEP CHANGE — ${s.file} · "${s.title}" went ${b.ms} -> ${s.ms} ms (>${DRIFT_TOLERANCE}x).\n` +
      `    This is a step change, not noise. Say what grew and why, then re-baseline.`,
    )
  }
}

for (const b of baseline) {
  // Only worth mentioning for a test that was genuinely slow — a registered
  // entry near the reporting line would print this every other run.
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
