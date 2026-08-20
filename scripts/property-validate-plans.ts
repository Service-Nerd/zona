// Property-based sweep: generate plans across a wide grid of inputs and run
// validatePlan on each. Catches edge cases hand-written tests miss.
// Replaces find-zero-easy.ts as a more general constitutional fuzzer.
//
// Run: NODE_ENV=production npx tsx scripts/property-validate-plans.ts
// Exit: 0 if all plans pass invariants; 1 if any violations.
// (NODE_ENV=production prevents the engine from throwing — we want to collect.)

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan, type Violation } from '../lib/plan/invariants'

// ⚠️ THE SWEEP MUST BE TIME-INDEPENDENT.
//
// It was not, and it silently validated NOTHING for months. `plan_start` sat in
// baseInput but was never passed as generateRulePlan's third argument, so the
// engine derived plan start from *today* while every race date below is a fixed
// 2026 literal. Once real time passed those dates every input failed prep-time
// validation and threw — and `catch { continue }` swallowed all of it. On
// 2026-08-20 the score was 37,324,800 attempted, 37,324,800 thrown, ZERO plans
// validated, while the script printed "✓ All plans pass invariant validation."
//
// Two rules follow, and breaking either makes this file lie again:
//   1. PLAN_START is passed EXPLICITLY to generateRulePlan. Never rely on today.
//   2. Race dates are derived FROM PLAN_START, never written as literals.
const PLAN_START = '2026-04-27'

function raceDate(weeksOut: number): string {
  const d = new Date(`${PLAN_START}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeksOut * 7)
  return d.toISOString().slice(0, 10)
}

const baseInput = {
  athlete_name: 'Athlete', age: 35,
  race_name: 'Test', target_time: '0:45:00',
  primary_metric: 'distance' as const,
  injury_history: [],
  plan_start: PLAN_START,
}

// Plan LENGTH is a swept dimension (added 2026-08-20). Previously each distance
// had exactly one race_date, so every 10K plan in the grid was the same ~13
// weeks — and the INV-PLAN-PEAK-IN-PEAK-PHASE violation found while verifying
// SC-01 needed a 12-week 10K. The sweep reported 1,244,160 clean plans with a
// reproducible violation sitting inside its own stated domain. Phase-week
// arithmetic, deload placement and taper length all move with plan length, so a
// single length per distance tests one shape and implies six.
//
// Two lengths per distance, both comfortably inside PREP_TIME_THRESHOLDS 'ok'
// (a 'warn' window refuses generation without acknowledged_prep_warning).
// 50K/100K added at the same time — the ultra distances were absent entirely.
const distancesAndDates: any[] = [
  { race_distance_km: 5,    race_date: raceDate(10) },
  { race_distance_km: 5,    race_date: raceDate(9) },
  { race_distance_km: 10,   race_date: raceDate(13) },
  { race_distance_km: 10,   race_date: raceDate(12) },
  { race_distance_km: 21.1, race_date: raceDate(15) },
  { race_distance_km: 21.1, race_date: raceDate(13) },
  { race_distance_km: 42.2, race_date: raceDate(18) },
  { race_distance_km: 42.2, race_date: raceDate(17) },
  { race_distance_km: 50,   race_date: raceDate(23) },
  { race_distance_km: 100,  race_date: raceDate(26) },
]
const cwks = [5, 12, 25, 40, 60]

// Longest recent run, expressed as a FRACTION of weekly volume rather than as
// an independent axis (2026-08-20).
//
// It used to be `[3, 8, 15, 22]` picked independently of `cwks`, which paired
// 5 km/week with a 22 km long run — a runner who has never existed. A single
// run cannot exceed the week that contains it, so a quarter of the grid was
// testing impossible people, and the violations they produced were then read as
// engine defects. That is how the deload-inversion finding got mis-filed: 9% on
// contradictory inputs, 0% on realistic ones.
//
// The band spans undertrained-but-real (the long run is a fifth of the week) to
// long-run-dominant (three quarters — a two- or three-day runner). Anything
// above 1.0 is arithmetically impossible; the top of the band is deliberately
// past §52's 60% lopsidedness cap so the sweep still exercises that guard.
const lrrFractions = [0.2, 0.35, 0.5, 0.75]
const dayOptions: any[] = [
  { days_available: 2, days_cannot_train: ['mon','tue','wed','thu','sat'] },
  { days_available: 3, days_cannot_train: ['mon','tue','thu','sat'] },
  { days_available: 3, days_cannot_train: ['tue','thu'] },
  { days_available: 4, days_cannot_train: ['tue','thu'] },
  { days_available: 5, days_cannot_train: ['tue'] },
  { days_available: 7, days_cannot_train: [] },
  // SC-01 coverage gap (2026-08-20): every 4- and 5-day row above BLOCKS days,
  // which narrows day placement and hides defects that only appear when the
  // scheduler has a free choice. The plainest real shape — "I can run four
  // days, no constraints" — was absent, so the sweep reported 414,720 clean
  // plans while a reproducible INV-PLAN-PEAK-IN-PEAK-PHASE violation sat in it.
  // A grid that only tests constrained weeks is not a property sweep.
  { days_available: 4, days_cannot_train: [] },
  { days_available: 5, days_cannot_train: [] },
  { days_available: 6, days_cannot_train: [] },
]
const fitnessSets = ['beginner', 'intermediate', 'experienced']
const hardSets = ['love', 'avoid', 'neutral']
const injurySets = [[], ['knee'], ['achilles'], ['shin_splints'], ['hip_flexor'], ['back']]
const maxWeekdays = [undefined, 45, 60, 90]

// GEN-FIX-08 — HR dimension. The sweep had no HR axis at all, which is why F1
// (a HealthKit-observed max HR 22% below the age estimate, producing a Zone 2
// ceiling 28 bpm low) was invisible to 103,680 generated plans. baseInput.age is
// 35, so Tanaka gives 208 - 0.7*35 = 184.
const TANAKA_AT_35 = 184
const hrSets: any[] = [
  { label: 'absent',        hr: {} },
  { label: 'tanaka',        hr: { resting_hr: 55, max_hr: TANAKA_AT_35 } },
  { label: 'observed-low',  hr: { resting_hr: 55, max_hr: Math.round(TANAKA_AT_35 * 0.7), max_hr_source: 'observed' } },
  { label: 'max-only',      hr: { max_hr: TANAKA_AT_35 } },
]

// SC-01 coverage gap (2026-08-20): `goal` was never set, so every one of the
// 414,720 plans ran the `finish` path. `time_target` is what switches on goal
// pace, the §22 race-specific rename, and the goal-vs-interval pace ladder —
// i.e. most of what the 2026-08-19 audit found defects in. The sweep's clean
// bill of health covered none of it.
const goalSets: any[] = [
  { label: 'finish',      goal: undefined },
  { label: 'time_target', goal: 'time_target' },
]

// Long-run DAY (added 2026-08-20). This is the geometry every day-placement
// defect lives in: SC-01's missing-Friday bug only appears when the long run
// and the first quality session sit such that one specific day is the unique
// solution (long Sunday + quality Wednesday -> only Friday satisfies both
// 48-hour gaps). With the day unset the scheduler picks its own default and
// that geometry is never exercised.
const longRunDays: any[] = [
  { preferred_long_run_day: undefined },
  { preferred_long_run_day: 'sun' },
  { preferred_long_run_day: 'sat' },
]

// BENCHMARK (added 2026-08-20). Without one, VDOT comes from a fallback and
// every derived pace — and therefore every session DISTANCE, and therefore the
// weekly volume arithmetic — differs from a benchmarked runner's. The entire
// §9/§23 volume interaction behind SC-01 is pace-driven, so an unbenchmarked
// grid cannot reach it.
const benchmarkSets: any[] = [
  { label: 'none',   benchmark: undefined },
  { label: 'race10k', benchmark: { type: 'race', distance_km: 10, time: '0:48:30' } },
]

// TIER (added 2026-08-20). The sweep only ever generated FREE plans, so the
// entire paid path — which is most of the product — was unswept. Catalogue
// eligibility filters on `is_free_tier`, and tier is threaded through
// generation, so a free-only grid tests one half of the engine.
const tiers: Array<'free' | 'paid'> = ['free', 'paid']


// ── Sampling ────────────────────────────────────────────────────────────────
//
// The grid above is a 37-million-point space. A full cartesian product over it
// is not runnable once plans actually GENERATE — it only ever appeared to run
// because every input was throwing instantly and being swallowed. At ~5 ms per
// plan, 37M is measured in days.
//
// So this is now what "property-based" actually means: a SEEDED RANDOM SAMPLE
// over the space, plus a set of corner cases that always run. The seed makes it
// reproducible; SWEEP_N tunes depth (raise it for a release gate, leave it for
// everyday use).
const SWEEP_N = Number(process.env.SWEEP_N ?? 20000)
const SEED = Number(process.env.SWEEP_SEED ?? 20260820)

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

// Corner cases that must ALWAYS run, whatever the sample draws. Each earned its
// place by being a profile that actually broke something.
const CORNERS: any[] = [
  {
    // The 2026-08-19 catalogue audit's Task B profile. Found the pace inversion
    // (SC-06) and the §23 volume interaction behind SC-01.
    label: 'audit-task-B-10k-4d-experienced',
    race_distance_km: 10, race_date: raceDate(12), goal: 'time_target',
    target_time: '0:44:59', days_available: 4, age: 43,
    current_weekly_km: 40, longest_recent_run_km: 18,
    resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
    injury_history: ['Left knee, posterior, recurring'],
    fitness_level: 'experienced', training_age: '2-5yr',
  },
  {
    // Same runner on five days — the shape CD-20 permits a second quality on.
    label: 'audit-task-B-5d',
    race_distance_km: 10, race_date: raceDate(12), goal: 'time_target',
    target_time: '0:44:59', days_available: 5, age: 43,
    current_weekly_km: 40, longest_recent_run_km: 18,
    resting_hr: 48, max_hr: 188, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 10, time: '0:48:30' },
    fitness_level: 'experienced', training_age: '2-5yr',
  },
  {
    // User A — the live 3-day beginner HM that surfaced the CD-19 numerator
    // question (24.4% against a 20% ceiling before the §78 exclusion).
    label: 'user-a-3d-hm-finish',
    race_distance_km: 21.1, race_date: raceDate(13), goal: 'finish',
    days_available: 3, age: 43, current_weekly_km: 20, longest_recent_run_km: 10,
    resting_hr: 55, max_hr: 185, preferred_long_run_day: 'sun',
  },
]

function randomInput(): any {
  const d = pick(distancesAndDates)
  const cwk = pick(cwks)
  const days = pick(dayOptions)
  const hrSet = pick(hrSets)
  const g = pick(goalSets)
  const lrd = pick(longRunDays)
  const bm = pick(benchmarkSets)
  return {
    ...baseInput, ...d,
    current_weekly_km: cwk,
    longest_recent_run_km: Math.max(3, Math.round(cwk * pick(lrrFractions))),
    ...days,
    fitness_level: pick(fitnessSets),
    hard_session_relationship: pick(hardSets),
    injury_history: pick(injurySets),
    max_weekday_mins: pick(maxWeekdays),
    ...hrSet.hr,
    ...(g.goal ? { goal: g.goal } : {}),
    ...(lrd.preferred_long_run_day ? { preferred_long_run_day: lrd.preferred_long_run_day } : {}),
    ...(bm.benchmark ? { benchmark: bm.benchmark } : {}),
  }
}

// A refusal is the engine working: §44 prep-time blocks and the days-per-week
// minimums are DESIGNED to throw. Anything else that throws is a real failure.
const REFUSAL = /is not enough preparation|days\/week is (not enough|below)/

let attempted = 0
let generated = 0
let refused = 0
let violatingPlans = 0
let hardFailures = 0
const violationsByCode = new Map<string, number>()

// SWEEP_EXPLAIN=<CODE> — dump the first few real examples of one violation code,
// with the input that produced them. Added while triaging the baseline: knowing
// a code fires 338 times is useless without knowing WHICH SHAPE fires it, and
// re-deriving a matching grid by hand is how the wrong mechanism gets blamed.
const EXPLAIN = process.env.SWEEP_EXPLAIN
const explained: string[] = []
const samples: { input: any, violation: Violation }[] = []
const hardFailureSamples: { input: any, message: string }[] = []

const inputs = [
  ...CORNERS,
  ...Array.from({ length: SWEEP_N }, () => randomInput()),
]

for (const input of inputs) {
  attempted++
  let plan
  try {
    // PLAN_START passed EXPLICITLY — see the note at the top of this file. This
    // argument is the difference between a sweep and a very fast no-op.
    plan = generateRulePlan(input, pick(tiers), PLAN_START)
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    if (REFUSAL.test(msg)) { refused++; continue }
    hardFailures++
    if (hardFailureSamples.length < 5) hardFailureSamples.push({ input, message: msg })
    continue
  }
  generated++
  const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
  if (errors.length > 0) {
    violatingPlans++
    if (EXPLAIN && explained.length < 5) {
      for (const v of errors.filter(e => e.code === EXPLAIN)) {
        explained.push(
          `  ${v.message}\n     input: ${JSON.stringify({
            race_distance_km: input.race_distance_km, goal: input.goal,
            days_available: input.days_available, current_weekly_km: input.current_weekly_km,
            longest_recent_run_km: input.longest_recent_run_km, fitness_level: input.fitness_level,
            max_weekday_mins: input.max_weekday_mins, injury_history: input.injury_history,
          })}\n     volume_profile: ${plan.meta?.volume_profile ?? '-'}`)
        break
      }
    }
    for (const v of errors) {
      violationsByCode.set(v.code, (violationsByCode.get(v.code) ?? 0) + 1)
      if (samples.length < 5) samples.push({ input, violation: v })
    }
  }
}

console.log(`Inputs attempted:  ${attempted}  (${CORNERS.length} corner + ${SWEEP_N} sampled, seed ${SEED})`)
console.log(`Plans GENERATED:   ${generated}`)
console.log(`Refused by design: ${refused}  (§44 prep-time / days-per-week minimums)`)
console.log(`Hard failures:     ${hardFailures}`)
console.log(`With violations:   ${violatingPlans}`)
console.log()

// The guard against the failure this script suffered for months: a sweep that
// generates almost nothing must FAIL, not congratulate itself. On 2026-08-20 it
// scored 0 generated out of 37,324,800 attempted and printed "all plans pass".
const MIN_GENERATED_PCT = 50
const generatedPct = (generated / attempted) * 100
if (generatedPct < MIN_GENERATED_PCT) {
  console.error(`✗ Only ${generatedPct.toFixed(1)}% of inputs produced a plan (floor ${MIN_GENERATED_PCT}%).`)
  console.error('  The grid is misconfigured — this sweep is not testing what it claims to test.')
  process.exit(1)
}

if (hardFailures > 0) {
  console.error('✗ Unexpected generation failures (not §44 refusals):')
  for (const { input, message } of hardFailureSamples) {
    console.error(`  ${input.race_distance_km}km/${input.fitness_level}/days=${input.days_available}: ${message}`)
  }
  process.exit(1)
}

// ── Known-open baseline ─────────────────────────────────────────────────────
//
// The moment this sweep started actually generating plans (2026-08-20) it
// surfaced real, PRE-EXISTING violations that had been invisible for months
// while it was a silent no-op. They are not regressions from today's work and
// they are not fixable in one sitting — they are a wave.
//
// So the gate is baselined rather than switched off: the counts below are what
// the engine produced on the day the sweep was repaired, at the pinned seed.
// Anything NEW, or any count that grows, fails the run. Every count that falls
// is progress and the baseline should be lowered to lock it in.
//
// A baseline is a debt register, not an amnesty. Tracked in backlog.md as
// SWEEP-BASELINE-01.
const BASELINE: Record<string, number> = {
  // 1116 -> 1080 on 2026-08-20: SC-07's build rotation fixed 36 of these as a
  // side effect. Lowered to lock the improvement in, per the note above.
  // 1116 -> 1080 (SC-07) -> 0 (VOL-STRUCTURE-01, 2026-08-20). Removed entirely:
  // material inversions now declare maintenance, sub-material ones are tolerated
  // as a plateau. Kept as an explicit 0 rather than deleted, so a regression
  // reads as "NEW" against a stated expectation.
  'INV-PLAN-PEAK-IN-PEAK-PHASE':          0,
  // 981 -> 587 (2026-08-20): the §12 injury cap now compounds instead of
  // resetting to the raw curve each week. See ruleEngine's prevAdjustedKm.
  // 981 -> 450 across three changes on 2026-08-20: the §12 injury cap now
  // compounds inside the volume curve, §45 gained one rounding step of headroom
  // (it differences two ROUNDED distances against an unrounded cap), and the
  // grid stopped pairing impossible volumes. The last step traded 62 of these
  // back for 235 fewer undersized sessions — a deliberate, net-positive swap:
  // an over-long long run is visible to a runner, a sub-floor session is not.
  'INV-PLAN-LR-PROGRESSION-CAP':        450,

  // 211 -> 537 (2026-08-20). RAISED, and deliberately not hidden: making the
  // injury cap actually compound holds volume down for injured runners — which
  // is what §12 asks for — and at low starting volumes the sessions that result
  // fall under MIN_SESSION_DISTANCE_KM.
  //
  // Confined entirely to a band the product should not be serving. Measured by
  // starting weekly volume: 28% at 5 km/wk, 28% at 12, 6% at 25, and ZERO at 40
  // and 60. On realistic inputs (long run a coherent share of the week, volume
  // >= 25 km) the rate is 1%.
  //
  // The honest fix is a volume floor per race distance — you cannot build a
  // marathon plan from 5 km a week — which is a coaching decision, filed as
  // INPUT-FLOOR-01. Until it lands this number stays visible rather than being
  // absorbed into a tolerance.
  'INV-PLAN-MIN-SESSION-SIZE':          302,

  'INV-PLAN-QUALITY-VARIETY-FULL-PLAN':  75,
  // 54 -> 98, same cause and same band as MIN-SESSION-SIZE above.
  'INV-PLAN-TAPER-VARIETY':              98,
  // Same band again: a lopsided week at very low volume. Pending INPUT-FLOOR-01.
  'INV-PLAN-LR-MAX-WEEKLY-PCT':          36,
}

const regressions: string[] = []
for (const [code, n] of Array.from(violationsByCode.entries())) {
  const allowed = BASELINE[code] ?? 0
  if (n > allowed) regressions.push(`  ${code}: ${n} (baseline ${allowed}) — ${n - allowed} NEW`)
}
const improvements: string[] = []
for (const [code, allowed] of Object.entries(BASELINE)) {
  const n = violationsByCode.get(code) ?? 0
  if (n < allowed) improvements.push(`  ${code}: ${n} (baseline ${allowed}) — ${allowed - n} fixed, lower the baseline`)
}

if (improvements.length > 0) {
  console.log('Improvements vs baseline:')
  improvements.forEach(l => console.log(l))
  console.log()
}

// EXPLAIN dump goes BEFORE the regression exit — it is most needed exactly when
// the run is failing, and printing it afterwards meant it never printed at all.
if (EXPLAIN) {
  console.log(`\nExamples of ${EXPLAIN}:`)
  explained.forEach(e => console.log(e))
  console.log()
}

if (regressions.length > 0) {
  console.error('✗ NEW invariant violations above the known-open baseline:')
  regressions.forEach(l => console.error(l))
  console.error()
  for (const { input, violation } of samples) {
    console.error(`  ${violation.code} on ${input.race_distance_km}km/${input.fitness_level}/days=${input.days_available}/cwk=${input.current_weekly_km}: ${violation.message}`)
  }
  process.exit(1)
}

if (violationsByCode.size > 0) {
  console.log('Known-open violations (baselined, see SWEEP-BASELINE-01):')
  for (const [code, n] of Array.from(violationsByCode.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${n}`)
  }
  console.log()
}

console.log(`✓ ${generated} plans generated and validated. No NEW violations above baseline.`)
