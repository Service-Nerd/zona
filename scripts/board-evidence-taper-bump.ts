/**
 * LR-TAPER-BUMP-01 — EVIDENCE for the Coaching Board. READ-ONLY, generates only.
 *
 * Question: `V4-long-run-repeat-ceiling` iterates every week and skips only
 * deloads. Its guards are §40/§9's time cap and §52's LR/weekly cap, and NEITHER
 * knows about phases. How often does it increment a long run in the TAPER?
 *
 * ⚠️ THE GRID IS BUILT AROUND A REAL CASE ON PURPOSE. A grid built from
 * `real-inputs` case 0 (HM, 3 days, 30 km/wk, no weekday cap) returns **0 of
 * 1,709** — it never reaches the interaction. The base below is plan `86ac765d`'s
 * own stored input: low volume, few days, weekday-capped, injury history, beginner,
 * long runway. Varying an axis is not reaching the interaction.
 *
 * ⚠️ RUN IT WITH `NODE_ENV=production`. That runner's own input is
 * self-contradictory (longest 20 km > weekly 10 km), which `INV-INPUT-LONGEST-LE-WEEKLY`
 * THROWS on in dev/test and only logs in production — which is why the plan exists
 * at all. Under `NODE_ENV=test` the whole grid refuses and the answer reads zero.
 *
 * Measured 2026-10-09: 1,840 generated — V4 fired on 1,312 (71.3%), a TAPER week
 * bumped on 416 (31.7% of V4, 22.6% of all), race week 0.
 *
 *   PATH=... NODE_ENV=production npx tsx scripts/board-evidence-taper-bump.ts
 *
 * 🔴 RE-DERIVE BEFORE THE SITTING. These numbers are from one day's engine.
 */
import { generateRulePlan } from '../lib/plan/ruleEngine'
const base: any = { age: 34, goal: 'finish', terrain: 'road',
  benchmark: { time: '2:20:00', type: 'race', distance_km: 21.1 },
  race_date: '2027-04-25', race_name: 'R', training_age: '<6mo', days_available: 3,
  injury_history: ['plantar fasciitis'], max_weekday_mins: 45, race_distance_km: 42.2,
  current_weekly_km: 10, days_cannot_train: ['tuesday','wednesday','friday','saturday'],
  user_declared_level: 'beginner', longest_recent_run_km: 20, preferred_long_run_day: 'sun',
  recent_quality_training: 'none', hard_session_relationship: 'neutral' }
const PS = '2026-12-07'
let gen = 0, refused = 0, v4 = 0, taper = 0, race = 0
const phases: Record<string, number> = {}
const cases: string[] = []
for (const dist of [21.1, 42.2])
 for (const cwk of [10, 15, 20, 30, 45])
  for (const lrr of [6, 10, 20, 28])
   for (const days of [3, 4, 5])
    for (const mwm of [30, 45, 60, undefined])
     for (const ta of ['<6mo', '1-2yr'])
      for (const inj of [['plantar fasciitis'], []]) {
  const input = { ...base, race_distance_km: dist, current_weekly_km: cwk,
    longest_recent_run_km: lrr, days_available: days, max_weekday_mins: mwm,
    training_age: ta, injury_history: inj,
    days_cannot_train: days === 3 ? ['tuesday','wednesday','friday','saturday'] : [] }
  let p: any
  try { p = generateRulePlan(input, 'paid', PS); gen++ } catch { refused++; continue }
  const a = (p.meta?.rule_adjustments ?? []).find((x: any) => x.rule === 'V4-long-run-repeat-ceiling')
  if (!a) continue
  v4++
  const byN = new Map<number, any>(p.weeks.map((w: any) => [w.n, w]))
  let hitTaper = false, hitRace = false
  for (const n of a.weeks_affected ?? []) {
    const ph = byN.get(n)?.phase ?? '?'
    phases[ph] = (phases[ph] ?? 0) + 1
    if (ph === 'taper') hitTaper = true
    if (byN.get(n)?.type === 'race' || ph === 'race') hitRace = true
  }
  if (hitTaper) { taper++
    if (cases.length < 8) cases.push(`${dist}km cwk=${cwk} lrr=${lrr} d=${days} mwm=${mwm} ta=${ta} inj=${inj.length} weeks=${a.weeks_affected}`) }
  if (hitRace) race++
}
console.log(`generated ${gen}, refused ${refused}`)
console.log(`V4 fired: ${v4} (${gen?(100*v4/gen).toFixed(1):0}% of generated)`)
console.log(`  TAPER bumped: ${taper} (${v4?(100*taper/v4).toFixed(1):0}% of V4, ${gen?(100*taper/gen).toFixed(1):0}% of all)`)
console.log(`  RACE week bumped: ${race}`)
console.log(`  phases V4 touched:`, phases)
cases.forEach(c => console.log('   ', c))
