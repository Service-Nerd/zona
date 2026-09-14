// measure-deload-pos2.ts — DELOAD-POS2-01, the measured proposal §95 asked for.
//
// §87 forbids a deload OPENING a phase and implements it with ONE week of
// lookahead: if a deload would land on the first week of the next phase, place
// it a week early and re-anchor. §95 recorded that position 2 is "the same
// defect one week over" — one week of a new stimulus, then recovery from it —
// and added INV-PLAN-DELOAD-PHASE-POSITION (warn) to watch it. It fires on
// 16.1% of swept plans (2,570 / 15,973).
//
// The backlog says a fix "needs a measured proposal, not an edit", and records
// the wall: a +/-1 SHIFT is unimplementable because it steals a week from one
// loading block and gives it to the other, so Sims's rule-3 rejects both
// directions. §87's answer was not a shift but a WALK that re-anchors. This
// tests the same answer one week deeper: extend the lookahead to two weeks.
//
// Reports the three things the board must weigh:
//   1. position-2 rate before -> after
//   2. deload COUNT (Willy: recovery may RISE, never FALL)
//   3. worst loading run (Sims: never lengthen a loading block)
//
// Run: NODE_ENV=production npx tsx scripts/measure-deload-pos2.ts

import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { Plan } from '../types/plan'

type Phase = 'base' | 'build' | 'peak' | 'taper'

/** The SHIPPED walk (deloadCadence.computeDeloadWeeks), reproduced so the
 *  variant can be compared against it on identical inputs. Kept byte-faithful. */
function walk(totalWeeks: number, freq: number, phaseOf: (n: number) => Phase, lookahead: 1 | 2): Set<number> {
  if (!Number.isFinite(freq) || freq <= 0 || totalWeeks < 1) return new Set()
  const isFirstWeekOfPhase = (n: number) => n === 1 || phaseOf(n) !== phaseOf(n - 1)
  const inScope = (n: number) => {
    const p = phaseOf(n)
    return n >= 1 && n <= totalWeeks && p !== 'peak' && p !== 'taper'
  }
  const chosen = new Set<number>()
  let since = 0
  for (let n = 1; n <= totalWeeks; n++) {
    if (!inScope(n)) { since = 0; continue }
    const dueNow = since >= freq - 1
    const dueNext = since === freq - 2 && n + 1 <= totalWeeks && inScope(n + 1) && isFirstWeekOfPhase(n + 1)
    // THE PROPOSAL: the same lookahead, one week deeper. A deload that would
    // land on position 2 of the next phase is placed at the LAST week of the
    // current one — position 0 — which is §87's own stated ideal ("the runner
    // arrives fresh INTO the new block") rather than a +/-1 shift.
    // ⚠️ FIRST ATTEMPT, MEASURED AND REJECTED: `isFirstWeekOfPhase(n + 2)`
    // places the deload at S-2, so re-anchoring puts the NEXT one at
    // S-2+freq = S+1 for freq 3 — position 2. It CREATED the defect: 37.0% -> 50.0%.
    //
    // The correct target is S-1, the last week of the previous phase: re-anchoring
    // from there puts the next at S+freq-1, i.e. position 3+ for freq >= 3. So the
    // trigger is the SAME one-week lookahead §87 already uses, fired one count
    // earlier — `dueNext` catches "would land at position 1", this catches
    // "would land at position 2".
    const dueIn2 = lookahead === 2
      && since === freq - 3 && n + 1 <= totalWeeks && inScope(n + 1) && isFirstWeekOfPhase(n + 1)
    if (dueNow || dueNext || dueIn2) { chosen.add(n); since = 0 }
    else since++
  }
  return chosen
}

const worstRun = (weeks: number[], deloads: Set<number>, inScope: (n: number) => boolean) => {
  let run = 0, worst = 0
  for (const n of weeks) {
    if (!inScope(n)) { run = 0; continue }
    if (deloads.has(n)) { worst = Math.max(worst, run); run = 0 } else run++
  }
  return Math.max(worst, run)
}

let plans = 0, refused = 0
let pos2Before = 0, pos2After = 0
let countRose = 0, countFell = 0, countSame = 0
let runLengthened = 0, runShortened = 0
let changed = 0

for (const input of cohortGrid()) {
  let plan: Plan
  try { plan = generateRulePlan(input as never, 'paid', COHORT_PLAN_START) } catch { refused++; continue }
  plans++
  const total = plan.weeks.length
  const phaseOf = (n: number) => (plan.weeks.find(w => w.n === n)?.phase ?? 'base') as Phase
  const freq = (input as { age: number }).age >= GENERATION_CONFIG.MASTERS_AGE_THRESHOLD
    ? GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_MASTERS
    : GENERATION_CONFIG.RECOVERY_WEEK_FREQUENCY_STANDARD

  const before = walk(total, freq, phaseOf, 1)
  const after  = walk(total, freq, phaseOf, 2)

  const buildStart = plan.weeks.find(w => w.phase === 'build')?.n
  const atPos2 = (s: Set<number>) => buildStart != null && s.has(buildStart + 1)
  if (atPos2(before)) pos2Before++
  if (atPos2(after)) pos2After++

  if (after.size > before.size) countRose++
  else if (after.size < before.size) countFell++
  else countSame++

  const weeks = plan.weeks.map(w => w.n)
  const inScope = (n: number) => { const p = phaseOf(n); return p !== 'peak' && p !== 'taper' }
  const rb = worstRun(weeks, before, inScope)
  const ra = worstRun(weeks, after, inScope)
  if (ra > rb) runLengthened++
  if (ra < rb) runShortened++
  if (Array.from(before).join(',') !== Array.from(after).join(',')) changed++
}

const pct = (n: number) => plans === 0 ? 'n/a' : `${((n / plans) * 100).toFixed(1)}%`
console.log(`plans: ${plans}  refused: ${refused}`)
if (plans === 0) { console.error('FAIL: no plans generated.'); process.exit(1) }
console.log(`\n1. DELOAD AT BUILD POSITION 2`)
console.log(`   shipped (1-week lookahead) : ${pos2Before}  (${pct(pos2Before)})`)
console.log(`   proposal (2-week lookahead): ${pos2After}  (${pct(pos2After)})`)
console.log(`\n2. DELOAD COUNT (Willy — recovery may RISE, never FALL)`)
console.log(`   rose: ${countRose}  same: ${countSame}  FELL: ${countFell}   ${countFell === 0 ? '✅' : '❌ VIOLATES WILLY'}`)
console.log(`\n3. WORST LOADING RUN (Sims — never lengthen a loading block)`)
console.log(`   lengthened: ${runLengthened}  shortened: ${runShortened}   ${runLengthened === 0 ? '✅' : '❌ VIOLATES SIMS'}`)
console.log(`\nplans whose deload SET changes at all: ${changed}  (${pct(changed)})`)
