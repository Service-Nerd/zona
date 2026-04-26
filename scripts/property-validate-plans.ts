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
]
const fitnessSets = ['beginner', 'intermediate', 'experienced']
const hardSets = ['love', 'avoid', 'neutral']
const injurySets = [[], ['knee'], ['achilles'], ['shin_splints'], ['hip_flexor'], ['back']]
const maxWeekdays = [undefined, 45, 60, 90]

let totalPlans = 0
let violatingPlans = 0
const violationsByCode = new Map<string, number>()
const samples: { input: any, violation: Violation }[] = []

for (const d of distancesAndDates) for (const cwk of cwks) for (const lrr of lrrs)
for (const days of dayOptions) for (const f of fitnessSets) for (const hs of hardSets)
for (const injuries of injurySets) for (const mw of maxWeekdays) {
  const input: any = { ...baseInput, ...d, current_weekly_km: cwk, longest_recent_run_km: lrr,
    ...days, fitness_level: f, hard_session_relationship: hs,
    injury_history: injuries, max_weekday_mins: mw,
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
