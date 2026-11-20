// board-evidence-beginner-taper-race-row-01.ts — READ-ONLY. BEGINNER-TAPER-RACE-ROW-01 (+ RECAL-MIXED-MEAN-01's share),
// sitting 2026-11-20. Which taper race-specific rows do beginner-INTENSITY plans receive, by distance and goal, and how
// many of them are the intermediate-minimum `goal_pace_sharpener` (the derived exception)?
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { slowGoalGrid, slowGoalDates } from '../lib/plan/slowGoalGrid'
import { generateRulePlan } from '../lib/plan/ruleEngine'

const taper: Record<string, Record<string, number>> = {}
const plansBy: Record<string, number> = {}
let q = 0, mixed = 0
function run(label: string, inputs: any[], start: string) {
  for (const input of inputs) {
    let plan: any
    try { plan = generateRulePlan(input, 'trial', start, undefined, start) } catch { continue }
    const m = plan.meta ?? {}
    const lvl = String(m.fitness_intensity_level ?? m.fitness_level)
    const withheld = m.goal_pace_withheld ? 'withheld' : 'live'
    const key = `${label}/${lvl}/${input.race_distance_km}km/${input.goal}/${input.goal === 'time_target' ? withheld : '-'}`
    plansBy[key] = (plansBy[key] ?? 0) + 1
    let sawSharp = false
    for (const w of plan.weeks ?? []) for (const s of Object.values(w.sessions ?? {}).flat() as any[]) {
      if (!s?.catalogue_id) continue
      if (s.type === 'quality' || s.type === 'intervals' || s.type === 'tempo' || s.type === 'hard') {
        if (label === 'cohort') { q++; if (s.catalogue_id === 'progressive_tempo' || s.catalogue_id === 'tempo_over_under') mixed++ }
      }
      if (w.phase !== 'taper') continue
      if (lvl !== 'beginner') continue
      const t = (taper[key] ??= {}); t[s.catalogue_id] = (t[s.catalogue_id] ?? 0) + 1
      if (s.catalogue_id === 'goal_pace_sharpener') sawSharp = true
    }
    if (sawSharp) { const t = (taper[key] ??= {}); t['__plans_with_sharpener'] = (t['__plans_with_sharpener'] ?? 0) + 1 }
  }
}
run('cohort', cohortGrid(), COHORT_PLAN_START)
const d = slowGoalDates()
run('slow', slowGoalGrid(d.planStart, d.benchmarkDate), d.planStart)
for (const [k, v] of Object.entries(taper).sort()) console.log(k.padEnd(48), `plans=${plansBy[k]}`, JSON.stringify(v))
console.log(`\ncohortGrid quality sessions ${q}; mixed-anchor (progressive_tempo + tempo_over_under) ${mixed} (${(100 * mixed / q).toFixed(1)}%)`)
