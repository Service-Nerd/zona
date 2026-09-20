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
  console.log(`  ${d.padStart(5)}km  ${String(m.fitPct).padStart(5)}%   refused ${m.refusedPct}%   ${top}`)
}
console.log(`\n  WHOLE PRODUCT  ${now.productFitPct}%   (target 90-95%)`)

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
for (const d of Object.keys(now.byDistance)) {
  cmp(`${d}km`, now.byDistance[d].fitPct, base.byDistance[d]?.fitPct ?? 0)
}
if (!moved) console.log('   unchanged on every distance.')
else console.log(`\n   A MOVE IS NOT AUTOMATICALLY WRONG — it is automatically something to DECLARE.\n   Re-baseline with --write and say in the commit which number moved and why.`)
