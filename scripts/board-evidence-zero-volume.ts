/**
 * WIZARD-ZERO-VOLUME-REFUSAL-01 — EVIDENCE for the Coaching Board. READ-ONLY.
 *
 * Question: `current_weekly_km`/`longest_recent_run_km` sliders both reach 0, and
 * `WIZARD_VOLUME_RULER` accepts it. What does the engine DO with a declared zero?
 *
 * ⚠️ NODE_ENV=production — `INV-INPUT-LONGEST-LE-WEEKLY` throws in dev/test, and
 * part of this cohort is exactly the contradictory pair it rejects.
 *
 * ⚠️ THIS SCRIPT NOW REPRODUCES THE FIXED STATE, not the defect it was written
 * to show. The board ruled (§10 Amendment, 2026-10-09, CORRECT WITH AMENDMENT
 * x3): a declared zero is the lowest state, so section 1's ladder is monotone
 * and the HM/marathon rows in section 2 are REFUSED. The pre-fix figures are in
 * `coaching-rulings.md` and in §10 Amendment; this file is the probe that
 * produced them and is kept so the ladder can be re-derived rather than quoted.
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG as C } from '../lib/plan/generationConfig'
import { isLongRun } from '../lib/plan/sessionRole'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { sessionFloorsFor } from '../lib/plan/sessionFloors'
import corpus from '../lib/plan/__fixtures__/real-inputs.json'
const base = (corpus as any).cases[0].input
const PS = '2026-12-07'

const gen = (over: Record<string, unknown>) => {
  const input: any = { ...base, race_date: '2027-06-20', goal: 'finish',
    days_cannot_train: [], training_age: '<6mo', days_available: 4, ...over }
  try {
    const p: any = generateRulePlan(input, 'paid', PS)
    const wk = p.weeks.filter((w: any) => w.n > 0)
    let lr1 = 0
    for (const s of Object.values(wk[0]?.sessions ?? {}) as any[])
      if (s && s.type === 'easy' && isLongRun(s)) lr1 = Math.max(lr1, sessionKmSelfPaced(s) ?? 0)
    return { wk1: wk[0]?.weekly_km ?? 0, lr1 }
  } catch (e: any) { return { refused: e.name } }
}

console.log('── 1. THE INVERSION: week 1 vs the declared longest run (weekly=30, 10K) ──')
console.log('  lrr   wk1 volume   wk1 long run   early cap applied?')
for (const lrr of [0, 1, 2, 3, 5, 8, 12, 20]) {
  const r: any = gen({ race_distance_km: 10, current_weekly_km: 30, longest_recent_run_km: lrr })
  // Post-§10-Amendment the cap applies at every rung, floored at the resolved
  // per-runner floor — so a declared zero caps at the ABSOLUTE floor, which is
  // the same rung as a declared 1 km.
  const cap = Math.max(lrr * C.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER, sessionFloorsFor(lrr).long)
  const capped = `yes — ${cap.toFixed(1)}km${lrr === 0 ? ' (declared zero: the absolute floor)' : ''}`
  console.log(`  ${String(lrr).padStart(3)}   ${String(r.wk1 ?? r.refused).padEnd(11)} ${String((r.lr1 ?? 0).toFixed(1)).padEnd(14)} ${capped}`)
}

console.log('\n── 2. Does a declared zero REFUSE anywhere? ──')
for (const dist of [5, 10, 21.1, 42.2, 50]) {
  const r: any = gen({ race_distance_km: dist, current_weekly_km: 0, longest_recent_run_km: 0 })
  console.log(`  ${String(dist).padStart(5)}km → ${r.refused ? 'REFUSED ' + r.refused : `GENERATED wk1=${r.wk1}km, long run ${r.lr1.toFixed(1)}km`}`)
}

console.log('\n── 3. POPULATION: how much of a wide grid declares a zero and is accepted? ──')
let n = 0, zeroWk = 0, zeroLr = 0, zeroLrAccepted = 0, worst = 0, worstCase = ''
for (const dist of [5, 10, 21.1, 42.2])
 for (const wk of [0, 5, 15, 30, 50])
  for (const lrr of [0, 1, 4, 10, 20])
   for (const days of [3, 4, 5]) {
  const r: any = gen({ race_distance_km: dist, current_weekly_km: wk, longest_recent_run_km: lrr, days_available: days })
  n++
  if (wk === 0) zeroWk++
  if (lrr === 0) { zeroLr++
    if (!r.refused) { zeroLrAccepted++
      if (r.lr1 > worst) { worst = r.lr1; worstCase = `${dist}km, weekly ${wk}, ${days} days → wk1 long run ${r.lr1.toFixed(1)}km` } } }
}
console.log(`  grid ${n} · weekly=0 cases ${zeroWk} · longest=0 cases ${zeroLr}, of which GENERATED ${zeroLrAccepted}`)
console.log(`  worst uncapped week-1 long run on a declared zero: ${worst.toFixed(1)}km — ${worstCase}`)
console.log(`\n  (WEEK_1_2_LONG_RUN_CAP_MULTIPLIER = ${C.WEEK_1_2_LONG_RUN_CAP_MULTIPLIER}; WEEKLY_KM_MIN = ${C.WIZARD_VOLUME_RULER.WEEKLY_KM_MIN}, LONGEST_RUN_KM_MIN = ${C.WIZARD_VOLUME_RULER.LONGEST_RUN_KM_MIN})`)
