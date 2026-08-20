// Property-based sweep: generate plans across a wide grid of inputs and run
// validatePlan on each. Catches edge cases hand-written tests miss.
// Replaces find-zero-easy.ts as a more general constitutional fuzzer.
//
// Run: NODE_ENV=production npx tsx scripts/property-validate-plans.ts
// Exit: 0 if all plans pass invariants; 1 if any violations.
// (NODE_ENV=production prevents the engine from throwing — we want to collect.)

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan, type Violation } from '../lib/plan/invariants'

const baseInput = {
  athlete_name: 'Athlete', age: 35,
  race_name: 'Test', target_time: '0:45:00',
  primary_metric: 'distance' as const,
  injury_history: [],
  plan_start: '2026-04-27',
}

const distancesAndDates: any[] = [
  { race_distance_km: 5,    race_date: '2026-07-06' },
  { race_distance_km: 10,   race_date: '2026-07-26' },
  { race_distance_km: 21.1, race_date: '2026-08-10' },
  { race_distance_km: 42.2, race_date: '2026-09-01' },
]
const cwks = [5, 12, 25, 40, 60]
const lrrs = [3, 8, 15, 22]
const dayOptions: any[] = [
  { days_available: 2, blocked_days: ['mon','tue','wed','thu','sat'] },
  { days_available: 3, blocked_days: ['mon','tue','thu','sat'] },
  { days_available: 3, blocked_days: ['tue','thu'] },
  { days_available: 4, blocked_days: ['tue','thu'] },
  { days_available: 5, blocked_days: ['tue'] },
  { days_available: 7, blocked_days: [] },
  // SC-01 coverage gap (2026-08-20): every 4- and 5-day row above BLOCKS days,
  // which narrows day placement and hides defects that only appear when the
  // scheduler has a free choice. The plainest real shape — "I can run four
  // days, no constraints" — was absent, so the sweep reported 414,720 clean
  // plans while a reproducible INV-PLAN-PEAK-IN-PEAK-PHASE violation sat in it.
  // A grid that only tests constrained weeks is not a property sweep.
  { days_available: 4, blocked_days: [] },
  { days_available: 5, blocked_days: [] },
  { days_available: 6, blocked_days: [] },
]
const fitnessSets = ['beginner', 'intermediate', 'experienced']
const hardSets = ['love', 'avoid', 'neutral']
const injurySets = [[], ['knee'], ['achilles'], ['shin_splints'], ['hip_flexor'], ['back']]
const maxWeekdays = [undefined, 45, 60, 90]

// GEN-FIX-08 — HR dimension. The sweep had no HR axis at all, which is why F1
// (a HealthKit-observed max HR 22% below the age estimate, producing a Zone 2
// ceiling 28 bpm low) was invisible to 103,680 generated plans. baseInput.age is
// 35, so Tanaka gives 208 - 0.7*35 = 184.
const TANAKA_AT_35 = 184
const hrSets: any[] = [
  { label: 'absent',        hr: {} },
  { label: 'tanaka',        hr: { resting_hr: 55, max_hr: TANAKA_AT_35 } },
  { label: 'observed-low',  hr: { resting_hr: 55, max_hr: Math.round(TANAKA_AT_35 * 0.7), max_hr_source: 'observed' } },
  { label: 'max-only',      hr: { max_hr: TANAKA_AT_35 } },
]

// SC-01 coverage gap (2026-08-20): `goal` was never set, so every one of the
// 414,720 plans ran the `finish` path. `time_target` is what switches on goal
// pace, the §22 race-specific rename, and the goal-vs-interval pace ladder —
// i.e. most of what the 2026-08-19 audit found defects in. The sweep's clean
// bill of health covered none of it.
const goalSets: any[] = [
  { label: 'finish',      goal: undefined },
  { label: 'time_target', goal: 'time_target' },
]

let totalPlans = 0
let violatingPlans = 0
const violationsByCode = new Map<string, number>()
const samples: { input: any, violation: Violation }[] = []

for (const d of distancesAndDates) for (const cwk of cwks) for (const lrr of lrrs)
for (const days of dayOptions) for (const f of fitnessSets) for (const hs of hardSets)
for (const injuries of injurySets) for (const mw of maxWeekdays) for (const hrSet of hrSets)
for (const g of goalSets) {
  const input: any = { ...baseInput, ...d, current_weekly_km: cwk, longest_recent_run_km: lrr,
    ...days, fitness_level: f, hard_session_relationship: hs,
    injury_history: injuries, max_weekday_mins: mw, ...hrSet.hr,
    ...(g.goal ? { goal: g.goal } : {}),
  }
  totalPlans++
  let plan
  try { plan = generateRulePlan(input, 'free') } catch { continue }
  const violations = validatePlan(plan, input)
  const errors = violations.filter(v => v.severity === 'error')
  if (errors.length > 0) {
    violatingPlans++
    for (const v of errors) {
      violationsByCode.set(v.code, (violationsByCode.get(v.code) ?? 0) + 1)
      if (samples.length < 5) samples.push({ input, violation: v })
    }
  }
}

console.log(`Plans generated: ${totalPlans}`)
console.log(`Plans with violations: ${violatingPlans}`)
console.log()
if (violationsByCode.size > 0) {
  console.log('Violations by code:')
  for (const [code, n] of Array.from(violationsByCode.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${n}`)
  }
  console.log()
  console.log('Sample violations:')
  for (const { input, violation } of samples) {
    console.log(`  ${violation.code} on ${input.race_distance_km}km/${input.fitness_level}/days=${input.days_available}/cwk=${input.current_weekly_km}: ${violation.message} (week ${violation.week}, got ${violation.actual}, expected ${violation.expected})`)
  }
  process.exit(1)
}
console.log('✓ All plans pass invariant validation.')
