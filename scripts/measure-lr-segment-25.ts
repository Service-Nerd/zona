// measure-lr-segment-25.ts — LR-SEGMENT-RECORDED-§25 before/after signal.
//
// §107 declared its own scope gap: the HM (`hm_pace_long_run`) and marathon
// (`mp_long_run`) race-specific long runs carry §24b's segmented zone string
// ("Zone 2–3") but record NO `lr_segment_pace`, and their `session.zone` is
// authored beside `hr_target` rather than derived from what the row declares.
//
// This counts, across a time-target HM/MARATHON grid:
//   · §25 sessions produced (peak, non-deload, zone "Zone 2–3")
//   · how many record `lr_segment_pace`          → 0 before, 100% after
//   · whether the recorded pace equals goal pace → the board's spec (a)
//   · zone-vs-catalogue agreement                → the board's spec (b)
//
// ⚠️ A grid that generates nothing prints a clean table. `plansGenerated` is
// asserted non-zero and the per-cohort counts are printed, so an empty sweep
// fails loudly rather than reporting success (feedback: measurement scripts are
// checks too).
//
// Run: NODE_ENV=production npx tsx scripts/measure-lr-segment-25.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { isLongRun } from '../lib/plan/sessionRole'
import { V1_SESSION_CATALOGUE } from '../lib/plan/sessionCatalogueData'
import type { GeneratorInput, Plan, Session } from '../types/plan'

const DISTS = [
  { key: 'HM', km: 21.1, target: '1:45:00', rowId: 'hm_pace_long_run' },
  { key: 'MARATHON', km: 42.2, target: '3:45:00', rowId: 'mp_long_run' },
] as const

const LEVELS = ['intermediate', 'experienced'] as const
const DAYS = [3, 4, 5] as const
const VOLUMES = [25, 40, 60] as const

const base = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-04-11', goal: 'time_target',
  age: 35, resting_hr: 55, max_hr: 184,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

const sessionsOf = (p: Plan): { week: number; day: string; s: Session; phase: string | undefined; type?: string }[] =>
  p.weeks.flatMap(w =>
    (Object.entries(w.sessions ?? {}) as [string, Session | undefined][])
      .filter(([, s]) => !!s)
      .map(([day, s]) => ({ week: w.n, day, s: s as Session, phase: w.phase, type: w.type })))

const PLAN_START = '2026-09-14'

let plansGenerated = 0
let refused = 0

for (const d of DISTS) {
  let seg = 0, recorded = 0, matchesGoal = 0, zoneOk = 0
  const row = V1_SESSION_CATALOGUE.find(r => r.id === d.rowId)
  if (!row) throw new Error(`catalogue row ${d.rowId} not found — grid is measuring nothing`)
  // What the row DECLARES, rendered the way session.zone spells it.
  const declared = `Zone ${row.intensity_zones.map(z => z.replace('Z', '')).join('–')}`

  for (const lvl of LEVELS) for (const days of DAYS) for (const vol of VOLUMES) {
    const input = base({
      race_distance_km: d.km, target_time: d.target,
      current_weekly_km: vol, longest_recent_run_km: Math.max(8, Math.round(vol * 0.35)),
      days_available: days, fitness_level: lvl,
    } as Partial<GeneratorInput>)
    let plan: Plan
    // planStart pinned so the grid is clock-independent (cohortGrid's rule).
    try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { refused++; continue }
    plansGenerated++

    const goalPace = plan.meta.goal_pace_per_km ?? null
    for (const { s, phase, type } of sessionsOf(plan)) {
      if (phase !== 'peak' || type === 'deload') continue
      if (!isLongRun(s) || s.zone !== 'Zone 2–3') continue
      seg++
      if (s.lr_segment_pace) recorded++
      if (goalPace && s.lr_segment_pace === goalPace) matchesGoal++
      if (s.zone === declared) zoneOk++
    }
  }

  const pct = (n: number) => seg === 0 ? 'n/a' : `${((n / seg) * 100).toFixed(1)}%`
  console.log(`\n▶ ${d.key}  (row ${d.rowId}, declares intensity_zones=[${row.intensity_zones.join(',')}] → "${declared}")`)
  console.log(`   §25 sessions produced : ${seg}`)
  console.log(`   record lr_segment_pace: ${recorded}  (${pct(recorded)})`)
  console.log(`   pace === goal pace    : ${matchesGoal}  (${pct(matchesGoal)})`)
  console.log(`   zone === row declares : ${zoneOk}  (${pct(zoneOk)})`)
  if (seg === 0) console.log(`   ⚠️  ZERO §25 sessions — the grid is not reaching the producer.`)
}

console.log(`\nplans generated: ${plansGenerated}  refused: ${refused}`)
if (plansGenerated === 0) {
  console.error('FAIL: the grid generated no plans — this measurement means nothing.')
  process.exit(1)
}
