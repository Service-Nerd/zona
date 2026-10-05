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
// `_` and `reasons` are PROSE, amended by hand after a finding — so the writer
// reads them back and re-emits them unchanged rather than carrying its own copy.
// 🔴 It used to carry a copy, and the copy went stale in the dangerous direction:
// the writer still said `corpus` means "maintenance has its own generator", which
// is the exact claim MAINT-LIVENESS-01 (2026-09-19) DISPROVED — the 8 INV-MAINT-*
// codes were never unreachable by shape, the harness was calling the wrong
// validator. So `--write` would have silently reverted a documented correction
// and reinstated a falsified explanation. A second copy of prose is the same
// defect as a second copy of a number (LIVENESS-BASELINE-METADATA-01).
let priorNote = 'Invariants no mutation can wake. UNPROVEN, not proven dead. This list may only SHRINK.'
let priorReasons: Record<string, string> | null = null
try {
  const b = JSON.parse(readFileSync(BASELINE, 'utf8'))
  prior = b.unproven ?? {}
  if (typeof b._ === 'string') priorNote = b._
  if (b.reasons && typeof b.reasons === 'object') priorReasons = b.reasons
} catch { /* first run */ }

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
  // ⚠️ EVERY KEY WRITTEN HERE MUST BE READ by invariantLiveness.test.ts.
  // `generated`, `wokenCount` and `totalInvariants` lived here until 2026-10-05
  // and were dereferenced by NOTHING — the decorative-config class, in a fixture
  // instead of a config file. They are not merely useless: the baseline is where
  // a human looks to answer "how many invariants are there", it answered 118/107
  // against a live registry of 139, and that is where CLAUDE.md's stale 118 came
  // from. The live counts already have owners (`INVARIANT_CODES`, `r.woken`), so
  // a second copy in a fixture is the duplicate that drifted. Gated by
  // `invariantLiveness.test.ts` § "the baseline carries no key the test ignores".
  writeFileSync(BASELINE, JSON.stringify({
    _: priorNote,
    reasons: priorReasons ?? {
      corpus: 'the harness never builds this plan SHAPE (foundation / recalibration / ultra are not in the cohort grid). Not a defect in the check.',
      mutation: 'the battery does not yet perturb the field this rule reads. Add a mutation, not a fixture.',
      static: 'the rule reads STATIC CONFIGURATION (the catalogue, the plan '
        + 'signatures), not the plan, so no plan mutation can reach it by '
        + 'construction — a `Plan => void` cannot perturb a module constant. '
        + 'Not debt and not a defect: it needs a config test that breaks the '
        + 'data, which is a different harness. Name that test when you use this.',
      unclassified: 'nobody has looked yet. THIS is the column that should shrink.',
    },
    unproven,
  }, null, 2) + '\n')
  console.log(`\nbaseline written: ${r.unwoken.length} unproven`)
}
