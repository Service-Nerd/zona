// Property-based sweep: generate plans across a wide grid of inputs and run
// validatePlan on each. Catches edge cases hand-written tests miss.
// Replaces find-zero-easy.ts as a more general constitutional fuzzer.
//
// Run: NODE_ENV=production npx tsx scripts/property-validate-plans.ts
// Exit: 0 if all plans pass invariants; 1 if any violations.
// (NODE_ENV=production prevents the engine from throwing — we want to collect.)

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan, type Violation } from '../lib/plan/invariants'
import { generateFoundationBlock } from '../lib/plan/foundationBlock'

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
// §79 (2026-09-02) — `undefined` is a FIRST-CLASS value here, not padding.
//
// Every entry used to be a concrete level, so `input.fitness_level` was always
// set, which made `assessedStructural === assessedIntensity` in every one of the
// 17,957 plans. Combined with `training_age` never being swept (below), the
// engine's own assessment path — and therefore the whole structural-vs-intensity
// split — was UNREACHABLE by this sweep. The §79-PEAKKM and §79-INTENSITY-ROUTING
// changes were consequently no-ops across the entire grid, and the sweep coming
// back byte-identical was mistaken for evidence of safety when it was evidence of
// no coverage. Same failure shape as SWEEP-VACUOUS-01 and the missing HR axis
// below: a grid that cannot reach a branch cannot vouch for it.
const fitnessSets = [undefined, 'beginner', 'intermediate', 'experienced']

// §79 — training age drives the returning-runner intensity lift (deep training
// age + beginner-on-volume → intensity lifted off the beginner floor), which is
// the main way `intensityFitness` comes to differ from `fitness` in production.
// Never swept before, so that lift never fired in the grid.
const trainingAgeSets = [undefined, '<6mo', '6-18mo', '2-5yr', '5yr+']

// §79 — the runner's own declaration, which binds asymmetrically (upward =
// intensity only, downward = structure too). `INV-PLAN-USER-LEVEL-NO-UPWARD-TONNAGE`
// is meaningless unless the grid actually produces upward declarations.
const declaredSets = [undefined, 'beginner', 'intermediate', 'experienced']
const hardSets = ['love', 'avoid', 'neutral']
const injurySets = [[], ['knee'], ['achilles'], ['shin_splints'], ['hip_flexor'], ['back']]
// ADR-020 (2026-09-03) — 30 ADDED. The grid tested 45/60/90 while BOTH real
// users had chosen 30, and three separate INV-PLAN-MAX-WEEKDAY-MINS defects
// shipped behind a green sweep because the tightest realistic cap was never
// exercised. Same class as SWEEP-VACUOUS-01 and the fitness_level gap: an input
// the grid never varies tests nothing.
const maxWeekdays = [undefined, 30, 45, 60, 90]

// ADR-020 — FOUNDATION COVERAGE. The sweep generated 18,060 plans and ZERO of
// them carried a foundation block, so `generateFoundationBlock` and
// INV-PLAN-FOUNDATION-BLOCK were unreachable by the gate that runs on every
// commit. Values straddle each §57 gap boundary: no block, auto-generated
// (7-28 days), and the user-chosen case (> 28).
const foundationGapDays = [0, 10, 24, 40]

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
    // §79 — spread-conditionally so `undefined` means ABSENT (the engine's own
    // assessment runs), not "present and undefined".
    ...(() => { const f = pick(fitnessSets);   return f ? { fitness_level: f } : {} })(),
    ...(() => { const t = pick(trainingAgeSets); return t ? { training_age: t } : {} })(),
    ...(() => { const d = pick(declaredSets);  return d ? { user_declared_level: d } : {} })(),
    hard_session_relationship: pick(hardSets),
    injury_history: pick(injurySets),
    max_weekday_mins: pick(maxWeekdays),
    __foundationGapDays: pick(foundationGapDays),
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
let foundationPlans = 0
let foundationWeeks = 0
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
  let planTier: 'free' | 'trial' | 'paid' = 'trial'
  try {
    // PLAN_START passed EXPLICITLY — see the note at the top of this file. This
    // argument is the difference between a sweep and a very fast no-op.
    planTier = pick(tiers)
    plan = generateRulePlan(input, planTier, PLAN_START)
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e)
    if (REFUSAL.test(msg)) { refused++; continue }
    hardFailures++
    if (hardFailureSamples.length < 5) hardFailureSamples.push({ input, message: msg })
    continue
  }
  generated++

  // ADR-020 — validate the plan the RUNNER gets. Foundation weeks are assembled
  // client-side and prepended after the API returns, so a sweep that validates
  // only the engine's output is blind to every week with n <= 0. Mirrors
  // GeneratePlanScreen's assembly exactly.
  const gapDaysForPlan = (input as Record<string, unknown>).__foundationGapDays as number
  if (gapDaysForPlan > 0) {
    try {
      const planStart = plan.weeks.find(w => w.n === 1)?.date ?? PLAN_START
      const today = new Date(new Date(planStart).getTime() - gapDaysForPlan * 86_400_000)
        .toISOString().slice(0, 10)
      const fb = generateFoundationBlock({ input, planStartDate: planStart, today })
      if (fb.weeks.length) {
        plan = { ...plan, weeks: [...fb.weeks, ...plan.weeks] }
        foundationPlans++
        foundationWeeks += fb.weeks.length
      }
    } catch { /* block generation is best-effort; the main plan still validates */ }
  }

  const errors = validatePlan(plan, input).filter(v => v.severity === 'error')
  if (errors.length > 0) {
    violatingPlans++
    if (EXPLAIN && explained.length < 5) {
      for (const v of errors.filter(e => e.code === EXPLAIN)) {
        // Dump the COMPLETE input, not a hand-picked subset.
        //
        // The subset version (race_distance_km, goal, days_available,
        // current_weekly_km, longest_recent_run_km, fitness_level,
        // max_weekday_mins, injury_history) silently omitted the HR set,
        // benchmark, training_age, terrain, target_time, tier and PLAN_START —
        // so a case copied out of this dump did NOT reproduce. On 2026-09-03
        // that cost two rounds of guesswork chasing a violation that could not
        // be recreated from its own report. A repro you cannot replay is not a
        // repro; print everything needed to re-run it.
        explained.push(
          `  ${v.message}\n     week ${v.week}${v.day ? ' ' + v.day : ''} — got ${v.actual}, expected ${v.expected}` +
          `\n     plan_start: ${PLAN_START}   tier: ${planTier}   volume_profile: ${plan.meta?.volume_profile ?? '-'}` +
          `\n     input: ${JSON.stringify(input)}`)
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
  // ── ADR-020 (2026-09-03): three classes made visible by WIDENING THE GRID ──
  //
  // Not regressions. The grid gained `max_weekday_mins: 30` (both real users had
  // chosen it; the grid tested only 45/60/90) and foundation-block assembly
  // (0 of 18,060 plans had ever carried one). Attribution measured by running
  // the SAME widened grid against the pre-wave engine (HEAD be5e538):
  //
  //   code                              pre-wave    after this wave
  //   INV-PLAN-LONG-IS-LONGEST            49,336          0
  //   INV-PLAN-MIN-SESSION-SIZE           66,075      2,061
  //   INV-PLAN-FOUNDATION-BLOCK            9,230          0
  //   INV-PLAN-WEEK-HAS-REST-DAY           3,962          0
  //   INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO  155        155   <- unchanged
  //   INV-PLAN-MAX-WEEKDAY-MINS              238        238   <- unchanged
  //
  // Plans with violations: 11,237 -> 669. The three below are pre-existing
  // defects this grid can now see; they are a debt register, not an amnesty.
  // Filed in backlog.md as SWEEP-VISIBLE-01.

  // 238 -> 0 (Coaching Board 2026-09-03, Q1). Cleared by the structured-session
  // exemption PLUS restoring the final cap pass — the exemption alone took it to
  // 303, because keeping quality sessions at full size changes what the
  // redistribution passes hand the easy runs. Kept as an explicit 0 so a
  // regression reads as NEW against a stated expectation.
  'INV-PLAN-MAX-WEEKDAY-MINS':               0,
  // 155 -> 0 (2026-09-03). NOT a 5K carve-out, and NOT the day-count issue first
  // supposed. `halfWeek` counted foundation weeks (n <= 0) toward totalWeeks,
  // shifting the second-half boundary so the wrong weeks were assessed —
  // contrary to §57. A 5K exclusion was proposed on the reading that "0/1" meant
  // unsatisfiable; measurement showed 168/168 5K sessions sit within +/-5% of
  // goal pace, and an A/B with and without the skip gave identical totals, so it
  // was NOT added. The ratio binds at every distance.
  'INV-PLAN-RACE-SPECIFIC-EXPOSURE-RATIO':    0,

  // 1116 -> 1080 on 2026-08-20: SC-07's build rotation fixed 36 of these as a
  // side effect. Lowered to lock the improvement in, per the note above.
  // 1116 -> 1080 (SC-07) -> 0 (VOL-STRUCTURE-01, 2026-08-20). Removed entirely:
  // material inversions now declare maintenance, sub-material ones are tolerated
  // as a plateau. Kept as an explicit 0 rather than deleted, so a regression
  // reads as "NEW" against a stated expectation.
  'INV-PLAN-PEAK-IN-PEAK-PHASE':          0,
  // 981 -> 587 (2026-08-20): the §12 injury cap now compounds instead of
  // resetting to the raw curve each week. See ruleEngine's prevAdjustedKm.
  // 981 -> 0 (2026-08-20). Four causes: the §12 injury cap now compounds inside
  // the volume curve; §45 gained one rounding step of headroom; the grid stopped
  // pairing impossible volumes; and finally the cap now runs AFTER
  // applyLongRunStepBacks and recognises a step-back bounceback the same way it
  // already recognised a deload one. That last change alone cleared 430.
  'INV-PLAN-LR-PROGRESSION-CAP':          0,

  // 211 -> 537 -> 0 (2026-08-20). Went UP before it went down: making the §12
  // injury cap compound held volume lower, which exposed sessions that had
  // always been under-sized. Cleared entirely by §52b (a training day must be
  // able to carry a real session) plus honouring the `secondary_quality` floor
  // the config already declared and the invariant had been ignoring.
  //
  // 0 -> 2061 (ADR-020, 2026-09-03) — NOT a regression. The grid gained
  // `max_weekday_mins: 30` and foundation blocks; the same widened grid scores
  // 66,075 against the PRE-WAVE engine and 2,061 after, so this wave removed
  // ~97% of them. The remainder are main-week QUALITY sessions shrunk below
  // MIN_SESSION_DISTANCE_KM.quality (5km) by applyWeekdayMinsCap at a tight cap
  // — 0 land on foundation weeks. Same family as MWM-02/§81 (the cap deforming a
  // session whose prescription IS its structure), but the board ruled only on
  // the long run; extending the exemption to quality sessions is a new coaching
  // decision and is not taken here. Filed as SWEEP-VISIBLE-01.
  // 2061 -> 924 (Coaching Board 2026-09-03, Q1): §81's weekday-cap exemption
  // extended to STRUCTURED sessions. The cap scaled distance/duration but not
  // `derived_set`, so a "Short VO2max" went 9km/43min -> 6.5km/30min while still
  // prescribing 7 x 400m — identical work, a duration that no longer described
  // it. The remainder are low-volume main weeks whose easy runs fall under the
  // floor (§52b territory), unrelated to the cap.
  'INV-PLAN-MIN-SESSION-SIZE':             924,

  // 87 -> 75 -> 0 (LABEL-VARIETY-01, 2026-08-21). The LABEL count is now zero:
  // the peak goal-pace override takes the row's shape word ("…-pace ladder",
  // "…-pace sustained", "…-pace reps") instead of one generic "…-pace intervals"
  // for every row, so no display label repeats past the cap. Locked to 0 so a
  // reintroduced label collapse reads as NEW.
  //
  // ⚠️ This does NOT close CAT-ULTRA-THIN-01. That check counts catalogue ROWS,
  // not labels — a different measurement (~2,227), untouched here and if anything
  // made honester-but-quieter, because distinct labels no longer hint at the
  // row repetition underneath. The row-count flip is still gated on the Coaching
  // Board's §53 cap ruling; both halves ship together or neither does.
  'INV-PLAN-QUALITY-VARIETY-FULL-PLAN':    0,
  // 54 -> 98 -> 0 (2026-08-20). Cleared by identifying a taper session by its
  // catalogue ROW rather than its display label: §22's goal-pace rename made two
  // genuinely different sessions read as a repeat. The row check is also
  // stronger in the other direction — the same row twice under two names is a
  // real repeat the label check missed.
  'INV-PLAN-TAPER-VARIETY':                0,
  // Same band again: a lopsided week at very low volume. Pending INPUT-FLOOR-01.
  // 35 -> 59 -> 0 on 2026-09-02. FULLY FIXED, including the 35 that pre-dated
  // this session. §52 itself names three remedies for a week whose long run
  // exceeds the cap — "reduce the long run, raise weekly volume, or downgrade to
  // maintenance" — and the engine did none of them: it built the lopsided week
  // and let the invariant report the runner's plan as defective for a constraint
  // the engine had chosen. It now takes the third remedy (maintenance is already
  // exempt from this cap and already carries an honest runner-facing note).
  // Cost measured against the same grid: maintenance classification 131 -> 137 of
  // 315 (+1.9pp, 6 plans). Kept as an explicit 0 so a regression reads as NEW.
  'INV-PLAN-LR-MAX-WEEKLY-PCT':          0,
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

console.log(`✓ ${generated} plans generated and validated (${foundationPlans} carried a foundation block, ${foundationWeeks} foundation weeks). No NEW violations above baseline.`)
