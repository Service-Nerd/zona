/**
 * measure:envelope — "are we fit for purpose, and is that better or worse than
 * last time?"
 *
 *   npm run measure:envelope            # print, and diff against the baseline
 *   npm run measure:envelope -- --write # re-baseline (ONLY with a declared reason)
 *
 * Re-baselining is a reviewable act: the JSON diff IS the statement of what a
 * change did to the population. Never run --write to make a test green.
 */
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { measureEnvelope, type EnvelopeMeasure } from '../lib/plan/envelopeMeasure'

const BASELINE = join(__dirname, '..', 'lib', 'plan', '__fixtures__', 'envelopeBaseline.json')
const WRITE = process.argv.includes('--write')

const now = measureEnvelope()
console.log(`\nFIT FOR PURPOSE — weighted population, stride ${now.stride}\n`)
for (const [d, m] of Object.entries(now.byDistance)) {
  const top = Object.entries(m.objections).slice(0, 2).map(([k, v]) => `${k} ${v}%`).join(', ')
  // ⚠️ AMENDMENTS 1, 2 AND 4 ARE ALL IN THIS LINE, and none of them is cosmetic.
  //   1 — `was` is the PRE-CORRECTION rate, printed beside the new one always.
  //       A number that rose because its definition moved must never appear
  //       alone (Hutchinson: "a re-score is a correction, never an improvement").
  //   2 — SERVED and door print EVERY run. A watched quantity nobody reads is a
  //       hidden one (Seiler, Sims).
  //   4 — door is PER BAND. There is deliberately no product-level door figure
  //       (McMillan: 80.3% and 100% are different promises).
  // ⚠️ AMENDMENT 4, AND THIS LINE NEARLY BROKE IT. McMillan's condition is that
  // `door` is reported PER BAND, never as a single figure, because 80.3% at
  // 4 km/week and 100% at 15 are different promises and averaging them hides
  // the runner who cannot get there. This script's unit is the DISTANCE, so
  // anything it prints is already an aggregate over volume bands.
  //
  // It is printed as `door~` and labelled, rather than dropped: hiding it would
  // make the exemption invisible, which is the other half of what WATCHED is
  // for. The per-band figures — the ones the amendment actually requires — are
  // `npm run review:cohort`, and the footer says so.
  const served = m.servedRefusedPct > 0
    ? `  served ${m.servedRefusedPct}%${m.doorPct !== null ? ` (door~ ${m.doorPct}% agg)` : ''}`
    : ''
  const was = m.fitPctPreCorrection !== m.fitPct ? `  [was ${m.fitPctPreCorrection}%]` : ''
  console.log(`  ${d.padStart(5)}km  ${String(m.fitPct).padStart(5)}%${was}   refused ${m.refusedPct}% (unserved ${m.unservedRefusedPct}%)${served}   ${top}`)
}
console.log(`\n  WHOLE PRODUCT  ${now.productFitPct}%   (target 90-95%)`)

// RUBRIC-GAPS-01(a) — PRINT THE SILENCE NEXT TO THE SCORE.
//
// `DAYS-SHORT-SILENCED` is §18 Am.'s exemption, and it raises the
// fit-for-purpose rate by ~18.7pp. The metric meant to watch it was declared in
// the rubric and NEVER IMPLEMENTED — it reported 0% because nothing called it.
//
// ⚠️ It is printed here, beside the number it inflates, on purpose. An
// exemption reported somewhere else is an exemption nobody reads.
const watchedRows = Object.entries(now.byDistance)
  .flatMap(([d, m]) => Object.entries(m.watched).map(([k, v]) => ({ d, k, v })))
  .filter(r => r.v > 0)
console.log(`\n  ⚠️ ZERO-REJECTION-SERVED-01 — a refusal that hands the runner a §118 plan is`)
console.log(`     EXCLUDED from the fit rate, neither pass nor fail. \`[was N%]\` is the same`)
console.log(`     population under the old bar where every refusal scored FAIL.`)
console.log(`     THE ENGINE DID NOT CHANGE. A rate that moves here moved by definition.`)
console.log(`     \`door~ N% agg\` is an AGGREGATE over volume bands and is NOT the promise.`)
console.log(`     Amendment 4 (McMillan) requires door PER BAND: npm run review:cohort`)

if (watchedRows.length) {
  console.log(`\n  WATCHED — exempted rules, counted but NOT scored:`)
  for (const r of watchedRows) console.log(`    ${r.d.padStart(5)}km  ${r.k} ${r.v}%`)
  console.log(`    (a rate that CLIMBS means an exemption is carrying more than it was measured carrying)`)
}

if (WRITE) {
  writeFileSync(BASELINE, JSON.stringify(now, null, 1) + '\n')
  console.log(`\nbaseline written: ${BASELINE}`)
  process.exit(0)
}
if (!existsSync(BASELINE)) {
  console.log('\n(no baseline yet — run with --write)')
  process.exit(0)
}
const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as EnvelopeMeasure
console.log(`\nversus baseline:`)
let moved = false
const cmp = (label: string, a: number, b: number) => {
  const d = +(a - b).toFixed(1)
  if (Math.abs(d) < 0.05) return
  moved = true
  console.log(`   ${label.padEnd(22)} ${b}% -> ${a}%  (${d > 0 ? '+' : ''}${d}pp)`)
}
cmp('WHOLE PRODUCT', now.productFitPct, base.productFitPct)
// RUBRIC-GAPS-01(a) — the WATCHED rates are diffed too, both directions.
// A fit rate that holds while an exemption's rate climbs is the exemption
// absorbing a regression, which is precisely the failure this metric exists
// to catch and precisely the one a fit-rate-only diff cannot see.
for (const d of Object.keys(now.byDistance)) {
  const nw = now.byDistance[d].watched ?? {}
  const bw = base.byDistance[d]?.watched ?? {}
  // ⚠️ Array.from, not spread — iterating a Set fails this tsconfig (CLAUDE.md).
  for (const k of Array.from(new Set(Object.keys(nw).concat(Object.keys(bw))))) {
    cmp(`${d}km ${k}`, nw[k] ?? 0, bw[k] ?? 0)
  }
}
for (const d of Object.keys(now.byDistance)) {
  cmp(`${d}km`, now.byDistance[d].fitPct, base.byDistance[d]?.fitPct ?? 0)
}
if (!moved) console.log('   unchanged on every distance.')
else console.log(`\n   A MOVE IS NOT AUTOMATICALLY WRONG — it is automatically something to DECLARE.\n   Re-baseline with --write and say in the commit which number moved and why.`)
