/**
 * `V1-DELIVERED-TAIL-01` — Coaching Board evidence. READ-ONLY.
 *
 * Willy's binding condition on the withdrawal of `ADR022-V1-DELIVERED-RISE-01`:
 * "the worst delivered rise was 79% before §100 and 79% after — the tail did not
 * move, and the tail is what injures people. Watch the tail, not the rate."
 *
 * `INV-PLAN-DELIVERED-RAMP` fires on WHETHER a week breached §2 at delivery. It
 * never reports how FAR. This measures the distribution.
 *
 * ⚠️ THE MAGNITUDE IS PARSED FROM THE INVARIANT'S OWN `actual` FIELD, not
 * re-derived. Re-deriving is what produced three different numbers for one
 * question at the 2026-10-10 sitting; the ratified detector is the instrument.
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { classifyStimulus, isLongRun } from '../lib/plan/sessionRole'
import { cohortGrid, targetedGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { GENERATION_CONFIG as C } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan, Week } from '../types/plan'

const N = Number(process.argv[2] ?? 3000)
const STRIDE = 7919
// 🔴 TWO CORPORA, AND THE SECOND IS NOT OPTIONAL. Measured 2026-10-10:
// `cohortGrid` carries **0 injury-history rows out of 41,472** — so the first
// run of this script reported "0 firings" on BOTH of ADR-022's injury
// invariants and that was a CORPUS LIMITATION, not a finding. ADR-022 itself
// records `INV-PLAN-INJURY-CAP-DELIVERED` as exercised at 1,892 week-instances
// across a 600-plan injury grid. `targetedGrid` carries 4,608 of 6,144 with an
// injury history and is the only grid that can reach Willy's cohort at all.
// Third instance this day of "the population excludes the cases at risk".
const healthyAll = cohortGrid()
const injuryAll = targetedGrid().filter((i: GeneratorInput) =>
  ((i as { injury_history?: unknown[] }).injury_history ?? []).length > 0)
const sample: GeneratorInput[] = [
  ...Array.from({ length: N }, (_, i) => healthyAll[(i * STRIDE) % healthyAll.length]),
  ...Array.from({ length: Math.min(N, 1500) }, (_, i) => injuryAll[(i * STRIDE) % injuryAll.length]),
]
const loading = (w: Week) => (w.n ?? 0) >= 1 && w.type !== 'race'

interface Fire { total: number; nonLr: number; v1: boolean; injured: boolean; week: number; input: GeneratorInput }
const fires: Fire[] = []
const injuryArm: Array<{ code: string; mag: number; raw: string; week: number; injured: boolean }> = []
let plans = 0, v1Plans = 0

for (const input of sample) {
  let p: Plan
  try { p = generateRulePlan(input, 'paid', COHORT_PLAN_START) } catch { continue }
  plans++
  const weeks = p.weeks.filter(loading)
  const idxQ = weeks.findIndex(w => Object.values(w.sessions ?? {}).some(s => s?.type === 'quality'))
  const idxV = weeks.findIndex(w => Object.values(w.sessions ?? {}).some(s =>
    s?.type === 'quality' && classifyStimulus(s) === 'vo2max'))
  const isV1 = idxQ > 0 || idxV > 0
  if (isV1) v1Plans++
  const injured = ((input as { injury_history?: unknown[] }).injury_history ?? []).length > 0
  for (const v of validatePlan(p, input)) {
    // 🔴 THE INJURY ARM IS A DIFFERENT INVARIANT, AND MEASURING ONLY THE
    // HEALTHY ONE WOULD HAVE BEEN BLIND TO WILLY'S ENTIRE COHORT.
    // `INV-PLAN-DELIVERED-RAMP` (§94) exists BECAUSE ADR-022 scoped the
    // delivered check to injury-history runners and left the healthy with
    // nothing — so by construction it fires on 0 injured plans. The injured are
    // covered by ADR-022's own `INV-PLAN-INJURY-CAP-DELIVERED` and
    // `INV-PLAN-BOUNCEBACK-BOUNDED`, which this now reads too.
    if (v.code === 'INV-PLAN-INJURY-CAP-DELIVERED' || v.code === 'INV-PLAN-BOUNCEBACK-BOUNDED') {
      const num = String(v.actual).match(/(-?\d+(?:\.\d+)?)/)
      if (num) injuryArm.push({ code: v.code, mag: Number(num[1]), raw: String(v.actual), week: v.week ?? 0, injured })
      continue
    }
    if (v.code !== 'INV-PLAN-DELIVERED-RAMP') continue
    // "+23% week, +18% non-long-run"
    const m = String(v.actual).match(/\+(-?\d+)% week, \+(-?\d+)% non-long-run/)
    if (!m) { console.log(`⚠️ UNPARSED actual: ${String(v.actual)}`); continue }
    fires.push({ total: Number(m[1]), nonLr: Number(m[2]), v1: isV1, injured, week: v.week ?? 0, input })
  }
}

const q = (xs: number[], p: number) => xs.length ? xs.slice().sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] : NaN
const show = (label: string, xs: number[]) => {
  if (!xs.length) { console.log(`  ${label.padEnd(26)} (none)`); return }
  console.log(`  ${label.padEnd(26)} n=${String(xs.length).padStart(5)}  p50 ${String(q(xs,.5)).padStart(3)}%  p90 ${String(q(xs,.9)).padStart(3)}%  p99 ${String(q(xs,.99)).padStart(3)}%  MAX ${String(Math.max(...xs)).padStart(3)}%`)
}

console.log(`\n═══ V1-DELIVERED-TAIL-01 ═══  §2 ceiling ${C.MAX_WEEKLY_VOLUME_INCREASE_PCT}% · ${plans} plans (${v1Plans} V1) · ${fires.length} §94 firings`)
console.log(`  corpora: cohortGrid (0 of 41,472 carry an injury history) + targetedGrid injury rows (${injuryAll.length} available)`)
console.log('\nDELIVERED WHOLE-WEEK RISE, among weeks that already breach:')
show('all firings', fires.map(f => f.total))
show('V1 plans', fires.filter(f => f.v1).map(f => f.total))
show('non-V1 control', fires.filter(f => !f.v1).map(f => f.total))
show('injury history', fires.filter(f => f.injured).map(f => f.total))
show('healthy', fires.filter(f => !f.injured).map(f => f.total))

console.log('\nNON-LONG-RUN RISE (the §52-exempt long run removed — the trimable portion):')
show('all firings', fires.map(f => f.nonLr))
show('V1 plans', fires.filter(f => f.v1).map(f => f.nonLr))
show('non-V1 control', fires.filter(f => !f.v1).map(f => f.nonLr))

console.log(`\n§100 recorded the worst delivered week rise as 79% BEFORE its fix and 79% AFTER.`)
const worst = fires.slice().sort((a, b) => b.total - a.total).slice(0, 6)
console.log('\nTHE TAIL, named — the six worst weeks in this sample:')
for (const f of worst) {
  const i = f.input as unknown as Record<string, unknown>
  console.log(`  +${f.total}% whole week (+${f.nonLr}% non-LR)  w${f.week}  ${i.race_distance_km}km ${i.goal} cwk=${i.current_weekly_km} longest=${i.longest_recent_run_km} days=${i.days_available}${f.injured ? ' +injury' : ''}${f.v1 ? ' V1' : ''}`)
}
console.log('\n═══ THE INJURY ARM — ADR-022\'s own invariants, because §94 cannot see the injured ═══')
for (const code of ['INV-PLAN-INJURY-CAP-DELIVERED', 'INV-PLAN-BOUNCEBACK-BOUNDED']) {
  const rows = injuryArm.filter(r => r.code === code)
  const inj = rows.filter(r => r.injured)
  console.log(`  ${code}: ${rows.length} firings (${inj.length} on injury-history plans)`)
  if (rows.length) {
    const mags = rows.map(r => r.mag)
    console.log(`    magnitude  p50 ${q(mags,.5)}  p90 ${q(mags,.9)}  p99 ${q(mags,.99)}  MAX ${Math.max(...mags)}`)
    console.log(`    e.g. ${rows.slice().sort((a,b)=>b.mag-a.mag)[0].raw.slice(0,90)}`)
  }
}

// 📊 SEILER'S QUESTION: p99 ~= MAX. Is something CLAMPING it, or is the tail just thin?
console.log('\nTOP OF THE DISTRIBUTION, whole-week (Seiler: "is that a tail or a ceiling?"):')
const tops = fires.map(f => f.total).sort((a, b) => b - a)
console.log('  the 20 highest: ' + tops.slice(0, 20).join(' '))
const hist: Record<string, number> = {}
for (const v of tops) { const b = Math.floor(v / 5) * 5; hist[`${b}-${b+4}`] = (hist[`${b}-${b+4}`] ?? 0) + 1 }
console.log('  5-point buckets: ' + Object.entries(hist).sort((a,b)=>Number(b[0].split('-')[0])-Number(a[0].split('-')[0])).map(([k,v])=>`${k}:${v}`).join(' '))

// How much of the tail is above each candidate threshold?
console.log('\nSHARE OF FIRINGS ABOVE A CANDIDATE REFUSAL THRESHOLD (whole-week rise):')
for (const t of [15, 20, 25, 30, 40, 50]) {
  const n = fires.filter(f => f.total > t).length
  console.log(`  > ${String(t).padStart(2)}%   ${String(n).padStart(5)} of ${fires.length}  (${(n / fires.length * 100).toFixed(1)}% of firings · ${(n / plans * 100).toFixed(2)}% of plans)`)
}
