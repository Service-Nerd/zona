// R23 rebuild — Phase 2 validation script
//
// Generates plans across the user matrix and prints summary stats. Behaviour
// should match pre-rebuild *except* for the four divergences approved in Phase 0:
//   - Zone bands shift (easy ceiling 60% → 70% HRR)
//   - Phase distribution 35/35/15 + taper from TAPER_BY_DISTANCE
//   - Taper duration 10/14/21/28 days (marathon 2→3 weeks etc.)
//   - Recovery week 75% → 70% of pre-deload
//
// Run with:  npx tsx scripts/r23-phase2-validation.ts

import { generateRulePlan, type Tier } from '../lib/plan/ruleEngine'
import type { GeneratorInput } from '../types/plan'

interface TestCase {
  name: string
  input: GeneratorInput
  tier: Tier
}

// Plan-start anchor so output is deterministic. Race dates picked to match
// the ideal plan length per distance (so totalWeeks = idealWeeks).
const cases: TestCase[] = [
  {
    name: '5K beginner — 10 weeks, 3 days/wk',
    tier: 'free',
    input: {
      race_date:             '2026-07-06',  // ~10 weeks from 2026-04-27
      race_distance_km:      5,
      goal:                  'finish',
      current_weekly_km:     20,
      longest_recent_run_km: 5,
      days_available:        3,
      age:                   30,
      fitness_level:         'beginner',
    },
  },
  {
    name: '10K intermediate — 12 weeks, 4 days/wk',
    tier: 'paid',
    input: {
      race_date:             '2026-07-20',
      race_distance_km:      10,
      goal:                  'time_target',
      target_time:           '50:00',
      current_weekly_km:     30,
      longest_recent_run_km: 10,
      days_available:        4,
      age:                   35,
      fitness_level:         'intermediate',
      resting_hr:            55,
      max_hr:                185,
    },
  },
  {
    name: 'HM intermediate — 14 weeks, 4 days/wk',
    tier: 'paid',
    input: {
      race_date:             '2026-08-03',
      race_distance_km:      21.1,
      goal:                  'time_target',
      target_time:           '1:55:00',
      current_weekly_km:     35,
      longest_recent_run_km: 14,
      days_available:        4,
      age:                   38,
      fitness_level:         'intermediate',
      resting_hr:            52,
      max_hr:                182,
    },
  },
  {
    name: 'Marathon experienced — 16 weeks, 5 days/wk',
    tier: 'paid',
    input: {
      race_date:             '2026-08-17',
      race_distance_km:      42.2,
      goal:                  'time_target',
      target_time:           '3:15:00',
      current_weekly_km:     55,
      longest_recent_run_km: 24,
      days_available:        5,
      age:                   40,
      fitness_level:         'experienced',
      resting_hr:            48,
      max_hr:                180,
      benchmark:             { type: 'race', distance_km: 21.1, time: '1:25:00' },
    },
  },
  {
    name: 'Marathon beginner — 18 weeks, 4 days/wk',
    tier: 'paid',
    input: {
      race_date:             '2026-08-31',
      race_distance_km:      42.2,
      goal:                  'finish',
      current_weekly_km:     25,
      longest_recent_run_km: 16,
      days_available:        4,
      age:                   42,
      fitness_level:         'beginner',
      resting_hr:            58,
    },
  },
  {
    name: '50K intermediate — 18 weeks, 5 days/wk',
    tier: 'paid',
    input: {
      race_date:             '2026-08-31',
      race_distance_km:      50,
      goal:                  'finish',
      current_weekly_km:     50,
      longest_recent_run_km: 30,
      days_available:        5,
      age:                   45,
      fitness_level:         'intermediate',
      resting_hr:            50,
    },
  },
  {
    name: '100K experienced — 22 weeks, 5 days/wk',
    tier: 'paid',
    input: {
      race_date:             '2026-09-28',
      race_distance_km:      100,
      goal:                  'finish',
      current_weekly_km:     70,
      longest_recent_run_km: 45,
      days_available:        5,
      age:                   38,
      fitness_level:         'experienced',
      resting_hr:            45,
      max_hr:                182,
    },
  },
  // ─── Phase 3 cases ─────────────────────────────────────────────────────────
  {
    name: '[3.4] Masters marathon — age 50, expect 3:1 recovery cadence',
    tier: 'paid',
    input: {
      race_date:             '2026-08-17',
      race_distance_km:      42.2,
      goal:                  'finish',
      current_weekly_km:     45,
      longest_recent_run_km: 22,
      days_available:        4,
      age:                   50,
      fitness_level:         'intermediate',
      resting_hr:            55,
      max_hr:                175,
    },
  },
  {
    name: '[3.3] Returning runner — 5yr+ training_age, low volume, expect 15% allowance for 3 weeks',
    tier: 'paid',
    input: {
      race_date:             '2026-08-03',
      race_distance_km:      21.1,
      goal:                  'finish',
      current_weekly_km:     15,    // well below typical for experienced HM (52 km × 0.5 = 26)
      longest_recent_run_km: 12,
      days_available:        4,
      age:                   38,
      fitness_level:         'experienced',
      training_age:          '5yr+',
      resting_hr:            48,
      max_hr:                182,
    },
  },
  {
    name: '[3.5] Stale benchmark — VDOT discount 8% (3% + 5% stale)',
    tier: 'paid',
    input: {
      race_date:             '2026-08-03',
      race_distance_km:      21.1,
      goal:                  'time_target',
      target_time:           '1:55:00',
      current_weekly_km:     35,
      longest_recent_run_km: 14,
      days_available:        4,
      age:                   38,
      fitness_level:         'intermediate',
      resting_hr:            52,
      max_hr:                182,
      benchmark:             { type: 'race', distance_km: 10, time: '45:00', benchmark_date: '2025-09-01' }, // ~8 mo old
    },
  },
  {
    name: '[3.5] Fresh benchmark — VDOT discount 3% only',
    tier: 'paid',
    input: {
      race_date:             '2026-08-03',
      race_distance_km:      21.1,
      goal:                  'time_target',
      target_time:           '1:55:00',
      current_weekly_km:     35,
      longest_recent_run_km: 14,
      days_available:        4,
      age:                   38,
      fitness_level:         'intermediate',
      resting_hr:            52,
      max_hr:                182,
      benchmark:             { type: 'race', distance_km: 10, time: '45:00', benchmark_date: '2026-04-01' }, // ~1 mo old
    },
  },
]

function fmt(n: number) { return String(n).padStart(3, ' ') }

for (const tc of cases) {
  console.log(`\n${'═'.repeat(70)}\n${tc.name}\n${'═'.repeat(70)}`)
  const plan = generateRulePlan(tc.input, tc.tier, '2026-04-27')

  // Phase summary
  console.log('\nPhases:')
  for (const p of plan.phases ?? []) {
    const len = p.end_week - p.start_week + 1
    console.log(`  ${p.name.padEnd(6)} weeks ${fmt(p.start_week)}–${fmt(p.end_week)}  (${len} weeks)`)
  }

  // Zone targets (look at first easy session for HR strings)
  console.log('\nZone targets (sample):')
  console.log(`  zone2_ceiling: ${plan.meta.zone2_ceiling}`)
  console.log(`  max_hr:        ${plan.meta.max_hr}`)
  console.log(`  resting_hr:    ${plan.meta.resting_hr}`)
  for (const w of plan.weeks) {
    const easy = Object.values(w.sessions).find(s => s?.type === 'easy' && !s.label?.toLowerCase().includes('long'))
    const quality = Object.values(w.sessions).find(s => s?.type === 'quality')
    if (easy) {
      console.log(`  easy hr_target:    ${easy.hr_target}`)
      break
    }
  }
  for (const w of plan.weeks) {
    const quality = Object.values(w.sessions).find(s => s?.type === 'quality')
    if (quality) {
      console.log(`  quality hr_target: ${quality.hr_target}`)
      break
    }
  }

  // Volume profile
  console.log('\nWeekly volume (km):')
  const weekly = plan.weeks.map(w => w.weekly_km)
  const lines: string[] = []
  let line = '  '
  for (let i = 0; i < weekly.length; i++) {
    const tag = plan.weeks[i].badge === 'deload' ? 'D' : plan.weeks[i].phase === 'taper' ? 'T' : ' '
    line += `${tag}${fmt(weekly[i])} `
    if ((i + 1) % 8 === 0) { lines.push(line); line = '  ' }
  }
  if (line.trim()) lines.push(line)
  for (const l of lines) console.log(l)
  console.log(`  legend: D = deload, T = taper`)

  // Long-run %s by phase (first non-race week of each phase)
  console.log('\nLong run as % of weekly volume (first non-race week of each phase):')
  for (const p of plan.phases ?? []) {
    const w = plan.weeks.find(w => w.phase === p.name && w.type !== 'race')
    if (!w) continue
    const longSession = Object.values(w.sessions).find(s => s?.label?.toLowerCase().includes('long'))
    if (!longSession) continue
    const longKm = longSession.distance_km ?? (longSession.duration_mins ? longSession.duration_mins / 6 : 0)
    const pct = w.weekly_km > 0 ? Math.round(longKm / w.weekly_km * 100) : 0
    console.log(`  ${p.name.padEnd(6)} week ${w.n}: long ${longKm.toFixed(1)} km / weekly ${w.weekly_km} km = ${pct}%`)
  }

  // Quality session count per week (focus on taper)
  console.log('\nQuality sessions per week (taper only):')
  for (const w of plan.weeks) {
    if (w.phase !== 'taper') continue
    const qcount = Object.values(w.sessions).filter(s => s?.type === 'quality').length
    console.log(`  week ${fmt(w.n)} (${w.type}): ${qcount} quality session(s)`)
  }

  // Session labels — first quality and long run from build, peak, taper (catalogue verification)
  console.log('\nSession labels (sample):')
  for (const ph of ['build', 'peak', 'taper'] as const) {
    const w = plan.weeks.find(w => w.phase === ph && w.type !== 'race')
    if (!w) continue
    const long = Object.values(w.sessions).find(s => s?.label?.toLowerCase().includes('long') || s?.label?.toLowerCase().includes('marathon-pace'))
    const qual = Object.values(w.sessions).find(s => s?.type === 'quality')
    console.log(`  ${ph.padEnd(6)} W${fmt(w.n)}: long="${long?.label ?? '—'}"`)
    console.log(`           quality="${qual?.label ?? '—'}"   notes=${qual?.coach_notes ? JSON.stringify(qual.coach_notes) : '—'}`)
  }

  // Sanity check: total weeks + Phase 3 meta fields
  console.log(`\nTotal weeks: ${plan.weeks.length}`)
  console.log('Phase 3 meta:')
  console.log(`  compressed:                        ${plan.meta.compressed ?? false}`)
  console.log(`  vdot:                              ${plan.meta.vdot ?? '—'}`)
  console.log(`  vdot_discount_applied_pct:         ${plan.meta.vdot_discount_applied_pct ?? '—'}`)
  console.log(`  training_age:                      ${plan.meta.training_age ?? '—'}`)
  console.log(`  returning_runner_allowance_active: ${plan.meta.returning_runner_allowance_active ?? false}`)

  // Recovery cadence check — list weeks where weekly volume drops below previous (deload markers)
  const deloadWeeks = plan.weeks.filter(w => w.badge === 'deload').map(w => w.n)
  console.log(`  deload weeks:                      [${deloadWeeks.join(', ')}]`)
}

console.log(`\n${'═'.repeat(70)}\nDone.\n`)
