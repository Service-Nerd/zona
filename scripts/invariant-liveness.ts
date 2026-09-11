/**
 * Invariant liveness report. `npm run invariant:liveness [-- --write]`
 *
 * Answers the question `verify:invariants` cannot: can each rule be made to FAIL?
 * See lib/plan/invariantLiveness.ts for why "never fires on a valid plan" is the
 * wrong signal (86 of 93 do not, and that is a healthy engine).
 */
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { probeLiveness, MUTATIONS } from '../lib/plan/invariantLiveness'
import { INVARIANT_CODES } from '../lib/plan/invariants'

const BASELINE = join(process.cwd(), 'lib/plan/__fixtures__/invariantLivenessBaseline.json')

const r = probeLiveness()
const all = (INVARIANT_CODES as readonly string[]).length
console.log(`plans probed : ${r.plansProbed}   mutations: ${MUTATIONS.length}`)
console.log(`WOKEN        : ${r.woken.size}/${all}  (${(r.woken.size / all * 100).toFixed(0)}%)`)
console.log(`UNPROVEN     : ${r.unwoken.length}\n`)

let prior: Record<string, string> = {}
try { prior = JSON.parse(readFileSync(BASELINE, 'utf8')).unproven ?? {} } catch { /* first run */ }

const byReason = new Map<string, string[]>()
for (const code of r.unwoken) {
  const reason = prior[code] ?? 'unclassified'
  byReason.set(reason, [...(byReason.get(reason) ?? []), code])
}
for (const [reason, codes] of Array.from(byReason).sort()) {
  console.log(`── ${reason} (${codes.length})`)
  codes.forEach((c: string) => console.log(`     ${c}`))
}

const newlyUnproven = r.unwoken.filter(c => !(c in prior))
const nowProven = Object.keys(prior).filter(c => !r.unwoken.includes(c))
if (nowProven.length) console.log(`\n✓ newly PROVEN (remove from baseline): ${nowProven.join(', ')}`)
if (newlyUnproven.length) console.log(`\n✗ NEW and unproven: ${newlyUnproven.join(', ')}`)

if (process.argv.includes('--write')) {
  const unproven: Record<string, string> = {}
  for (const c of r.unwoken) unproven[c] = prior[c] ?? 'unclassified'
  writeFileSync(BASELINE, JSON.stringify({
    _: 'Invariants no mutation can wake. UNPROVEN, not proven dead. This list may only SHRINK.',
    reasons: {
      corpus: 'the harness never builds this plan SHAPE (maintenance has its own generator; foundation / recalibration / ultra are not in the cohort grid). Not a defect in the check.',
      mutation: 'the battery does not yet perturb the field this rule reads. Add a mutation, not a fixture.',
      unclassified: 'nobody has looked yet. THIS is the column that should shrink.',
    },
    generated: new Date().toISOString().slice(0, 10),
    wokenCount: r.woken.size,
    totalInvariants: all,
    unproven,
  }, null, 2) + '\n')
  console.log(`\nbaseline written: ${r.unwoken.length} unproven`)
}
