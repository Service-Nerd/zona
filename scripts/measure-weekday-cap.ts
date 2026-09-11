// UX-WIZARD-01 — how much volume does ONE global weekday cap suppress?
//
//   npx tsx scripts/measure-weekday-cap.ts
//
// THE QUESTION THE BOARD HAS TO SIZE. Today the runner states a single
// `max_weekday_mins` for Mon–Fri. A real week is not flat: someone with 30
// minutes on Tuesday and 90 on Thursday has to enter 30, because the field is
// one number and the engine trims every weekday to it. So the plan is built
// against the runner's WORST day, five times over.
//
// Option B (per-day budgets) claims to recover that. This measures the size of
// the prize: the same runner, same everything, generated at their worst-day cap
// versus a generous cap, and the delta is the volume the single field costs.
// If the delta is small, B is a UI preference; if it is large, B is a coaching
// argument.
//
// §81/§82 are already in force — long runs and structured sessions are EXEMPT
// from the cap and easy runs are floor-protected — so this measures what
// remains after the board's 2026-09-03 protections, not the naive version.

import { generateRulePlan } from '../lib/plan/ruleEngine'
import type { Week } from '../types/plan'

const PLAN_START = '2026-04-27'
const CAPS = [30, 45, 60, 90] as const
const GENEROUS = 180   // effectively uncapped for a weekday easy run

const DAY_SETS = [
  { days_available: 4, days_cannot_train: [] as string[] },
  { days_available: 5, days_cannot_train: ['tue'] },
  { days_available: 6, days_cannot_train: [] as string[] },
]
const DISTANCES = [10, 21.1, 42.2] as const
const VOLUMES = [25, 40, 55] as const
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const

function input(km: number, cwk: number, level: string, days: any, cap: number) {
  return {
    athlete_name: 'A', age: 35, race_name: 'T', primary_metric: 'distance' as const,
    plan_start: PLAN_START, race_distance_km: km,
    race_date: new Date(new Date(`${PLAN_START}T00:00:00Z`).getTime() + 16 * 7 * 86_400_000)
      .toISOString().slice(0, 10),
    target_time: km === 10 ? '0:52:00' : km === 21.1 ? '1:55:00' : '4:00:00',
    current_weekly_km: cwk, longest_recent_run_km: Math.round(cwk * 0.4),
    fitness_level: level, recent_quality_training: 'occasional',
    hard_session_relationship: 'neutral', injury_history: [] as string[],
    max_weekday_mins: cap, ...days,
  } as any
}

const peakKm = (weeks: Week[]) => {
  const real = weeks.filter(w => w.n >= 1 && w.phase !== 'taper')
  return real.length ? Math.max(...real.map(w =>
    Object.values(w.sessions).reduce((a: number, s: any) => a + (s?.distance_km ?? 0), 0))) : 0
}

console.log(`\nWhat ONE global weekday cap costs, vs a generous cap (${GENEROUS} min)`)
console.log(`§81/§82 already in force — long runs + structured sessions exempt, easy runs floor-protected.\n`)
console.log(`  cap   plans   mean peak km   vs generous   mean loss   worst loss`)
console.log(`  ${'-'.repeat(62)}`)

for (const cap of CAPS) {
  const losses: number[] = []
  const peaks: number[] = []
  let n = 0
  for (const km of DISTANCES) for (const cwk of VOLUMES) for (const level of LEVELS) for (const days of DAY_SETS) {
    try {
      const capped = peakKm(generateRulePlan(input(km, cwk, level, days, cap), 'trial', PLAN_START, undefined, PLAN_START).weeks)
      const free = peakKm(generateRulePlan(input(km, cwk, level, days, GENEROUS), 'trial', PLAN_START, undefined, PLAN_START).weeks)
      if (free <= 0) continue
      n++; peaks.push(capped)
      losses.push((free - capped) / free * 100)
    } catch { /* refusal by design */ }
  }
  const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
  console.log(
    `  ${String(cap).padStart(3)}   ${String(n).padStart(5)}   ` +
    `${mean(peaks).toFixed(1).padStart(12)}   ${''.padStart(11)}   ` +
    `${mean(losses).toFixed(1).padStart(8)}%   ${(losses.length ? Math.max(...losses) : 0).toFixed(1).padStart(9)}%`,
  )
}
console.log()
