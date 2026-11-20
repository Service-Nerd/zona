/**
 * `COACH-READ-1027-FOLLOWUPS-01` — Coaching Board evidence, 2026-11-20. READ-ONLY (plans built in memory).
 *
 * The item's own instruction: "Re-measure each on the grids before it reaches a sitting." Seven claims from the
 * 2026-10-27 read of 28 plans, each operationalised below and counted on three populations:
 *   A. cohortGrid (healthy; carries the age axis, so masters are present), stride-sampled
 *   B. targetedGrid rows WITH an injury history (age 40 in the grid)
 *   C. B re-aged to 58 — the injury x masters cell neither grid reaches (constructed, as measure-plan-fitness does)
 * plus the 21 charity personas the read itself used (the named cases t3 w6, m3 w10, e1 w11 among them).
 *
 * Run: npx tsx scripts/board-evidence-coach-read-1027-followups-01.ts [stride]
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { PLAN_PERSONAS, charityInput, CHARITY_PLAN_START } from '../lib/plan/charityCohort'
import { isLongRun } from '../lib/plan/sessionRole'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { GENERATION_CONFIG as C } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan, Week, Session } from '../types/plan'

const STRIDE = Number(process.argv[2] ?? 41)
const isDeload = (w: Week) => w.type === ('deload' as any) || w.badge === 'deload'
const runs = (w: Week) => (Object.values(w.sessions) as (Session | undefined)[])
  .filter((s): s is Session => !!s && s.type !== 'rest' && s.type !== 'strength' && s.type !== 'race')
// Long-run SIZE: km where the session states or prices one, else minutes (beginners are duration-anchored;
// reading `distance_km ?? 0` would score a duration-anchored long run as removed — SESSION-KM-01's class).
const lrKm = (w: Week) => Math.max(0, ...runs(w).filter(s => isLongRun(s)).map(s => sessionKmSelfPaced(s as any) ?? s.duration_mins ?? 0))
const easyMax = (w: Week) => Math.max(0, ...runs(w).filter(s => !isLongRun(s) && (s.type === 'easy' || s.type === 'recovery'))
  .map(s => s.duration_mins ?? 0))
const RACE_PACE = (s: Session) => s.stimulus === 'race_pace'
  || /goal pace|marathon.pace|\bMP\b|-pace/i.test(String(s.label ?? ''))

type Tally = { plans: number; c1: number; c1w: number; c2inj: number; c2ramp: number; c3: number; c3w: number;
  c4hv: number; c4sb: number; c5: number; c5of: number; c6: number; c7: number; c7of: number; maxRun: Record<number, number> }
const blank = (): Tally => ({ plans: 0, c1: 0, c1w: 0, c2inj: 0, c2ramp: 0, c3: 0, c3w: 0, c4hv: 0, c4sb: 0, c5: 0, c5of: 0,
  c6: 0, c7: 0, c7of: 0, maxRun: {} })

function measure(p: Plan, input: GeneratorInput, t: Tally, tag?: string) {
  t.plans++
  const W = p.weeks.filter(w => (w.n ?? 0) >= 1)
  const v = validatePlan(p as never, input as never) as { code: string }[]
  // C1 — a badged deload that does not reduce (the ratified detector)
  if (v.some(x => x.code === 'INV-PLAN-DELOAD-IS-A-REDUCTION')) t.c1++
  // C2 — delivered ramps past §2 (the two ratified warn detectors)
  if (v.some(x => x.code === 'INV-PLAN-INJURY-CAP-DELIVERED')) t.c2inj++
  if (v.some(x => x.code === 'INV-PLAN-DELIVERED-RAMP')) t.c2ramp++
  let c3 = false, hv = false, sb = false, c6 = false
  for (let i = 1; i < W.length; i++) {
    const w = W[i], prev = W[i - 1]
    if (isDeload(w) && !isDeload(prev)) {
      t.c1w++
      // C3 — §3 Am. (LR-DELOAD-CUT-01): the deload's long run cut more than 5pp harder than the week
      const wk = 1 - w.weekly_km / prev.weekly_km, lr = lrKm(prev) > 0 ? 1 - lrKm(w) / lrKm(prev) : 0
      t.c3w++
      if (lrKm(prev) > 0 && lr - wk > 0.05) { c3 = true; if (tag) console.log(`   ${tag} C3 w${w.n}: week −${Math.round(wk * 100)}% LR −${Math.round(lr * 100)}%`) }
    }
    // C6 — an easy run growing inside the taper
    if (w.phase === 'taper' && w.type !== 'race' && easyMax(w) > easyMax(prev) + 0.5) {
      c6 = true; if (tag) console.log(`   ${tag} C6 w${w.n}: easy ${easyMax(prev)} → ${easyMax(w)} min`)
    }
    // C4b — "Step-back week" long-run note where the long run did not step back
    if (runs(w).some(s => isLongRun(s) && (s.coach_notes ?? []).some(n => typeof n === 'string' && n.startsWith('Step-back week')))
      && lrKm(w) >= Math.max(0, ...W.slice(0, i).filter(x => !isDeload(x)).map(lrKm))) {
      // §47 sizes a step-back against the PEAK long run, so "not a step-back" means: not below the largest
      // non-deload long run before it (the previous week can itself be a deload).
      sb = true; if (tag) console.log(`   ${tag} C4 step-back w${w.n}: LR ${lrKm(w)} ≥ prior max`) }
  }
  // C4a — "highest volume" label on a week that a LATER non-race week out-volumes
  W.forEach((w, i) => {
    if (!/highest volume/i.test(w.label ?? '')) return
    const later = Math.max(0, ...W.slice(i + 1).filter(x => x.type !== 'race').map(x => x.weekly_km))
    if (later > w.weekly_km) { hv = true; if (tag) console.log(`   ${tag} C4 highest-volume w${w.n}: ${w.weekly_km} < later ${later}`) }
  })
  if (c3) t.c3++
  if (hv) t.c4hv++
  if (sb) t.c4sb++
  if (c6) t.c6++
  // C5 — "not to chase a time" on a plan that still prescribes race-pace work
  const notes = [(p.meta as any).volume_constraint_note, (p.meta as any).difficulty_note].filter(Boolean).join(' ')
  if (/not to chase a time/i.test(notes)) {
    t.c5of++
    if (W.some(w => runs(w).some(RACE_PACE))) { t.c5++; if (tag) console.log(`   ${tag} C5: finish sentence + race-pace work`) }
  }
  // C7 — loading weeks in a row (not deload, not taper, not race), for masters and beginners
  let run = 0, best = 0
  for (const w of W) { if (isDeload(w) || w.phase === 'taper' || w.type === 'race') run = 0; else best = Math.max(best, ++run) }
  t.maxRun[best] = (t.maxRun[best] ?? 0) + 1
  t.c7of++
  if (best >= 5) { t.c7++; if (tag) console.log(`   ${tag} C7: ${best} loading weeks in a row`) }
}

function gen(i: GeneratorInput, start: string): Plan | null {
  try { return generateRulePlan(i, 'paid', start, undefined, start) as Plan } catch { return null }
}
function report(name: string, t: Tally) {
  const pct = (n: number, d: number) => `${n}/${d} (${d ? (100 * n / d).toFixed(1) : '—'}%)`
  console.log(`\n## ${name} — ${t.plans} plans`)
  console.log(`C1 deload not a reduction (plans): ${pct(t.c1, t.plans)}`)
  console.log(`C2 INJURY-CAP-DELIVERED: ${pct(t.c2inj, t.plans)} · DELIVERED-RAMP: ${pct(t.c2ramp, t.plans)}`)
  console.log(`C3 deload LR cut >5pp harder than the week (plans): ${pct(t.c3, t.plans)}`)
  console.log(`C4 "highest volume" out-volumed later: ${pct(t.c4hv, t.plans)} · "Step-back" LR not reduced: ${pct(t.c4sb, t.plans)}`)
  console.log(`C5 finish sentence + race-pace work: ${t.c5} of ${t.c5of} plans carrying the sentence`)
  console.log(`C6 easy run grows inside the taper (plans): ${pct(t.c6, t.plans)}`)
  console.log(`C7 >=5 loading weeks in a row: ${pct(t.c7, t.c7of)} · distribution`, t.maxRun)
}

const masters = (i: any) => (i.age ?? 0) >= C.MASTERS_AGE_THRESHOLD
const beginner = (i: any) => i.user_declared_level === 'beginner'
const A = cohortGrid() as GeneratorInput[]
const tA = blank(), tAm = blank(), tAb = blank()
for (let i = 0; i < A.length; i += STRIDE) {
  const p = gen(A[i], COHORT_PLAN_START); if (!p) continue
  measure(p, A[i], tA)
  if (masters(A[i])) measure(p, A[i], tAm)
  if (beginner(A[i])) measure(p, A[i], tAb)
}
const B = (targetedGrid() as GeneratorInput[]).filter(i => ((i as any).injury_history ?? []).length > 0)
const tB = blank(), tC = blank()
for (let i = 0; i < B.length; i += Math.max(1, Math.round(STRIDE / 4))) {
  const p = gen(B[i], COHORT_PLAN_START); if (p) measure(p, B[i], tB)
  const old = { ...B[i], age: 58 } as GeneratorInput
  const q = gen(old, COHORT_PLAN_START); if (q) measure(q, old, tC)
}
report(`A cohortGrid (stride ${STRIDE})`, tA)
report('A — masters (age ≥ 45) only', tAm)
report('A — declared beginner only', tAb)
report('B targetedGrid, injury history', tB)
report('C injury × masters (B re-aged to 58)', tC)

console.log('\n## The 21 charity personas the read used')
const tP = blank()
for (const persona of PLAN_PERSONAS) {
  const input = charityInput(persona)
  const p = gen(input, CHARITY_PLAN_START)
  if (!p) { console.log(` ${persona.id}: refused`); continue }
  measure(p, input, tP, persona.id.split(' ')[0])
}
report('personas', tP)
