// Validates the days-availability gate. Confirms block / warn / ok per
// distance × days × goal combination.
//
// Run: npx tsx scripts/days-availability-gate.ts

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { DaysAvailableError } from '../lib/plan/inputs'
import type { GeneratorInput } from '../types/plan'

interface Case {
  name: string
  input: GeneratorInput & { acknowledged_days_warning?: boolean; acknowledged_prep_warning?: boolean }
  expect: 'block' | 'warn-unack' | 'ok-warned-maintenance' | 'ok-build'
}

const baseInput = {
  athlete_name: 'Test', age: 35,
  current_weekly_km: 30, longest_recent_run_km: 12,
  fitness_level: 'intermediate' as const,
  resting_hr: 55, max_hr: 185,
  injury_history: [],
  acknowledged_prep_warning: true,
}

const cases: Case[] = [
  // ── Marathon: block at 2, warn at 3 (time), ok at 4+ ──
  { name: 'Marathon × 2 days time-target → BLOCK',
    input: { ...baseInput, race_distance_km: 42.2, race_date: '2026-09-12', goal: 'time_target', target_time: '3:30:00', days_available: 2 },
    expect: 'block' },
  { name: 'Marathon × 3 days time-target → WARN-UNACK',
    input: { ...baseInput, race_distance_km: 42.2, race_date: '2026-09-12', goal: 'time_target', target_time: '3:30:00', days_available: 3 },
    expect: 'warn-unack' },
  { name: 'Marathon × 3 days time-target ACK → maintenance',
    input: { ...baseInput, race_distance_km: 42.2, race_date: '2026-09-12', goal: 'time_target', target_time: '3:30:00', days_available: 3, acknowledged_days_warning: true },
    expect: 'ok-warned-maintenance' },
  { name: 'Marathon × 3 days finish → ok (warn treated as ok for finish)',
    input: { ...baseInput, race_distance_km: 42.2, race_date: '2026-09-12', goal: 'finish', days_available: 3 },
    expect: 'ok-build' },
  { name: 'Marathon × 4 days time-target → ok',
    input: { ...baseInput, race_distance_km: 42.2, race_date: '2026-09-12', goal: 'time_target', target_time: '3:30:00', days_available: 4 },
    expect: 'ok-build' },

  // ── 50K + 100K: same thresholds ──
  { name: '50K × 2 days finish → BLOCK',
    input: { ...baseInput, race_distance_km: 50, race_date: '2026-10-15', goal: 'finish', days_available: 2 },
    expect: 'block' },
  { name: '100K × 3 days finish → ok (warn-treated-as-ok for finish)',
    input: { ...baseInput, race_distance_km: 100, race_date: '2026-11-15', goal: 'finish', days_available: 3, current_weekly_km: 50, longest_recent_run_km: 30 },
    expect: 'ok-build' },
  { name: '100K × 3 days time-target ACK → maintenance',
    input: { ...baseInput, race_distance_km: 100, race_date: '2026-11-15', goal: 'time_target', target_time: '12:00:00', days_available: 3, current_weekly_km: 50, longest_recent_run_km: 30, acknowledged_days_warning: true },
    expect: 'ok-warned-maintenance' },

  // ── HM: block at 2, warn at 2 time-target, ok at 3+ ──
  { name: 'HM × 1 day → BLOCK',
    input: { ...baseInput, race_distance_km: 21.1, race_date: '2026-08-23', goal: 'time_target', target_time: '1:55:00', days_available: 1 },
    expect: 'block' },
  { name: 'HM × 2 days time-target → WARN-UNACK',
    input: { ...baseInput, race_distance_km: 21.1, race_date: '2026-08-23', goal: 'time_target', target_time: '1:55:00', days_available: 2 },
    expect: 'warn-unack' },
  { name: 'HM × 2 days finish → ok',
    input: { ...baseInput, race_distance_km: 21.1, race_date: '2026-08-23', goal: 'finish', days_available: 2 },
    expect: 'ok-build' },
  { name: 'HM × 3 days time-target → ok',
    input: { ...baseInput, race_distance_km: 21.1, race_date: '2026-08-23', goal: 'time_target', target_time: '1:55:00', days_available: 3 },
    expect: 'ok-build' },

  // ── 5K / 10K: 2 days OK for everything ──
  { name: '5K × 2 days time-target → ok',
    input: { ...baseInput, race_distance_km: 5, race_date: '2026-07-20', goal: 'time_target', target_time: '24:00', days_available: 2 },
    expect: 'ok-build' },
  { name: '10K × 2 days finish → ok',
    input: { ...baseInput, race_distance_km: 10, race_date: '2026-07-26', goal: 'finish', days_available: 2 },
    expect: 'ok-build' },
]

let pass = 0, fail = 0
for (const tc of cases) {
  try {
    const plan = generateRulePlan(tc.input, 'free', '2026-05-12')
    if (tc.expect === 'block') {
      console.log(`✗ ${tc.name} — expected BLOCK but plan generated`)
      fail++
      continue
    }
    if (tc.expect === 'warn-unack') {
      console.log(`✗ ${tc.name} — expected WARN-UNACK but plan generated`)
      fail++
      continue
    }
    const isMaintenance = plan.meta.volume_profile === 'maintenance'
    const daysWarned = plan.meta.days_available_status === 'warned'
    if (tc.expect === 'ok-warned-maintenance') {
      if (!daysWarned) {
        console.log(`✗ ${tc.name} — expected days_available_status='warned', got '${plan.meta.days_available_status}'`)
        fail++
      } else if (!isMaintenance) {
        console.log(`✗ ${tc.name} — expected volume_profile='maintenance', got '${plan.meta.volume_profile}'`)
        fail++
      } else {
        console.log(`✓ ${tc.name} — days_available_status=warned, volume_profile=maintenance`)
        pass++
      }
      continue
    }
    if (tc.expect === 'ok-build') {
      if (daysWarned) {
        console.log(`✗ ${tc.name} — expected days status ok, got warned`)
        fail++
      } else {
        console.log(`✓ ${tc.name} — generated cleanly (volume_profile=${plan.meta.volume_profile ?? 'build'})`)
        pass++
      }
    }
  } catch (err) {
    if (err instanceof DaysAvailableError) {
      if (tc.expect === 'block' && err.reason === 'block') {
        console.log(`✓ ${tc.name} — blocked: "${err.days.message}"`)
        pass++
      } else if (tc.expect === 'warn-unack' && err.reason === 'warn_unacknowledged') {
        console.log(`✓ ${tc.name} — warn-unack: "${err.days.message}"`)
        pass++
      } else {
        console.log(`✗ ${tc.name} — got DaysAvailableError(${err.reason}), expected ${tc.expect}`)
        fail++
      }
    } else {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`✗ ${tc.name} — unexpected error: ${msg}`)
      fail++
    }
  }
}

console.log(`\n${pass}/${pass+fail} passing`)
process.exit(fail > 0 ? 1 : 0)
