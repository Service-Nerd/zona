// measure-race-pace-overlay-reach.ts — CONFIG-CONSUMER-01.
//
// `SESSION_FORMAT.LONG_RUN_PEAK.race_pace_distances` declares the race-pace
// long-run overlay applies to ['HM', 'MARATHON']. The consumer scan found the
// field is read by NO product code. The actual gate in `composeSession` is
//
//     isMpLong = isLong && session.label.toLowerCase().includes('marathon-pace')
//
// a LABEL substring match (D-17) — so the question this script answers is not
// "is the constant tidy" but "does the HM half of the declared list ship?".
//
// It runs the real display path: generate plans, take every PEAK race-specific
// long run, join its catalogue row the way the Session screen does, and call
// `composeSession`. Counts how many come back as shape 'long_run_with_mp'.
//
// ⚠️ A grid that generates nothing prints a clean table, so plansGenerated and
// the per-cohort session counts are asserted non-zero (feedback: measurement
// scripts are checks too).
//
// Run: NODE_ENV=production npx tsx scripts/measure-race-pace-overlay-reach.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composeSession } from '../lib/plan/sessionComposer'
import { catalogueRowFor } from '../lib/plan/catalogueLink'
import { isLongRun } from '../lib/plan/sessionRole'
import { SESSION_FORMAT } from '../lib/plan/sessionFormat'
import type { GeneratorInput, Plan, Session } from '../types/plan'

const DISTS = [
  { key: 'HM', km: 21.1, target: '1:45:00', rowId: 'hm_pace_long_run' },
  { key: 'MARATHON', km: 42.2, target: '3:45:00', rowId: 'mp_long_run' },
] as const

const LEVELS = ['intermediate', 'experienced'] as const
const DAYS = [3, 4, 5] as const
const VOLUMES = [25, 40, 60] as const
const PLAN_START = '2026-09-14'

const base = (o: Partial<GeneratorInput>): GeneratorInput => ({
  race_date: '2027-04-11', goal: 'time_target',
  age: 35, resting_hr: 55, max_hr: 184,
  preferred_long_run_day: 'sun', recent_quality_training: 'occasional',
  ...o,
} as GeneratorInput)

const sessionsOf = (p: Plan) =>
  p.weeks.flatMap(w =>
    (Object.entries(w.sessions ?? {}) as [string, Session | undefined][])
      .filter(([, s]) => !!s)
      .map(([day, s]) => ({ week: w.n, day, s: s as Session, phase: w.phase, type: w.type })))

console.log(`DECLARED: SESSION_FORMAT.LONG_RUN_PEAK.race_pace_distances = [${SESSION_FORMAT.LONG_RUN_PEAK.race_pace_distances.join(', ')}]`)

let plansGenerated = 0, refused = 0
let anySessions = 0

for (const d of DISTS) {
  let peakRaceLongRuns = 0, withOverlay = 0
  const labels = new Set<string>()

  for (const lvl of LEVELS) for (const days of DAYS) for (const vol of VOLUMES) {
    const input = base({
      race_distance_km: d.km, target_time: d.target,
      current_weekly_km: vol, longest_recent_run_km: Math.max(8, Math.round(vol * 0.35)),
      days_available: days, fitness_level: lvl,
    } as Partial<GeneratorInput>)
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { refused++; continue }
    plansGenerated++

    const goalPace = plan.meta.goal_pace_per_km ?? null
    for (const { s, phase, type } of sessionsOf(plan)) {
      if (phase !== 'peak' || type === 'deload') continue
      // The race-specific long run, identified the way §25 identifies it: a long
      // run carrying the segmented zone the race-pace catalogue rows declare.
      if (!isLongRun(s) || s.zone !== 'Zone 2–3') continue
      peakRaceLongRuns++
      labels.add(s.label ?? '(no label)')
      // Exactly what the Session screen does.
      const row = catalogueRowFor(s)
      const structure = composeSession({ session: s, catalogueRow: row ?? null, goalPace })
      if (structure?.shape === 'long_run_with_mp') withOverlay++
    }
  }

  anySessions += peakRaceLongRuns
  const pct = peakRaceLongRuns === 0 ? 'n/a' : `${((withOverlay / peakRaceLongRuns) * 100).toFixed(1)}%`
  const declared = (SESSION_FORMAT.LONG_RUN_PEAK.race_pace_distances as readonly string[]).includes(d.key)
  console.log(`\n▶ ${d.key}  (row ${d.rowId}) — declared in race_pace_distances: ${declared ? 'YES' : 'no'}`)
  console.log(`   peak race-specific long runs : ${peakRaceLongRuns}`)
  console.log(`   render the race-pace overlay : ${withOverlay}  (${pct})`)
  console.log(`   labels seen                  : ${Array.from(labels).join(' | ') || '(none)'}`)
  if (peakRaceLongRuns === 0) console.log('   ⚠️  ZERO sessions — the grid is not reaching the producer.')
}

console.log(`\nplans generated: ${plansGenerated}  refused: ${refused}`)
if (plansGenerated === 0 || anySessions === 0) {
  console.error('FAIL: the grid reached no race-specific long runs — this measurement means nothing.')
  process.exit(1)
}

// ── Part 2: the SECOND and THIRD unread facts ──────────────────────────────
// The rows declare their own split (hm 65/35, mp 60/40) and their own pace zone
// ('HM'/'MP'). `composeSession` reads neither — it applies a flat
// SESSION_FORMAT.LONG_RUN_PEAK.race_pace_segment_pct = 20 to the MAIN set and
// hardcodes the words "MP target". This prints what each source would prescribe
// on the real peak long runs above, so the board rules on minutes, not prose.
import { V1_SESSION_CATALOGUE } from '../lib/plan/sessionCatalogueData'
import { sessionSplit } from '../lib/plan/sessionFormat'

console.log('\n── declared vs delivered race-pace dose ──')
for (const d of DISTS) {
  const row = V1_SESSION_CATALOGUE.find(r => r.id === d.rowId)!
  const ms = row.main_set_structure as Record<string, unknown>
  console.log(`\n▶ ${d.key} (${d.rowId}) declares ${JSON.stringify(ms)}`)

  const durs: number[] = []
  for (const lvl of LEVELS) for (const days of DAYS) for (const vol of VOLUMES) {
    const input = base({
      race_distance_km: d.km, target_time: d.target,
      current_weekly_km: vol, longest_recent_run_km: Math.max(8, Math.round(vol * 0.35)),
      days_available: days, fitness_level: lvl,
    } as Partial<GeneratorInput>)
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { continue }
    for (const { s, phase, type } of sessionsOf(plan)) {
      if (phase !== 'peak' || type === 'deload') continue
      if (!isLongRun(s) || s.zone !== 'Zone 2–3') continue
      if (typeof s.duration_mins === 'number') durs.push(s.duration_mins)
    }
  }
  if (durs.length === 0) { console.log('   ⚠️ no durations captured'); continue }
  const mean = durs.reduce((a, b) => a + b, 0) / durs.length
  const max = Math.max(...durs)
  const shipped = SESSION_FORMAT.LONG_RUN_PEAK.race_pace_segment_pct
  const declared = ms.race_pace_pct as number
  const fmt = (total: number) => {
    const main = sessionSplit(total).main
    return `session ${Math.round(total)} min (main ${Math.round(main)} min): ` +
      `shipped ${shipped}% of main = ${(main * shipped / 100).toFixed(0)} min | ` +
      `row ${declared}% of main = ${(main * declared / 100).toFixed(0)} min | ` +
      `row ${declared}% of session = ${(total * declared / 100).toFixed(0)} min`
  }
  console.log(`   n=${durs.length}  mean ${fmt(mean)}`)
  console.log(`         longest ${fmt(max)}`)
}

// ── Part 3: the three guards the new gate must not break ───────────────────
// 1. §47 step-back peak long runs must NOT carry the overlay (it strips the
//    label, the zone, lr_segment_pace AND catalogue_id).
// 2. §24b's 5K/10K three-part segmented long run (easy → MP → HM finish) is
//    built inline with no catalogue row and must NOT be flattened into the
//    two-part shape.
// 3. §24e — ultra long runs must never carry a pace overlay.
console.log('\n── guards ──')
const GUARD = [
  { key: '5K',  km: 5,    target: '22:00',   goal: 'time_target' },
  { key: '10K', km: 10,   target: '46:00',   goal: 'time_target' },
  { key: '50K', km: 50,   target: undefined, goal: 'finish' },
] as const

let stepbackLongRuns = 0, stepbackWithOverlay = 0
for (const d of DISTS) {
  for (const lvl of LEVELS) for (const days of DAYS) for (const vol of VOLUMES) {
    const input = base({
      race_distance_km: d.km, target_time: d.target,
      current_weekly_km: vol, longest_recent_run_km: Math.max(8, Math.round(vol * 0.35)),
      days_available: days, fitness_level: lvl,
    } as Partial<GeneratorInput>)
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { continue }
    const goalPace = plan.meta.goal_pace_per_km ?? null
    for (const { s, phase } of sessionsOf(plan)) {
      // A peak long run that is NOT the race-specific one = §47's step-back.
      if (phase !== 'peak' || !isLongRun(s) || s.zone === 'Zone 2–3') continue
      stepbackLongRuns++
      const st = composeSession({ session: s, catalogueRow: catalogueRowFor(s) ?? null, goalPace })
      if (st?.shape === 'long_run_with_mp') stepbackWithOverlay++
    }
  }
}
console.log(`1. §47 step-back peak long runs: ${stepbackLongRuns}, with overlay: ${stepbackWithOverlay} (must be 0)`)

for (const g of GUARD) {
  let longRuns = 0, overlay = 0
  for (const lvl of LEVELS) for (const days of DAYS) for (const vol of VOLUMES) {
    const input = base({
      race_distance_km: g.km, target_time: g.target, goal: g.goal,
      current_weekly_km: vol, longest_recent_run_km: Math.max(8, Math.round(vol * 0.35)),
      days_available: days, fitness_level: lvl,
    } as Partial<GeneratorInput>)
    let plan: Plan
    try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { continue }
    const goalPace = plan.meta.goal_pace_per_km ?? null
    for (const { s } of sessionsOf(plan)) {
      if (!isLongRun(s)) continue
      longRuns++
      const st = composeSession({ session: s, catalogueRow: catalogueRowFor(s) ?? null, goalPace })
      if (st?.shape === 'long_run_with_mp') overlay++
    }
  }
  console.log(`   ${g.key}: ${longRuns} long runs, ${overlay} with overlay (must be 0)`)
  if (longRuns === 0) console.log(`   ⚠️ ZERO ${g.key} long runs reached`)
}
