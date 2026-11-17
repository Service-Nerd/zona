// MAXHR-AGE-ABSENT-01 — what removing the invented age actually does. Read-only.
//
//   npx tsx scripts/board-evidence-no-invented-age.ts
//
// Three questions no existing gate answers, because NO CORPUS CAN BUILD AN AGELESS RUNNER:
// `cohortGrid`, `targetedGrid` and every fixture set an age, so the branch this item is about
// is unreachable by all eight coaching gates. The cases are therefore CONSTRUCTED here, which
// is the `COHORT-GRID-UNSET-LEVEL-01` class stated out loud rather than discovered later.

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { buildHRZonesWithFallback } from '../lib/plan/hrZones'
import { mastersCadenceApplies } from '../lib/plan/mastersCadence'
import { computeZones } from '../lib/plan/zones'
import { tanakaMaxHR } from '../lib/plan/maxHrGuard'
import { cohortGrid } from '../lib/plan/cohortGrid'
import type { GeneratorInput } from '@/types/plan'

const BASE = {
  athlete_name: 'A', race_name: 'T', primary_metric: 'distance',
  race_distance_km: 10, race_date: '2027-03-28', goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 10,
  fitness_level: undefined, user_declared_level: 'intermediate',
  recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
  injury_history: [], days_available: 4, training_age: '1-3y',
} as unknown as GeneratorInput

console.log('\n── 1. THE CORPUS CANNOT REACH THIS AT ALL ──')
const grid = cohortGrid()
const ageless = grid.filter(g => typeof (g as { age?: number }).age !== 'number').length
console.log(`cohortGrid rows with NO age: ${ageless} of ${grid.length}`)
console.log(ageless === 0
  ? '  ⚠️ ZERO. Every coaching gate is structurally blind to the ageless runner, so the cases below are CONSTRUCTED.'
  : '  (some rows are ageless — the gates can see this)')

console.log('\n── 2. THE THREE §50 CASES, through the real producer ──')
const cases: [string, Partial<GeneratorInput>][] = [
  ['age + max (unchanged)',   { age: 40, max_hr: 185, resting_hr: 50 }],
  ['NO age, max present',     { max_hr: 185, resting_hr: 50 }],
  ['NO age, NO max',          { resting_hr: 50 }],
  ['NO age, NO max, NO rest', {}],
]
for (const [name, extra] of cases) {
  const hr = buildHRZonesWithFallback({ ...BASE, ...extra } as GeneratorInput)
  console.log(`  ${name.padEnd(26)} method=${String(hr.method).padEnd(22)} derived_max=${hr.derived_max ?? 'ABSENT'} z2ceil=${hr.zones.zone2Ceiling ?? 'ABSENT'} easyHR=${hr.zones.easyHR ?? 'ABSENT'}`)
  if (hr.assumption_note) console.log(`      note: ${hr.assumption_note.slice(0, 120)}…`)
}

console.log("\n── 3. §3 CADENCE UNDER IGNORANCE (Willy, binding) ──")
for (const age of [undefined, 30, 44, 45, 60]) {
  console.log(`  age ${String(age ?? 'ABSENT').padEnd(6)} -> masters cadence: ${mastersCadenceApplies(age)}`)
}

console.log('\n── 4. WHAT THE OLD FABRICATION COST, by real age ──')
const assumed = computeZones(tanakaMaxHR(30))
for (const age of [45, 55, 60, 65]) {
  const real = computeZones(tanakaMaxHR(age))
  console.log(`  a ${age}-year-old priced at 30: told easy <= ${assumed.zone2Ceiling}, own Z2 top ${real.zone2Ceiling}`
    + ` (+${(assumed.zone2Ceiling ?? 0) - (real.zone2Ceiling ?? 0)} bpm), own Z3 ${real.qualityHR}`)
}

console.log('\n── 5. DOES AN AGELESS PLAN STILL GENERATE? (§50: the engine NEVER refuses) ──')
for (const [name, extra] of cases) {
  try {
    const p = generateRulePlan({ ...BASE, ...extra } as GeneratorInput, 'trial', '2026-11-17', undefined, '2026-11-17')
    const sessions = p.weeks.flatMap(w => Object.values(w.sessions)).filter(Boolean) as { hr_target?: string; zone?: string }[]
    const withHr = sessions.filter(s => typeof s.hr_target === 'string').length
    const withZone = sessions.filter(s => typeof s.zone === 'string').length
    console.log(`  ${name.padEnd(26)} GENERATED ${p.weeks.length}w · meta.age=${p.meta.age ?? 'ABSENT'}`
      + ` · meta.max_hr=${p.meta.max_hr ?? 'ABSENT'} · sessions with hr_target ${withHr}/${sessions.length}`
      + ` · with zone ${withZone}/${sessions.length}`)
  } catch (e) {
    console.log(`  ${name.padEnd(26)} 🔴 REFUSED: ${(e as Error).name} ${JSON.stringify((e as unknown as {field?:string;value?:unknown}).field ?? '')} ${(e as Error).message.split('\n')[0].slice(0, 70)}`)
  }
}
