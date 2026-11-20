// board-evidence-lr-finish-withheld-pricing-01.ts — READ-ONLY evidence for the 2026-11-20 sitting.
// Question: today, which runners lose §25/§24b's race-pace long-run finish because goal pace is withheld,
// and what is an unbenchmarked beginner's HM/marathon finish priced at?
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { slowGoalGrid, slowGoalDates } from '../lib/plan/slowGoalGrid'
import { generateRulePlan, buildFallbackPace } from '../lib/plan/ruleEngine'
import { isLongRun } from '../lib/plan/sessionRole'

type Row = { plans: number; withheld: number; peakLR: number; seg: number }
const t: Record<string, Row> = {}
let unbBegHM = 0, unbBegHMgoal = 0, unbBegMAR = 0, unbBegMARgoal = 0
function run(label: string, inputs: any[], start: string) {
  for (const input of inputs) {
    let plan: any
    try { plan = generateRulePlan(input, 'trial', start, undefined, start) } catch { continue }
    if (input.goal !== 'time_target') continue
    const m = plan.meta ?? {}
    const lvl = String(m.fitness_intensity_level ?? m.fitness_level)
    const withheld = !!m.goal_pace_withheld
    const bench = input.benchmark ? 'bench' : 'nobench'
    const key = `${label}/${input.race_distance_km}km/${lvl}/${bench}/${withheld ? 'WITHHELD' : 'not'}`
    const r = (t[key] ??= { plans: 0, withheld: 0, peakLR: 0, seg: 0 })
    r.plans++; if (withheld) r.withheld++
    const goal = m.goal_pace as string | undefined
    for (const w of plan.weeks ?? []) {
      if (w.phase !== 'peak' || w.type === 'deload') continue
      for (const s of Object.values(w.sessions ?? {}).flat() as any[]) {
        if (!s || !isLongRun(s)) continue
        r.peakLR++
        if (s.lr_segment_pace) r.seg++
        if (!input.benchmark && lvl === 'beginner' && label === 'cohort') {
          const isGoal = !!s.lr_segment_pace && !!goal && s.lr_segment_pace === goal
          if (input.race_distance_km === 21.1) { unbBegHM++; if (s.lr_segment_pace) unbBegHMgoal++ }
          if (input.race_distance_km === 42.2) { unbBegMAR++; if (s.lr_segment_pace) unbBegMARgoal++ }
          void isGoal
        }
      }
    }
  }
}
run('cohort', cohortGrid(), COHORT_PLAN_START)
const d = slowGoalDates()
run('slow', slowGoalGrid(d.planStart, d.benchmarkDate), d.planStart)
console.log('key'.padEnd(55), 'plans withheld peakLR withSegment')
for (const [k, v] of Object.entries(t).sort()) console.log(k.padEnd(55), v.plans, v.withheld, v.peakLR, v.seg)
console.log(`\nunbenchmarked beginner (cohort) HM peak LRs ${unbBegHM}, with a race-pace segment ${unbBegHMgoal}`)
console.log(`unbenchmarked beginner (cohort) MAR peak LRs ${unbBegMAR}, with a race-pace segment ${unbBegMARgoal}`)
for (const l of ['beginner', 'intermediate', 'experienced'] as const) {
  const p = buildFallbackPace(l); console.log(`fallback ${l}: MP ${p.marathonPaceStr} HM ${p.hmPaceStr}`)
}
