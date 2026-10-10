/** `V1-LOWVOL-MULTIDAY-01` — is McMillan's cohort already governed? READ-ONLY. */
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { GENERATION_CONFIG as C } from '../lib/plan/generationConfig'
import { deloadVolumeFraction } from '../lib/plan/deloadCadence'
import type { GeneratorInput, Plan } from '../types/plan'
const START = '2026-10-12'
const mk = (over: Record<string, unknown>): GeneratorInput => ({
  athlete_name: 'A', age: 38, race_name: 'T', primary_metric: 'distance',
  plan_start: START, race_distance_km: 5, race_date: '2027-04-25', goal: 'finish',
  resting_hr: 60, max_hr: 184, current_weekly_km: 20, longest_recent_run_km: 8,
  fitness_level: 'intermediate', training_age: '1-2yr', recent_quality_training: 'occasional',
  days_available: 5, days_cannot_train: [], injury_history: [], ...over,
} as unknown as GeneratorInput)
// 🔴 THE ENGINE'S OWN FORMULA, NOT A RESTATEMENT. `daysVolumeCanFill` divides
// `dayCountKm`, which GROSSES A DELOAD BACK UP to the pre-deload level for the
// day count only — ADR-022's deliberate design, so "a recovery week is
// lower-volume, not fewer-days". A naive `floor(weekly_km / 5)` therefore flags
// every deload as a breach: it reported 67 of 936 (7.2%) before this correction,
// and the two flags on McMillan's own cohort were weeks 4 and 8 — both deloads.
const permits = (km: number, isDeload: boolean, injured: boolean) => {
  const dayCountKm = isDeload ? km / deloadVolumeFraction(injured) : km
  return Math.max(C.MIN_TRAINING_DAYS_VOLUME_FLOOR, Math.floor(dayCountKm / C.MIN_KM_PER_TRAINING_DAY))
}
const isDeloadWeek = (w: { type?: string; badge?: string }) => w.type === 'deload' || w.badge === 'deload'

const runDays = (p: Plan, n: number) => {
  const w = p.weeks.find(x => x.n === n)
  if (!w) return null
  // ⚠️ RUN days. The session-type union has no 'strength'/'cross' member —
  // tsc caught a comparison against a literal that cannot occur, which would
  // have counted nothing and looked like it filtered. Non-run modalities are
  // carried on the session's own fields, not its `type`.
  const RUN_TYPES = new Set(['run', 'easy', 'long', 'quality', 'tempo', 'intervals', 'hard', 'recovery'])
  return Object.values(w.sessions ?? {}).filter(s => s && RUN_TYPES.has(s.type)).length
}
console.log(`MIN_KM_PER_TRAINING_DAY = ${C.MIN_KM_PER_TRAINING_DAY} · floor = ${C.MIN_TRAINING_DAYS_VOLUME_FLOOR}`)
console.log('\nMcMillan\'s named cohort: cwk=20 longest=8 days=5, the weeks that breached were 9-10\n')
console.log('  n  weekly_km  run days  volume/day  daysVolumeCanFill = max(3, floor(km/5))')
const p = generateRulePlan(mk({}), 'paid', START)
for (const w of p.weeks) {
  if ((w.n ?? 0) < 1 || w.type === 'race') continue
  const km = w.weekly_km ?? 0
  const d = runDays(p, w.n) ?? 0
  const canFill = permits(km, isDeloadWeek(w), false)
  const flag = d > canFill ? '  🔴 MORE DAYS THAN VOLUME PERMITS' : ''
  console.log(`  ${String(w.n).padStart(2)}  ${String(km).padStart(9)}  ${String(d).padStart(8)}  ${(km/Math.max(1,d)).toFixed(1).padStart(10)}  ${String(canFill).padStart(4)}${isDeloadWeek(w) ? ' (deload, grossed up)' : ''}${flag}`)
}
console.log('\nACROSS THE COHORT — does any week ever place more run days than volume permits?')
let rows = 0, breaches = 0
const worst: string[] = []
for (const cwk of [10, 15, 20, 25, 30, 40]) for (const days of [3, 4, 5, 6]) for (const dist of [5, 10, 21.1]) {
  let pl: Plan
  try { pl = generateRulePlan(mk({ current_weekly_km: cwk, days_available: days, race_distance_km: dist }), 'paid', START) } catch { continue }
  for (const w of pl.weeks) {
    if ((w.n ?? 0) < 1 || w.type === 'race') continue
    rows++
    const km = w.weekly_km ?? 0, d = runDays(pl, w.n) ?? 0
    const canFill = permits(km, isDeloadWeek(w), false)
    if (d > canFill) {
      breaches++
      if (worst.length < 5) worst.push(`cwk=${cwk} days=${days} ${dist}km w${w.n}: ${km}km over ${d} days (permits ${canFill}) = ${(km/d).toFixed(1)} km/day`)
    }
  }
}
console.log(`  week-instances ${rows} | run days exceed daysVolumeCanFill: ${breaches} (${(breaches/rows*100).toFixed(1)}%)`)
for (const w of worst) console.log('    ' + w)
console.log('\nAND THE §94 BREACH ON THAT COHORT — is the day count the driver, or the ramp?')
const v = validatePlan(p, mk({}))
for (const x of v.filter(y => y.code === 'INV-PLAN-DELIVERED-RAMP')) console.log(`  w${x.week}: ${String(x.actual)}`)
