// RAMP-PRODUCER-01 — measure the proposed fix BEFORE proposing it.
//
//   npx tsx scripts/measure-ramp-producer.ts           # measure this tree
//   npx tsx scripts/measure-ramp-producer.ts --json    # machine-readable
//
// THE QUESTION. `V1-volume-quality-split` holds a week flat when the first
// VO2max lands (Willy's gate on CD-16, correct). The NEXT week then steps up
// from the volume CURVE rather than from the TRIMMED value, so the trim hands
// its whole deficit forward. §94 detects it; the producer is unchanged.
//
// WHY THIS SCRIPT EXISTS RATHER THAN A PATCH. The obvious remedy — re-anchor
// week N+1 to the trimmed value — lowers delivered PEAK volume, which §79/§89
// explicitly protect as structure's to set. The board's own precedent binds
// here: on 2026-09-06 a healthy bounceback cap was built, measured (+50pp of
// plans flipped to "constrained by inputs", +7.6pp maintenance, ZERO safety
// benefit) and REJECTED. The backlog says "same treatment or it does not ship".
//
// So this reports BOTH sides of that trade on one grid:
//   BENEFIT — share of plans breaching §94, and the worst delivered rise.
//   COST    — delivered peak week, and how many plans lose peak volume.
//
// Run it on the baseline, patch the engine, run it again, and hand the board
// two numbers rather than an argument.

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan } from '../lib/plan/invariants'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import type { Week } from '../types/plan'

const PLAN_START = '2026-04-27'
const SEED = 20260911

function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]

// V1 only fires where the catalogue produces a vo2max session, i.e. races
// <= 21km (see the V2 note in ruleEngine). Marathon+ is a no-op for this
// mechanism, so the grid concentrates where the effect actually lives.
const DISTANCES = [5, 10, 21.1] as const
const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
// The engine takes availability as `days_available` + `days_cannot_train`,
// NOT `days_per_week`. Passing the latter alone produced a one-session week
// (a 9 km Sunday run for a 30 km/week runner) and every plan failed
// INV-PLAN-QUALITY-EXPECTED — a grid that generates degenerate plans reports
// a confident 0% for the thing it is supposed to be measuring.
const DAY_SETS = [
  { days_available: 3, days_cannot_train: ['tue', 'thu'] },
  { days_available: 4, days_cannot_train: [] },
  { days_available: 5, days_cannot_train: ['tue'] },
  { days_available: 6, days_cannot_train: [] },
] as const
const VOLUMES = [15, 20, 25, 30, 40, 50] as const
const QUALITY = ['none', 'occasionally', 'regular'] as const
const WEEKS_OUT = [10, 12, 14, 16, 20] as const

function buildInput() {
  const km = pick(DISTANCES)
  const weeks = pick(WEEKS_OUT)
  const raceDate = new Date(new Date(`${PLAN_START}T00:00:00Z`).getTime() + weeks * 7 * 86_400_000)
    .toISOString().slice(0, 10)
  const cwk = pick(VOLUMES)
  // Shape mirrors the property sweep's `baseInput` + `randomInput`. The required
  // physiological fields are not optional: omitting `age` or
  // `longest_recent_run_km` makes generateRulePlan refuse EVERY input, and a
  // grid that generates nothing still prints a confident "0% breach".
  return {
    athlete_name: 'Athlete',
    age: 35,
    race_name: 'Test',
    primary_metric: 'distance' as const,
    plan_start: PLAN_START,
    race_distance_km: km,
    race_date: raceDate,
    target_time: km === 5 ? '0:25:00' : km === 10 ? '0:52:00' : '1:55:00',
    ...pick(DAY_SETS),
    current_weekly_km: cwk,
    longest_recent_run_km: Math.max(3, Math.round(cwk * 0.4)),
    fitness_level: pick(LEVELS),
    recent_quality_training: pick(QUALITY),
    hard_session_relationship: 'occasionally',
    injury_history: [] as string[],   // §94 is healthy-only; injury is §90's
    max_weekday_mins: 60,
  } as any
}

const N = 900
const deliveredKm = (w: Week) =>
  Object.values(w.sessions).reduce((a: number, s: any) => a + (s?.distance_km ?? 0), 0)

let generated = 0, refused = 0, failed = 0
// The board's OWN rejection metrics from 2026-09-06, when a healthy bounceback
// cap flipped +50pp of plans to "constrained by inputs" and +7.6pp to
// maintenance. Any fix in this area is judged on the same two numbers.
let constrainedByInputs = 0, maintenanceProfile = 0, volumeConstrained = 0
let plansWithBreach = 0
let worstRisePct = 0
const peaks: number[] = []
const breachRises: number[] = []
let v1Fired = 0

for (let i = 0; i < N; i++) {
  const input = buildInput()
  let plan
  try {
    plan = generateRulePlan(input, 'trial', PLAN_START, undefined, PLAN_START)
    // ADR-020 — compose is the single owner of plan.weeks post-generation, so
    // measuring the raw engine output would measure a plan no runner receives.
    plan = composePlanWithFoundation(plan, input, PLAN_START, 'add').plan
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/need|too short|minimum|at least|cannot/i.test(msg)) { refused++; continue }
    failed++; if (failed <= 3) console.error('SAMPLE FAILURE:', msg.split('\n')[0], JSON.stringify(input)); continue
  }
  generated++

  if ((plan.meta?.rule_adjustments ?? []).some((a: any) => a.rule === 'V1-volume-quality-split')) v1Fired++
  const meta: any = plan.meta ?? {}
  if (meta.compression_classification === 'constrained_by_inputs') constrainedByInputs++
  if (meta.volume_profile === 'maintenance') maintenanceProfile++
  if (meta.volume_constrained) volumeConstrained++

  const violations = validatePlan(plan, input as any)
  const ramp = violations.filter(v => v.code === 'INV-PLAN-DELIVERED-RAMP')
  if (ramp.length) {
    plansWithBreach++
    for (const v of ramp) {
      const m = /rose (\d+)%/.exec(v.message)
      if (m) {
        const pct = Number(m[1])
        breachRises.push(pct)
        if (pct > worstRisePct) worstRisePct = pct
      }
    }
  }

  const realWeeks = plan.weeks.filter((w: Week) => w.n >= 1 && w.phase !== 'taper')
  if (realWeeks.length) peaks.push(Math.max(...realWeeks.map(deliveredKm)))
}

const mean = (a: number[]) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0
const result = {
  seed: SEED,
  generated, refused, failed,
  v1FiredPct: +(v1Fired / Math.max(1, generated) * 100).toFixed(1),
  // BENEFIT
  breachPct: +(plansWithBreach / Math.max(1, generated) * 100).toFixed(1),
  worstRisePct,
  meanBreachRisePct: +mean(breachRises).toFixed(1),
  // COST — what §79/§89 protect
  meanPeakKm: +mean(peaks).toFixed(2),
  maxPeakKm: peaks.length ? Math.max(...peaks) : 0,
  constrainedPct: +(constrainedByInputs / Math.max(1, generated) * 100).toFixed(1),
  maintenancePct: +(maintenanceProfile / Math.max(1, generated) * 100).toFixed(1),
  volumeConstrainedPct: +(volumeConstrained / Math.max(1, generated) * 100).toFixed(1),
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2))
} else {
  console.log(`\nRAMP-PRODUCER-01 — measured on ${generated} plans (seed ${SEED})`)
  console.log(`  refused ${refused}, hard failures ${failed}`)
  console.log(`\n  V1-volume-quality-split fired in   ${result.v1FiredPct}% of plans`)
  console.log(`\n  BENEFIT SIDE`)
  console.log(`    plans breaching §94              ${result.breachPct}%`)
  console.log(`    worst delivered week rise        ${result.worstRisePct}%`)
  console.log(`    mean rise, among breaches        ${result.meanBreachRisePct}%`)
  console.log(`\n  COST SIDE (what §79/§89 protect)`)
  console.log(`    mean delivered PEAK week         ${result.meanPeakKm} km`)
  console.log(`    max delivered PEAK week          ${result.maxPeakKm} km`)
  console.log(`    constrained by inputs            ${result.constrainedPct}%`)
  console.log(`    maintenance profile              ${result.maintenancePct}%`)
  console.log(`    volume_constrained               ${result.volumeConstrainedPct}%\n`)
}
