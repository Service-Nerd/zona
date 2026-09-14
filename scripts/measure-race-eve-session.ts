// measure-race-eve-session.ts — §39 race-week easy landing on RACE EVE.
//
// §39 is titled "Race-week MID-WEEK easy run" and prescribes "one slightly
// longer easy run ... on a non-shakeout day" for HM/marathon when the runner has
// >= 4 days available. The implementation picks the day from the preference
// order ['sat','fri','wed','mon','tue','thu'] -- and for a SUNDAY race, which is
// what almost every real race is, `sat` is the day before the gun.
//
// Unlike the two shakeouts (capped at RACE_WEEK_SHAKEOUT_MAX_MINS = 35 via
// `enforceCap`), this session goes through `easySession` directly, so nothing
// bounds it. `applyWeekdayMinsCap` does not reach it either -- Saturday is not
// a weekday.
//
// Counts, across a Sunday-race HM/marathon grid: how often the race-week easy
// lands the day before the race, and how long it is.
//
// Run: NODE_ENV=production npx tsx scripts/measure-race-eve-session.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan, Session } from '../types/plan'

const DAYS = ['mon','tue','wed','thu','fri','sat','sun'] as const
const PLAN_START = '2026-04-27'          // Monday
const RACE_DATE  = process.env.RACE_DATE ?? '2026-08-02'   // Sunday by default; override to test other weekdays

const DISTS = [
  { key: 'HM', km: 21.1, target: '1:55:00' },
  { key: 'MARATHON', km: 42.2, target: '4:00:00' },
] as const
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const
const DAYS_AVAIL = [4, 5, 6] as const
const VOLUMES = [25, 40, 60] as const
const GOALS = ['finish', 'time_target'] as const

let plans = 0, refused = 0
let raceEve = 0, raceEveMins = 0, worstMins = 0, worstLabel = ''
let raceWeeksReached = 0
const byDist: Record<string, { n: number; eve: number; maxMins: number }> = {}

for (const d of DISTS) for (const goal of GOALS) for (const lvl of LEVELS)
for (const da of DAYS_AVAIL) for (const vol of VOLUMES) {
  const input = {
    race_date: RACE_DATE, race_distance_km: d.km, goal,
    ...(goal === 'time_target' ? { target_time: d.target } : {}),
    age: 38, current_weekly_km: vol, longest_recent_run_km: Math.max(8, Math.round(vol * 0.35)),
    days_available: da, preferred_long_run_day: 'sun',
    max_weekday_mins: 75, max_hr: 184, resting_hr: 55,
    training_age: '2-5yr', recent_quality_training: 'occasional',
    fitness_level: lvl, primary_metric: 'distance',
  } as unknown as GeneratorInput
  let plan: Plan
  try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { refused++; continue }
  plans++
  byDist[d.key] ??= { n: 0, eve: 0, maxMins: 0 }
  byDist[d.key].n++

  // Race week = the week containing race day. Race is Sunday, so race eve = sat.
  const last = plan.weeks[plan.weeks.length - 1]
  const DAYS_L = ['mon','tue','wed','thu','fri','sat','sun'] as const
  const raceDow = new Date(RACE_DATE + 'T00:00:00Z').getUTCDay()
  const raceDay = DAYS_L[(raceDow + 6) % 7]
  const eveDay = DAYS_L[DAYS_L.indexOf(raceDay) - 1]
  const sat = eveDay ? (last.sessions as Record<string, Session | undefined>)[eveDay] : undefined
  const sun = (last.sessions as Record<string, Session | undefined>)[raceDay]
  if (sun?.type !== 'race') continue
  raceWeeksReached++
  if (sat && sat.type !== 'rest') {
    raceEve++
    byDist[d.key].eve++
    const mins = sat.duration_mins ?? 0
    raceEveMins += mins
    byDist[d.key].maxMins = Math.max(byDist[d.key].maxMins, mins)
    if (mins > worstMins) { worstMins = mins; worstLabel = `${d.key} ${goal} ${lvl} ${vol}km/wk: ${sat.label} ${sat.distance_km}km/${mins}min` }
  }
}

const pct = (n: number, dd: number) => dd === 0 ? 'n/a' : `${((n / dd) * 100).toFixed(1)}%`
console.log(`plans generated: ${plans}  refused: ${refused}`)
if (plans === 0) { console.error('FAIL: grid generated nothing.'); process.exit(1) }
console.log(`\n§30 caps a race-week SHAKEOUT at ${GENERATION_CONFIG.RACE_WEEK_SHAKEOUT_MAX_MINS ?? '35'} min. §39's easy run is not capped.`)
console.log(`\nSessions on RACE EVE (the day before the race): ${raceEve} / ${plans}  (${pct(raceEve, plans)})`)
if (raceEve > 0) console.log(`  mean duration: ${(raceEveMins / raceEve).toFixed(0)} min`)
for (const [k, v] of Object.entries(byDist)) {
  console.log(`  ${k}: ${v.eve}/${v.n} (${pct(v.eve, v.n)}), longest ${v.maxMins} min`)
}
console.log(`\nWorst case: ${worstLabel || '(none — no session on race eve)'}`)
// ⚠️ The guard is on RACE WEEKS REACHED, not on the finding. It used to read
// `if (raceEve === 0) FAIL`, which was right while the defect existed and became
// wrong the moment it was fixed: 0 is now the CORRECT answer, and a guard that
// fails on success is a guard that gets deleted. What must never be silent is a
// grid that generated plans but never reached a race week.
console.log(`\nrace weeks inspected: ${raceWeeksReached} / ${plans}`)
if (raceWeeksReached === 0) {
  console.error('FAIL: no race week was inspected — this measurement means nothing.')
  process.exit(1)
}
console.log(raceEve === 0
  ? '\n✅ §39 Amendment 1 holds: no scheduled session on race eve.'
  : `\n❌ ${raceEve} plans schedule a session on race eve.`)
