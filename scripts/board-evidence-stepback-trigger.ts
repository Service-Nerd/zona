// board-evidence-stepback-trigger.ts — STEPBACK-TRIGGER-STRUCTURAL-01 (§47 Am. 4).
//
// READ-ONLY. §47's principle says a "peak long run" INCLUDES race-pace segments, and
// `applyPeakLongRunAlternation` decides that from the session LABEL. Three questions:
//   1. does the label ever disagree with the producer's own `lr_segment_pace` stamp?
//   2. does any long run carry a race-ANCHORED work step, i.e. real v2 structure?
//   3. what is an UNBENCHMARKED beginner's race-pace finish priced at?
//
// 🔑 (3) is the one that inverted the question: `buildFallbackPace('beginner')` has marathon
// and HM pace NULL (§24b), so their finish is priced at the GOAL pace — the pace
// GOALPACE-UNBENCHMARKED-MARATHON-01 measured as faster than their own interval pace on a
// third of the cohort. §47 was spacing out a load that should not exist.
import { cohortGrid, COHORT_PLAN_START } from '../lib/plan/cohortGrid'
import { generateRulePlan, buildFallbackPace } from '../lib/plan/ruleEngine'
import { isLongRun } from '../lib/plan/sessionRole'

// The predicate as `applyPeakLongRunAlternation` writes it today, copied so the drift is
// visible if it is ever changed there without changing this.
const labelHasRacePace = (l0: string): boolean => {
  const l = l0.toLowerCase()
  return l.includes('pace') || l.includes(' mp') || l.startsWith('mp') || l.includes('hm-pace')
}

const t: Record<string, Record<string, number>> = {}
let all = 0, agree = 0, labelOnly = 0, stampOnly = 0, anchored = 0
for (const input of cohortGrid()) {
  let plan: { weeks?: unknown[]; meta?: Record<string, unknown> }
  try {
    plan = generateRulePlan(input, 'trial', COHORT_PLAN_START, undefined, COHORT_PLAN_START) as never
  } catch { continue }
  const km = input.race_distance_km
  const lvl = String(plan.meta?.fitness_level)
  const key = `${lvl}/${km}km/${input.goal === 'time_target' ? 'time' : 'finish'}/${input.benchmark ? 'benched' : 'no-bench'}`
  for (const w of (plan.weeks ?? []) as { phase?: string; type?: string; sessions?: Record<string, unknown> }[]) {
    if (w.phase !== 'peak' || w.type === 'deload') continue
    for (const s of Object.values(w.sessions ?? {}).flat() as (Record<string, unknown> | null)[]) {
      if (!s || !isLongRun(s as never)) continue
      all++
      const byLabel = labelHasRacePace(String(s.label ?? ''))
      const byStamp = s.lr_segment_pace != null
      const byAnchor = /"anchor":"(goal|M|HM)"/.test(JSON.stringify(s.derived_set ?? ''))
      if (byLabel && byStamp) agree++
      else if (byLabel) labelOnly++
      else if (byStamp) stampOnly++
      if (byAnchor) anchored++
      t[key] ??= { lrs: 0, racePace: 0 }
      t[key].lrs++
      if (byLabel) t[key].racePace++
    }
  }
}
console.log(`peak long runs: ${all}`)
console.log(`  label AND stamp agree:        ${agree}`)
console.log(`  LABEL only (stamp absent):    ${labelOnly}   <- a structural trigger would MISS these`)
console.log(`  STAMP only (label absent):    ${stampOnly}   <- the label trigger MISSES these today`)
console.log(`  carrying a race-ANCHORED step: ${anchored}   <- the segment is a top-level field, not v2 structure`)
console.log(`\nby cohort — how many peak long runs §47 currently sees:`)
for (const [k, v] of Object.entries(t).sort()) {
  if (!v.racePace && !/time/.test(k)) continue
  console.log(`  ${k.padEnd(40)} ${String(v.racePace).padStart(5)} of ${String(v.lrs).padStart(5)}`)
}
console.log(`\nwhat the fallback pace guide can price a finish at (§24b):`)
for (const l of ['beginner', 'intermediate', 'experienced'] as const) {
  const p = buildFallbackPace(l)
  console.log(`  ${l.padEnd(13)} MP ${String(p.marathonPaceStr)}  HM ${String(p.hmPaceStr)}`)
}
