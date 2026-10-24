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
import { measureEnvelope, envelopeMoves, type EnvelopeMeasure } from '../lib/plan/envelopeMeasure'

const BASELINE = join(__dirname, '..', 'lib', 'plan', '__fixtures__', 'envelopeBaseline.json')
const WRITE = process.argv.includes('--write')
// NO-RUNNER-TURNED-AWAY-01 — score §111 refusals as STAGED race plans (Q4). Never with --write: the CI gate runs with
// §116's flag off, so a staged baseline would fail every build until the flag flips, and then it would be re-written.
const STAGING = process.argv.includes('--staging')
if (STAGING && WRITE) { console.error('--staging and --write together would baseline unshipped behaviour. Refused.'); process.exit(2) }

const now = measureEnvelope(undefined, { staging: STAGING || undefined })
console.log(`\nFIT FOR PURPOSE — weighted population, stride ${now.stride}${STAGING ? '   ⚠️ STAGING ON (not shipped behaviour)' : ''}\n`)
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
  if (m.stagedPct > 0) {
    const so = Object.entries(m.stagedObjections).slice(0, 3).map(([k, v]) => `${k} ${v}%`).join(', ') || 'none'
    console.log(`           staged ${m.stagedPct}% (clean ${m.stagedCleanPct}%)   staged objections: ${so}`)
  }
}
if (Object.values(now.byDistance).some(m => m.stagedPct > 0)) {
  console.log(`\n  ⚠️ STAGED plans are scored at the door, the PASS case exactly at the line: the BEST case (Q4, chair).`)
  console.log(`     \`[was N%]\` is the founder's bar: every refusal and every unclean staged plan a fail.`)
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
console.log(`\nversus baseline (every recorded field, at its declared tolerance — ENVELOPE-BASELINE-UNGATED-01):`)
// The same comparator the build runs, so this diff and the test's verdict cannot disagree.
// Every change is printed; the ones the build FAILS on are marked, so a sub-tolerance drift is still seen.
const gated = new Set(envelopeMoves(now, base).map(m => m.split(':')[0]))
const moves = envelopeMoves(now, base, { exact: true })
for (const m of moves) console.log(`   ${gated.has(m.split(':')[0]) ? '✗ FAILS THE BUILD' : '· under tolerance '}  ${m}`)
const moved = moves.length > 0
if (!moved) console.log('   unchanged on every distance.')
else console.log(`\n   A MOVE IS NOT AUTOMATICALLY WRONG — it is automatically something to DECLARE.\n   Re-baseline with --write and say in the commit which number moved and why.`)
