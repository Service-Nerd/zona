// Board evidence — two phase-shape defects that only appear once §89 made base
// length runner-dependent.
//
// (A) DELOAD LANDS ON WEEK 2 OF A PHASE. §87 ruled "a recovery week never opens
//     a phase". The neighbouring case was not ruled on: a deload on the phase's
//     SECOND week, which gives the runner exactly one week of a new stimulus
//     before recovering from it. The deload cadence is anchored to absolute week
//     number (`deloadCadence.ts`), so shortening base slides the phase boundary
//     underneath a fixed cadence.
//
// (B) PEAK PHASE CARRIES NO RACE-PACE WORK on a time-targeted plan. Specificity
//     should be highest closest to the race; measured, it peaks mid-build and
//     the peak phase runs general (VO2max/hills).
//
//   npx tsx scripts/board-evidence-phase-shape.ts
//
// REPORTS ONLY — same contract as trace-plan.ts / board-evidence-onset.ts.
import { generateRulePlan } from '../lib/plan/ruleEngine'
import type { GeneratorInput, Plan } from '../types/plan'

const TODAY = '2026-09-07'

function raceDate(weeksOut: number): string {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeksOut * 7)
  return d.toISOString().slice(0, 10)
}

const isQuality = (s: { type?: string }) => s?.type === 'quality'
const isDeload = (w: Plan['weeks'][number]) =>
  w.type === 'deload' || (w as { badge?: string }).badge === 'deload'

/** Does this week carry work at race pace? Label-based, matching how §22 renames. */
function hasRacePace(w: Plan['weeks'][number]): boolean {
  return Object.values(w.sessions).some(s => {
    if (!s || !isQuality(s)) return false
    const l = (s.label ?? '').toLowerCase()
    return l.includes('race pace') || l.includes('race-pace') ||
      /\b(5k|10k|hm|half|marathon)[- ]pace\b/.test(l)
  })
}

interface Case { label: string, input: GeneratorInput }

const CASES: Case[] = [
  {
    label: 'Founder 10K — 4d, 30km, 49:00 bench, 45:00 target, ready',
    input: {
      age: 44, goal: 'time_target', max_hr: 185, terrain: 'road',
      benchmark: { time: '0:49:00', type: 'race', distance_km: 10 },
      race_date: raceDate(14), resting_hr: 52, target_time: '0:45:00',
      training_age: '2-5yr', max_hr_source: 'observed', days_available: 4,
      max_weekday_mins: 60, race_distance_km: 10, current_weekly_km: 30,
      days_cannot_train: ['monday', 'wednesday', 'thursday'],
      user_declared_level: 'experienced', longest_recent_run_km: 10,
      preferred_long_run_day: 'sun', recent_quality_training: 'regular',
      hard_session_relationship: 'love',
    } as unknown as GeneratorInput,
  },
  {
    label: '10K — 5 days, ready',
    input: {
      age: 40, goal: 'time_target', max_hr: 190,
      benchmark: { time: '0:45:00', type: 'race', distance_km: 10 },
      race_date: raceDate(13), resting_hr: 50, target_time: '0:42:00',
      training_age: '5yr+', days_available: 5, race_distance_km: 10,
      current_weekly_km: 45, longest_recent_run_km: 16,
      preferred_long_run_day: 'sun', user_declared_level: 'experienced',
      recent_quality_training: 'regular',
    } as unknown as GeneratorInput,
  },
  {
    label: 'HM — 4 days, ready',
    input: {
      age: 38, goal: 'time_target', max_hr: 188,
      benchmark: { time: '1:45:00', type: 'race', distance_km: 21.1 },
      race_date: raceDate(15), resting_hr: 50, target_time: '1:38:00',
      training_age: '2-5yr', days_available: 4, race_distance_km: 21.1,
      current_weekly_km: 40, longest_recent_run_km: 16,
      preferred_long_run_day: 'sun', user_declared_level: 'experienced',
      recent_quality_training: 'regular',
    } as unknown as GeneratorInput,
  },
  {
    label: '10K — NOT ready (control, full 35% base)',
    input: {
      age: 44, goal: 'time_target', max_hr: 185,
      benchmark: { time: '0:55:00', type: 'race', distance_km: 10 },
      race_date: raceDate(14), resting_hr: 58, target_time: '0:52:00',
      training_age: '6-18mo', days_available: 4, race_distance_km: 10,
      current_weekly_km: 25, longest_recent_run_km: 9,
      preferred_long_run_day: 'sun', user_declared_level: 'intermediate',
      recent_quality_training: 'occasional',
    } as unknown as GeneratorInput,
  },
]

console.log('='.repeat(80))
console.log('PHASE SHAPE — deload placement within phase, and peak-phase specificity')
console.log('='.repeat(80))

for (const c of CASES) {
  let plan: Plan
  try { plan = generateRulePlan(c.input, 'paid') } catch (e) {
    console.log(`\n${c.label}\n  generation failed: ${(e as Error).message.slice(0, 80)}`)
    continue
  }
  console.log(`\n${c.label}`)
  console.log(`  early_quality_onset: ${Boolean((plan.meta as { early_quality_onset?: boolean }).early_quality_onset)}`)

  // Phase boundaries as delivered.
  const phaseOf = plan.weeks.map(w => w.phase)
  const firstWeekOfPhase = new Map<string, number>()
  plan.weeks.forEach((w, i) => { const ph = w.phase ?? 'base'; if (!firstWeekOfPhase.has(ph)) firstWeekOfPhase.set(ph, i) })

  // (A) deload position within its phase
  const problems: string[] = []
  plan.weeks.forEach((w, i) => {
    if (!isDeload(w)) return
    const start = firstWeekOfPhase.get(w.phase ?? 'base')!
    const posInPhase = i - start + 1
    if (posInPhase <= 2) {
      problems.push(`W${w.n} (${w.phase ?? 'base'}) is a deload at position ${posInPhase} of its phase`)
    }
  })
  console.log(`  (A) deload placement: ${problems.length ? problems.join('; ') : 'ok — no deload in the first two weeks of a phase'}`)

  // (B) peak-phase race-pace specificity
  const peakWeeks = plan.weeks.filter(w => w.phase === 'peak' && !isDeload(w))
  const peakRP = peakWeeks.filter(hasRacePace).length
  const buildWeeks = plan.weeks.filter(w => w.phase === 'build' && !isDeload(w))
  const buildRP = buildWeeks.filter(hasRacePace).length
  const taperWeeks = plan.weeks.filter(w => w.phase === 'taper')
  const taperRP = taperWeeks.filter(hasRacePace).length
  console.log(`  (B) race-pace weeks:  build ${buildRP}/${buildWeeks.length}   ` +
    `PEAK ${peakRP}/${peakWeeks.length}   taper ${taperRP}/${taperWeeks.length}` +
    `${peakRP === 0 && c.input.goal === 'time_target' ? '   <-- peak has NONE' : ''}`)

  // Quality session inventory, in order.
  const q = plan.weeks.flatMap(w =>
    Object.values(w.sessions).filter(isQuality).map(s => `W${w.n}:${(w.phase ?? '??').slice(0, 2)}:${s.label}`))
  console.log(`  quality: ${q.join('  |  ') || '(none)'}`)
  void phaseOf
}
console.log()
