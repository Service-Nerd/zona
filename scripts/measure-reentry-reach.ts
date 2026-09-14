// measure-reentry-reach.ts — is §79's intensity re-entry window ever ACTIVE
// during a week that actually carries quality?
//
// §79: "A returning runner whose intensity was lifted has an aerobic engine
// ahead of their tissue tolerance. Withhold VO2max/hills for the opening
// RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS so quality leads with tempo/threshold."
//
// The intent is explicit: QUALITY LEADS WITH TEMPO. But the window is counted in
// PLAN weeks (`wn <= intensityReentryWeeks`) and the opening weeks are the
// all-easy BASE phase, where there is no quality to withhold. If quality starts
// the week after the window closes, §79 protects nothing.
//
// The cohort grid cannot show this: it never sets `training_age`, so §79's
// intensity lift never fires anywhere in it. This grid sets it deliberately.
//
// Run: NODE_ENV=production npx tsx scripts/measure-reentry-reach.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import type { GeneratorInput, Plan, Session } from '../types/plan'

// 'hard' excluded — that is §78's benchmark time trial, not a training stimulus.
const QUALITY = new Set(['quality', 'tempo', 'intervals'])
const isZ45 = (s: Session) => /4|5/.test(s.zone ?? '')
const PLAN_START = '2026-04-27'

const DISTS = [
  { km: 5, weeks: 12, target: '0:25:00' },
  { km: 10, weeks: 12, target: '0:52:00' },
  { km: 21.1, weeks: 16, target: '1:55:00' },
] as const
const VOLUMES = [15, 20, 28] as const          // low volume -> reads beginner on volume
const AGES = ['2-5yr', '5yr+'] as const        // the §79 lift trigger
const GOALS = ['finish', 'time_target'] as const
const DAYS = [3, 4] as const

const raceDate = (weeks: number) =>
  new Date(new Date(PLAN_START + 'T00:00:00Z').getTime() + weeks * 7 * 86400000).toISOString().slice(0, 10)

let plans = 0, refused = 0
let lifted = 0, withQuality = 0, firstQualityInsideWindow = 0, firstIsZ45 = 0
const firstWeeks: number[] = []

for (const d of DISTS) for (const vol of VOLUMES) for (const ta of AGES)
for (const goal of GOALS) for (const days of DAYS) {
  const input = {
    athlete_name: 'A', age: 35, race_name: 'T', primary_metric: 'distance',
    plan_start: PLAN_START, race_distance_km: d.km, race_date: raceDate(d.weeks), goal,
    ...(goal === 'time_target' ? { target_time: d.target } : {}),
    resting_hr: 55, max_hr: 184,
    current_weekly_km: vol, longest_recent_run_km: Math.max(3, Math.round(vol * 0.4)),
    training_age: ta, recent_quality_training: 'occasional',
    hard_session_relationship: 'neutral', injury_history: [],
    days_available: days, days_cannot_train: days === 3 ? ['tue', 'thu'] : [],
  } as unknown as GeneratorInput
  let plan: Plan
  try { plan = generateRulePlan(input, 'paid', PLAN_START) } catch { refused++; continue }
  plans++
  if (plan.meta.intensity_reentry_active !== true) continue
  lifted++

  let first: { week: number; s: Session } | null = null
  for (const w of plan.weeks) {
    for (const s of Object.values(w.sessions ?? {}) as (Session | undefined)[]) {
      if (s && QUALITY.has(s.type) && !first) first = { week: w.n, s }
    }
    if (first) break
  }
  if (!first) continue
  withQuality++
  firstWeeks.push(first.week)
  const window = (plan.meta.intensity_reentry_weeks as number | undefined)
    ?? GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS
  // §79 Amendment 1 — the window is counted in QUALITY-CARRYING weeks from
  // onset, so a calendar test (`first.week <= window`) is the OLD semantics and
  // would report 0/48 forever. The right question is simply: is the first
  // quality session protected, i.e. NOT Zone 4-5?
  if (!isZ45(first.s)) firstQualityInsideWindow++
  if (isZ45(first.s)) firstIsZ45++
}

const pct = (n: number, dd: number) => dd === 0 ? 'n/a' : `${((n / dd) * 100).toFixed(1)}%`
console.log(`plans: ${plans}  refused: ${refused}`)
console.log(`with §79 intensity re-entry ACTIVE: ${lifted}`)
if (lifted === 0) { console.error('FAIL: the grid never triggered §79 — measuring nothing.'); process.exit(1) }
console.log(`  of those, carrying any quality: ${withQuality}`)
if (withQuality === 0) { console.error('FAIL: no quality reached.'); process.exit(1) }
console.log(`\nFirst quality week: min ${Math.min(...firstWeeks)}, max ${Math.max(...firstWeeks)}`)
console.log(`§79 window: ${GENERATION_CONFIG.RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS} weeks (returning runner)`)
console.log(`\nfirst quality is PROTECTED (tempo/threshold, not Z4\u20135): ${firstQualityInsideWindow} / ${withQuality}  (${pct(firstQualityInsideWindow, withQuality)})`)
console.log(`first quality is Zone 4–5 despite §79 being active   : ${firstIsZ45} / ${withQuality}  (${pct(firstIsZ45, withQuality)})`)
