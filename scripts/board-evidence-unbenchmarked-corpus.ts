// board-evidence-unbenchmarked-corpus.ts — GOALPACE-UNBENCHMARKED-MARATHON-01.
//
// READ-ONLY, generates into memory. One question: for a time-target runner with NO
// benchmark, does the engine prescribe goal-paced work faster than that runner's
// own CV and interval paces?
//
// ⚠️ THE PACE GUIDE IS REBUILT THE WAY THE PRODUCER BUILDS IT. `generateRulePlan`
// calls `buildFallbackPace(levels.structural)` when there is no VDOT, and
// `meta.fitness_level` IS that structural level — checked, not assumed, because
// reading the wrong one of §79's two level fields is an error I made twice on
// 2026-11-16 (see `feedback-measure-a-cohort-by-the-field-the-gate-reads`).
//
// ⚠️ PINNED START, BOTH ARGUMENTS, exactly as `scripts/cohort-shape.ts` passes them.
// Without them every row refuses with "-19 weeks isn't enough" and the script
// reports 0 of 10,368 generated, which reads as a clean result.

import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { generateRulePlan, buildFallbackPace } from '../lib/plan/ruleEngine'
import { buildPaceFromVDOT } from '../lib/plan/paceBands'
const all = cohortGrid()
const rows = all.filter((i: any) => i.goal === 'time_target' && !i.benchmark)
console.log(`cohortGrid total ${all.length}; unbenchmarked time-target ${rows.length}`)
const errs: string[] = []
let gen = 0, withGoalSession = 0, pastCv = 0, pastI = 0
const byDist: Record<string, { n: number; past: number }> = {}
for (const input of rows) {
  let plan: any
  try { plan = generateRulePlan(input as any, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) } catch (e) { if (gen === 0 && errs.length < 3) errs.push(String((e as Error).message).slice(0,160)); continue }
  gen++
  const key = String(input.race_distance_km)
  byDist[key] ??= { n: 0, past: 0 }
  byDist[key].n++
  // The engine's own pace guide for this plan, rebuilt from its stamped meta.
  const g = plan?.meta?.vdot != null && plan?.meta?.vdot_training_anchor != null
    ? buildPaceFromVDOT(plan.meta.vdot_training_anchor, plan.meta.vdot)
    : buildFallbackPace(plan?.meta?.fitness_level ?? 'beginner')
  let hot = 0, overCv = 0, overI = 0
  for (const w of plan.weeks ?? []) for (const s of Object.values(w.sessions ?? {}) as any[]) {
    if (s?.stimulus !== 'race_pace' || !s?.pace_target) continue
    hot++
    const m = /(\d+):(\d{2})/.exec(String(s.pace_target))
    if (!m) continue
    const mins = Number(m[1]) + Number(m[2]) / 60
    if (mins < g.minPerKmCV) overCv++
    if (mins < g.minPerKmInterval) overI++
  }
  if (hot) withGoalSession++
  if (overCv) { pastCv++; byDist[key].past++ }
  if (overI) pastI++
}
console.log('first errors:', errs)
console.log(`generated ${gen}; carrying at least one race_pace session ${withGoalSession}`)
console.log(`plans with a goal-paced session FASTER THAN THEIR OWN CV pace: ${pastCv}`)
console.log(`...faster than their own INTERVAL pace: ${pastI}`)
console.log('by distance (plans past CV):', byDist)
