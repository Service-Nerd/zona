// R2/H-04 — invariant coverage meta-check.
//
// Verifies that:
//   1. Every code in INVARIANT_CODES appears as a `code:` literal in
//      lib/plan/invariants.ts (defined → declared).
//   2. Every code referenced inside validatePlan appears in INVARIANT_CODES
//      (declared → registered).
//   3. The three canonical review-packet plans pass validatePlan with zero
//      violations under the current engine (regression guard).
//
// Run: NODE_ENV=test npx tsx scripts/r2-coverage-check.ts
//
// Exits 1 if any check fails.

import fs from 'node:fs'
import path from 'node:path'
import { generateRulePlan, type Tier } from '../lib/plan/ruleEngine'
import { validatePlan, INVARIANT_CODES, formatViolations } from '../lib/plan/invariants'
import type { GeneratorInput } from '../types/plan'

const PLAN_START = '2026-04-27'

interface Case {
  id: string
  tier: Tier
  input: Omit<GeneratorInput, 'plan_start'> & { plan_start: string }
}

const cases: Case[] = [
  {
    id: '01-5k-beginner',
    tier: 'free',
    input: {
      race_date: '2026-07-20',
      race_distance_km: 5,
      race_name: 'Local 5K',
      goal: 'finish',
      age: 30,
      current_weekly_km: 18,
      longest_recent_run_km: 8,
      days_available: 3,
      days_cannot_train: ['mon', 'tue', 'thu', 'sat'],
      preferred_long_run_day: 'sun',
      max_weekday_mins: 60,
      max_hr: 190,
      resting_hr: 60,
      training_age: '2-5yr',
      primary_metric: 'distance',
      plan_start: PLAN_START,
    } as any,
  },
  {
    id: '02-10k-intermediate',
    tier: 'paid',
    input: {
      race_date: '2026-07-20',
      race_distance_km: 10,
      race_name: 'Local 10K',
      goal: 'time_target',
      target_time: '0:50:00',
      age: 38,
      current_weekly_km: 30,
      longest_recent_run_km: 12,
      days_available: 4,
      days_cannot_train: ['tue', 'thu', 'sat'],
      preferred_long_run_day: 'sun',
      max_weekday_mins: 60,
      max_hr: 185,
      resting_hr: 55,
      training_age: '2-5yr',
      hard_session_relationship: 'love',
      injury_history: ['knee'],
      terrain: 'road',
      primary_metric: 'distance',
      benchmark: { type: 'race', distance_km: 5, time: '0:23:30', benchmark_date: '2026-03-15' },
      plan_start: PLAN_START,
    } as any,
  },
  {
    id: '03-hm-intermediate',
    tier: 'paid',
    input: {
      race_date: '2026-08-03',
      race_distance_km: 21.1,
      race_name: 'Target HM',
      goal: 'time_target',
      target_time: '1:55:00',
      age: 42,
      current_weekly_km: 40,
      longest_recent_run_km: 18,
      days_available: 4,
      days_cannot_train: ['mon', 'wed', 'fri'],
      preferred_long_run_day: 'sun',
      max_weekday_mins: 75,
      max_hr: 180,
      resting_hr: 50,
      training_age: '5-10yr',
      hard_session_relationship: 'love',
      injury_history: [],
      terrain: 'trail',
      primary_metric: 'distance',
      benchmark: { type: 'race', distance_km: 10, time: '0:50:30', benchmark_date: '2026-03-08' },
      plan_start: PLAN_START,
    } as any,
  },
]

function checkRegistryVsSource(): string[] {
  const errors: string[] = []
  const sourcePath = path.join(__dirname, '..', 'lib', 'plan', 'invariants.ts')
  const source = fs.readFileSync(sourcePath, 'utf8')
  const sourceCodes = new Set<string>()
  const literalRegex = /code:\s*'(INV-[A-Z0-9-]+)'/g
  let m: RegExpExecArray | null
  while ((m = literalRegex.exec(source)) !== null) sourceCodes.add(m[1])

  const registry = new Set(INVARIANT_CODES)
  for (const code of sourceCodes) {
    if (!registry.has(code as typeof INVARIANT_CODES[number])) {
      errors.push(`source code ${code} is not in INVARIANT_CODES`)
    }
  }
  for (const code of registry) {
    if (!sourceCodes.has(code)) {
      errors.push(`INVARIANT_CODES contains ${code} but no validatePlan branch emits it`)
    }
  }
  return errors
}

function checkCanonicalCases(): string[] {
  const errors: string[] = []
  for (const c of cases) {
    const plan = generateRulePlan(c.input as GeneratorInput, c.tier)
    const violations = validatePlan(plan, c.input as GeneratorInput)
    const errs = violations.filter(v => v.severity === 'error')
    if (errs.length > 0) {
      errors.push(`Case ${c.id} violates ${errs.length} invariants:\n${formatViolations(errs)}`)
    }
  }
  return errors
}

const regErrors = checkRegistryVsSource()
const caseErrors = checkCanonicalCases()
const allErrors = [...regErrors, ...caseErrors]

if (allErrors.length === 0) {
  console.log(`✓ All ${INVARIANT_CODES.length} invariants registered, declared, and pass on the three canonical cases.`)
  process.exit(0)
} else {
  console.error('✗ Coverage check failed:\n')
  for (const e of allErrors) console.error(`  - ${e}`)
  process.exit(1)
}
