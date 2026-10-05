/**
 * DELIVERED-RAMP-REAL-DRIVER-01 — the attribution pass the Coaching Board named
 * as the evidence that would settle its INSUFFICIENT EVIDENCE ruling.
 *
 * It answers the board's two open questions with numbers:
 *   Q1 Is `DELIVERED_RAMP_LR_ATTRIBUTION_PCT` (50) set too high? i.e. in what
 *      share of firings is the LONG RUN the largest contributor but below the
 *      threshold, so the runner is told the driver is "NOT ATTRIBUTED"?
 *   Q2 Should a week GAINING a session count as a ramp at all?
 *
 * DESIGN NOTE — the firing set comes from `validatePlan`, never from a local
 * re-derivation of §94's guards. A checker that re-derives its producer's
 * predicate cannot catch the producer being wrong, and this repo has paid for
 * that twice in one day (`producerCheckerAgreement.test.ts`). This script only
 * ATTRIBUTES firings the real invariant reported.
 */
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { sessionKmSelfPaced } from '../lib/plan/sessionDistance'
import { isLongRun } from '../lib/plan/sessionRole'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { Plan, Week } from '../types/plan'

const THRESHOLD = GENERATION_CONFIG.DELIVERED_RAMP_LR_ATTRIBUTION_PCT
const km = (s: unknown) => sessionKmSelfPaced(s as never) ?? 0
const longKmOf = (w: Week) => km(Object.values(w.sessions).find(s => s && isLongRun(s)))
const deliveredKm = (w: Week) => Object.values(w.sessions).reduce((a, s) => a + km(s), 0)
const runCount = (w: Week) =>
  Object.values(w.sessions).filter(s => s && s.type !== 'rest' && s.type !== 'strength').length
const qualityKm = (w: Week) =>
  Object.values(w.sessions).reduce((a, s) => a + (s && s.type === 'quality' ? km(s) : 0), 0)
const easyKm = (w: Week) =>
  Object.values(w.sessions).reduce((a, s) => a + (s && !isLongRun(s) && s.type !== 'quality' ? km(s) : 0), 0)

type Row = {
  distance: number
  lrSharePct: number
  easyRiseKm: number
  qualityRiseKm: number
  lrRiseKm: number
  gainedSession: boolean
  largest: 'long run' | 'easy' | 'quality' | 'none'
}

function main() {
  const grid = cohortGrid()
  const rows: Row[] = []
  let plans = 0
  let plansFiring = 0
  const byDistanceTotal = new Map<number, number>()
  const byDistanceFiring = new Map<number, number>()

  for (const input of grid) {
    let plan: Plan
    try {
      plan = generateRulePlan(input, 'paid', COHORT_PLAN_START, undefined, COHORT_PLAN_START)
    } catch { continue }
    plans++
    const d = input.race_distance_km
    byDistanceTotal.set(d, (byDistanceTotal.get(d) ?? 0) + 1)

    let fired = false
    for (const v of validatePlan(plan, input)) {
      if (v.code !== 'INV-PLAN-DELIVERED-RAMP') continue
      fired = true
      const i = plan.weeks.findIndex(w => w.n === v.week)
      if (i < 1) continue
      const w = plan.weeks[i], prev = plan.weeks[i - 1]
      const lrRiseKm = longKmOf(w) - longKmOf(prev)
      const totalAbsRiseKm = Math.abs(deliveredKm(w) - deliveredKm(prev))
      const easyRiseKm = easyKm(w) - easyKm(prev)
      const qualityRiseKm = qualityKm(w) - qualityKm(prev)
      const contributions: [Row['largest'], number][] = [
        ['long run', lrRiseKm], ['easy', easyRiseKm], ['quality', qualityRiseKm],
      ]
      const top = contributions.filter(([, v2]) => v2 > 0).sort((a, b) => b[1] - a[1])[0]
      rows.push({
        distance: d,
        lrSharePct: totalAbsRiseKm > 0 ? (lrRiseKm / totalAbsRiseKm) * 100 : 0,
        easyRiseKm, qualityRiseKm, lrRiseKm,
        gainedSession: runCount(w) > runCount(prev),
        largest: top ? top[0] : 'none',
      })
    }
    if (fired) { plansFiring++; byDistanceFiring.set(d, (byDistanceFiring.get(d) ?? 0) + 1) }
  }

  const pc = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : 'n/a')
  const n = rows.length
  const notLed = rows.filter(r => r.lrSharePct <= THRESHOLD)
  const lrLargestButUnder = notLed.filter(r => r.largest === 'long run')
  const gained = rows.filter(r => r.gainedSession)

  console.log('DELIVERED-RAMP attribution — threshold DELIVERED_RAMP_LR_ATTRIBUTION_PCT =', THRESHOLD)
  console.log(`plans generated: ${plans} | plans with >=1 firing: ${plansFiring} (${pc(plansFiring, plans)} plan-wide)`)
  console.log(`firing week-instances: ${n}`)
  console.log()
  console.log('── by race distance (plan-wide rate) ──')
  for (const [d, tot] of Array.from(byDistanceTotal.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`  ${String(d).padStart(5)}km: ${pc(byDistanceFiring.get(d) ?? 0, tot)}  (${byDistanceFiring.get(d) ?? 0}/${tot})`)
  }
  console.log()
  console.log('── Q1: is the 50% threshold too high? ──')
  console.log(`  reported LONG-RUN-LED (share > ${THRESHOLD}%): ${n - notLed.length} = ${pc(n - notLed.length, n)}`)
  console.log(`  reported NOT ATTRIBUTED but long run IS the largest contributor: ${lrLargestButUnder.length} = ${pc(lrLargestButUnder.length, n)} of all firings, ${pc(lrLargestButUnder.length, notLed.length)} of non-led`)
  for (const band of [[0, 10], [10, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 100]]) {
    const c = rows.filter(r => r.lrSharePct >= band[0] && r.lrSharePct < band[1]).length
    console.log(`    LR share ${String(band[0]).padStart(3)}-${String(band[1]).padStart(3)}%: ${String(c).padStart(5)}  ${pc(c, n)}`)
  }
  console.log()
  console.log('── Q2: does the week gain a session? ──')
  console.log(`  firings where the week gained a run: ${gained.length} = ${pc(gained.length, n)}`)
  console.log()
  console.log('── largest contributor (all firings) ──')
  for (const k of ['long run', 'easy', 'quality', 'none'] as const) {
    const sub = rows.filter(r => r.largest === k)
    const total = sub.reduce((a, r) => a + (k === 'long run' ? r.lrRiseKm : k === 'easy' ? r.easyRiseKm : k === 'quality' ? r.qualityRiseKm : 0), 0)
    console.log(`  ${k.padEnd(9)}: ${String(sub.length).padStart(5)}  ${pc(sub.length, n)}   ${total.toFixed(0)} km added`)
  }
}

main()
