// review-charity-marathon-round.ts — a one-off coaching-review packet for the
// charity marathon cohort plus one experienced-10K contrast case (2026-09-16).
//
// WHY A SCRIPT AND NOT A HAND-WRITTEN REVIEW. The board rules on what the engine
// ACTUALLY produces, not on a description of it. Every plan here comes from the
// live `generateRulePlan` + `composePlanWithFoundation` pair — the same two calls
// `/api/generate-plan` makes — and is then put through BOTH gates:
//   1. `validatePlan`  — does it obey the constitution?
//   2. `scan`          — the coach's eye, imported from coaching-deviation-scan
//                        so the checks are not copied. That file's own header
//                        says a check belongs in validatePlan or here, never
//                        duplicated; that applies to callers too.
//
// Run: NODE_ENV=production npx tsx scripts/review-charity-marathon-round.ts
import { generateRulePlan } from '../lib/plan/ruleEngine'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import { validatePlan } from '../lib/plan/invariants'
import { scan } from './coaching-deviation-scan'
import type { GeneratorInput, Plan } from '../types/plan'

// PINNED Monday, never the wall clock (SWEEP-VACUOUS-01).
const TODAY = '2026-09-21'

/** Race `weeks` out, landing on the Sunday that ends that week. */
const raceIn = (weeks: number): string =>
  new Date(new Date(`${TODAY}T00:00:00Z`).getTime() + (weeks * 7 - 1) * 86_400_000)
    .toISOString().slice(0, 10)

interface ReviewCase {
  id: string
  who: string
  /** What this case is meant to stress, so the board knows why it is here. */
  stresses: string
  weeks: number
  input: Omit<GeneratorInput, 'race_date'>
}

const CASES: ReviewCase[] = [
  // ── MARATHON (5) ────────────────────────────────────────────────────────
  // NOTE: no sex is stated anywhere. `GeneratorInput` has no such field
  // (INPUT-SEX-01, parked 2026-09-16), so describing a runner's sex here would
  // be describing something the engine cannot read. These are runners.
  { id: 'M1', who: 'First marathon, near-zero base. 12 km/wk over 3 days, longest ever 6 km. Neutral on hard sessions. 30 weeks out.',
    stresses: '§2/§3 ramp off almost nothing · §57 foundation + §97 Am. uncovered runway · §52 low-day maintenance',
    weeks: 30,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 12, longest_recent_run_km: 6,
      days_available: 3, age: 26, training_age: '<6mo', recent_quality_training: 'none',
      hard_session_relationship: 'neutral', injury_history: [], preferred_long_run_day: 'sun',
      foundation_decision: 'add' } as never },

  { id: 'M2', who: 'First marathon, some base. 22 km/wk over 4 days, longest 11 km, occasional harder running. 20 weeks out.',
    stresses: 'the same cohort with MORE to work with — does the engine use the extra day and base?',
    weeks: 20,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 22, longest_recent_run_km: 11,
      days_available: 4, age: 23, training_age: '6-18mo', recent_quality_training: 'occasional',
      hard_session_relationship: 'neutral', injury_history: [], preferred_long_run_day: 'sun',
      foundation_decision: 'add' } as never },

  { id: 'M3', who: 'First marathon, late charity place. 18 km/wk over 3 days, longest 9 km, 45 min weekday cap. 14 weeks out.',
    stresses: '§44 prep-time honesty · time_compressed + volume_constrained together · §81 weekday cap',
    weeks: 14,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 18, longest_recent_run_km: 9,
      days_available: 3, age: 34, training_age: '<6mo', recent_quality_training: 'none',
      max_weekday_mins: 45, acknowledged_prep_warning: true, hard_session_relationship: 'neutral',
      injury_history: [], preferred_long_run_day: 'sat', foundation_decision: 'add' } as never },

  { id: 'M4', who: 'Third marathon, chasing 3:45. 48 km/wk over 5 days, longest 26 km, trains hard weekly and LOVES it. 18 weeks out.',
    stresses: '§35 love ladder · §22 goal pace · §1 ceiling at marathon (18%) · does "love" actually change the plan?',
    weeks: 18,
    input: { race_distance_km: 42.2, goal: 'time_target', target_time: '3:45:00',
      benchmark: { type: 'race', distance_km: 21.1, time: '1:45:00' },
      current_weekly_km: 48, longest_recent_run_km: 26, days_available: 5, age: 38,
      training_age: '2-5yr', user_declared_level: 'intermediate', recent_quality_training: 'regular',
      hard_session_relationship: 'love', resting_hr: 50, max_hr: 186, injury_history: [],
      preferred_long_run_day: 'sun', foundation_decision: 'add' } as never },

  { id: 'M5', who: 'Second marathon. 40 km/wk over 4 days, longest 22 km, knee history, and says "I OVERDO it, rein me in". 16 weeks out.',
    stresses: '§96 overdo brake · §2/§12 injury cap · §90/ADR-022 delivered injury levers — does the brake reach anything?',
    weeks: 16,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 40, longest_recent_run_km: 22,
      days_available: 4, age: 45, training_age: '2-5yr', recent_quality_training: 'regular',
      hard_session_relationship: 'overdo', injury_history: ['knee'], resting_hr: 54, max_hr: 178,
      preferred_long_run_day: 'sun', foundation_decision: 'add' } as never },

  // ── HALF MARATHON (3) ───────────────────────────────────────────────────
  { id: 'H1', who: 'First half marathon. 14 km/wk over 3 days, longest 7 km. Neutral. 16 weeks out.',
    stresses: 'HM at the bottom of the ability range · §52 low-day at a distance where ok=4 · long-run floor',
    weeks: 16,
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 14, longest_recent_run_km: 7,
      days_available: 3, age: 31, training_age: '<6mo', recent_quality_training: 'none',
      hard_session_relationship: 'neutral', injury_history: [], preferred_long_run_day: 'sun',
      foundation_decision: 'add' } as never },

  { id: 'H2', who: 'Chasing sub-1:45 half. 42 km/wk over 4 days, longest 18 km, structured sessions weekly and enjoys them. 14 weeks out.',
    stresses: '§89 gate at HM · §24d race-pace long run · §25 race-pace overlay reach · §1 ceiling 20%',
    weeks: 14,
    input: { race_distance_km: 21.1, goal: 'time_target', target_time: '1:45:00',
      benchmark: { type: 'race', distance_km: 10, time: '0:47:00' },
      current_weekly_km: 42, longest_recent_run_km: 18, days_available: 4, age: 36,
      training_age: '2-5yr', user_declared_level: 'intermediate', recent_quality_training: 'regular',
      hard_session_relationship: 'love', resting_hr: 49, max_hr: 184, injury_history: [],
      preferred_long_run_day: 'sun', foundation_decision: 'add' } as never },

  { id: 'H3', who: 'Was a 1:35 half runner, 5yr+ history, but off for a year. Back to 18 km/wk over 4 days, longest 10 km. 12 weeks out.',
    stresses: '§29 fresh-return detection · §79 intensity re-entry · does the engine trust the history or the current volume?',
    weeks: 12,
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 18, longest_recent_run_km: 10,
      days_available: 4, age: 41, training_age: '5yr+', weeks_at_current_volume: 3,
      recent_quality_training: 'none', hard_session_relationship: 'neutral', injury_history: [],
      resting_hr: 52, max_hr: 180, preferred_long_run_day: 'sun', foundation_decision: 'add' } as never },

  // ── 10K (3) ─────────────────────────────────────────────────────────────
  { id: 'T1', who: 'Experienced, 5yr+. 45 km/wk over 5 days. Chasing a 10K PB (42:00 off 44:30). Structured sessions weekly, loves them. 14 weeks out.',
    stresses: '§89 early-onset gate · §97/§98 onset vs §1 · §106 peak ceiling vs a runner already at volume',
    weeks: 14,
    input: { race_distance_km: 10, goal: 'time_target', target_time: '0:42:00',
      benchmark: { type: 'race', distance_km: 10, time: '0:44:30' },
      current_weekly_km: 45, longest_recent_run_km: 18, days_available: 5, age: 44,
      training_age: '5yr+', user_declared_level: 'experienced', recent_quality_training: 'regular',
      hard_session_relationship: 'love', resting_hr: 48, max_hr: 180, max_hr_source: 'observed',
      injury_history: [], preferred_long_run_day: 'sun', foundation_decision: 'add' } as never },

  { id: 'T2', who: 'First 10K. 10 km/wk over 3 days, longest 4 km. AVOIDS hard sessions. 10 weeks out.',
    stresses: '§35 avoid rung · the bottom of the ability range · is a 10K plan still a plan at this base?',
    weeks: 10,
    input: { race_distance_km: 10, goal: 'finish', current_weekly_km: 10, longest_recent_run_km: 4,
      days_available: 3, age: 29, training_age: '<6mo', recent_quality_training: 'none',
      hard_session_relationship: 'avoid', injury_history: [], preferred_long_run_day: 'sat',
      foundation_decision: 'add' } as never },

  { id: 'T3', who: 'Wants sub-50 10K. 30 km/wk over 4 days, longest 12 km, trains hard but admits "I OVERDO it". 12 weeks out.',
    stresses: '§96 overdo brake at a short distance where §1 is loosest (25%) · §22 goal pace',
    weeks: 12,
    input: { race_distance_km: 10, goal: 'time_target', target_time: '0:50:00',
      benchmark: { type: 'race', distance_km: 5, time: '0:26:30' },
      current_weekly_km: 30, longest_recent_run_km: 12, days_available: 4, age: 33,
      training_age: '6-18mo', user_declared_level: 'intermediate', recent_quality_training: 'occasional',
      hard_session_relationship: 'overdo', resting_hr: 55, max_hr: 188, injury_history: [],
      preferred_long_run_day: 'sun', foundation_decision: 'add' } as never },
]

const isRaceWeek = (w: Plan['weeks'][number]) =>
  Object.values(w.sessions ?? {}).some(s => (s as { type?: string } | undefined)?.type === 'race')

function render(c: ReviewCase, input: GeneratorInput, plan: Plan): void {
  const main = plan.weeks.filter(w => w.n >= 1)
  const found = plan.weeks.filter(w => w.n <= 0)
  const training = main.filter(w => !isRaceWeek(w))
  const vols = training.map(w => w.weekly_km ?? 0)
  const peak = vols.length ? Math.max(...vols) : 0

  // Ramp measured between NON-deload weeks, which is the quantity §2 governs.
  let maxRamp = 0, prev: number | null = null
  for (const w of training) {
    const km = w.weekly_km ?? 0
    if (w.badge === 'deload') continue
    if (prev !== null && prev > 0 && km > prev) maxRamp = Math.max(maxRamp, (km - prev) / prev * 100)
    prev = km
  }

  const AEROBIC = new Set(['easy', 'recovery', 'rest', 'race', 'cross_train', 'strength'])
  const sessions = main.flatMap(w => Object.values(w.sessions ?? {})) as Array<{ type?: string; label?: string }>
  const quality = sessions.filter(s => s.type && !AEROBIC.has(s.type))

  const longestLr = Math.max(0, ...main.flatMap(w =>
    Object.values(w.sessions ?? {}).map(s => (s as { distance_km?: number } | undefined)?.distance_km ?? 0)))

  console.log(`\n${'═'.repeat(78)}`)
  console.log(`${c.id} — ${c.who}`)
  console.log(`Stresses: ${c.stresses}`)
  console.log('─'.repeat(78))
  console.log(`  plan_start        ${plan.meta.plan_start}   (today ${TODAY}, race ${input.race_date})`)
  console.log(`  main weeks        ${main.length}   foundation ${found.length}   uncovered ${plan.meta.uncovered_runway_weeks ?? 0}`)
  console.log(`  phases            ${['base', 'build', 'peak', 'taper'].map(p => `${p[0]}${main.filter(w => w.phase === p).length}`).join(' ')}`)
  console.log(`  week 1 volume     ${training[0]?.weekly_km ?? 0} km`)
  console.log(`  peak volume       ${peak} km   (target ${plan.meta.peak_km_target ?? 'n/a'})`)
  console.log(`  max ramp (§2)     ${maxRamp.toFixed(1)}%`)
  console.log(`  longest run       ${longestLr.toFixed(1)} km`)
  console.log(`  quality sessions  ${quality.length} of ${sessions.length}` +
    (sessions.length ? ` (${(quality.length / sessions.length * 100).toFixed(1)}%)` : ''))
  console.log(`  volume_profile    ${plan.meta.volume_profile ?? '(none)'}`)
  console.log(`  early onset §89   ${plan.meta.early_quality_onset === true ? 'YES' : 'no'}`)

  const noteKeys = Object.keys(plan.meta as unknown as Record<string, unknown>).filter(k => /note$/.test(k))
  console.log(`\n  RUNNER-FACING NOTES (${noteKeys.length}):`)
  if (!noteKeys.length) console.log('    (none)')
  for (const k of noteKeys) {
    const v = String((plan.meta as unknown as Record<string, unknown>)[k] ?? '')
    console.log(`    · ${k}: ${v.slice(0, 210)}${v.length > 210 ? '…' : ''}`)
  }

  console.log('\n  WEEK BY WEEK:')
  for (const w of plan.weeks) {
    const named = Object.values(w.sessions ?? {})
      .filter(s => s && (s as { type?: string }).type !== 'easy')
      .map(s => (s as { label?: string }).label).filter(Boolean)
    console.log(`    ${String(w.n).padStart(3)} ${String(w.phase).padEnd(10)}` +
      `${String(w.weekly_km ?? 0).padStart(4)} km  ${w.badge === 'deload' ? '[deload] ' : ''}` +
      `${named.length ? named.join(' | ') : 'all easy'}`)
  }

  const violations = validatePlan(plan, input)
  const errs = violations.filter(v => v.severity === 'error')
  const warns = violations.filter(v => v.severity === 'warn')
  console.log(`\n  validatePlan: ${errs.length} error, ${warns.length} warn`)
  for (const v of errs) console.log(`    [ERROR] ${v.code} — ${v.message.slice(0, 150)}`)
  for (const code of Array.from(new Set(warns.map(v => v.code)))) {
    console.log(`    [warn]  ${code} ×${warns.filter(v => v.code === code).length}`)
  }

  const devs = scan(input, plan)
  console.log(`\n  coach's eye (deviation scan): ${devs.length || 'clean'}`)
  for (const d of devs) console.log(`    [${d.severity}] ${d.what} — ${d.detail}`)
}

console.log('CHARITY MARATHON COHORT + 10K CONTRAST — coaching review packet')
console.log(`Generated from the LIVE engine. today=${TODAY}. Every plan composed the way /api/generate-plan does.`)

for (const c of CASES) {
  const input = { ...c.input, race_date: raceIn(c.weeks), plan_start: TODAY } as unknown as GeneratorInput
  let plan: Plan
  try {
    plan = generateRulePlan(input, 'paid', TODAY, undefined, TODAY)
  } catch (e) {
    console.log(`\n${'═'.repeat(78)}\n${c.id} — REFUSED BY DESIGN: ${(e as Error).message}`)
    continue
  }
  const { plan: composed } = composePlanWithFoundation(plan, input, TODAY, 'add')
  render(c, input, composed)
}
console.log()
