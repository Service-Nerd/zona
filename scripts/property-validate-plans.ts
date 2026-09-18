// Property-based sweep: generate plans across a wide grid of inputs and run
// validatePlan on each. Catches edge cases hand-written tests miss.
// Replaces find-zero-easy.ts as a more general constitutional fuzzer.
//
// Run: NODE_ENV=production npx tsx scripts/property-validate-plans.ts
// Exit: 0 if all plans pass invariants; 1 if any violations.
// (NODE_ENV=production prevents the engine from throwing — we want to collect.)

import { generateRulePlan } from '../lib/plan/ruleEngine'
import { validatePlan, type Violation } from '../lib/plan/invariants'
import { composePlanWithFoundation } from '../lib/plan/foundationCompose'
import {
  generatorInputFields, assertParsedShape, inputCoverage,
} from '../lib/plan/sweepInputCoverage'
import { GENERATION_CONFIG } from '../lib/plan/generationConfig'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
  race_name: 'Test',
  primary_metric: 'distance' as const,
  injury_history: [],
  plan_start: PLAN_START,
}

// ⚠️ TARGET TIME MUST BE PER-DISTANCE. It was a single `target_time: '0:45:00'`
// on baseInput, applied to EVERY distance in the grid — which handed a 100K
// runner a goal pace of 27 SECONDS per kilometre.
//
// Everything downstream of `goal_pace_per_km` was therefore nonsense on the four
// distances above 10K: §22's race-specific override, the goal-pace label rename,
// goal-anchored derived_set steps, and every session sized against goal pace. The
// sweep still reported those plans as clean, because no invariant asserts that a
// goal pace is physically possible — so "0 violations" meant "no coverage" for
// the entire goal-paced path on HM, marathon, 50K and 100K.
//
// Same class as SWEEP-VACUOUS-01 (a time-dependent grid that silently stopped
// generating) and the `fitness_level`-always-set gap (§79): an input the grid
// gets WRONG tests a runner who does not exist, and reads as safety.
//
// Found 2026-09-04 while measuring cross-distance blast radius for the Coaching
// Board — the ultra measurements had to be discarded and re-taken.
const TARGET_TIME_BY_DISTANCE: Record<number, string> = {
  5: '0:22:00', 10: '0:45:00', 21.1: '1:45:00', 42.2: '3:45:00', 50: '6:00:00', 100: '14:00:00',
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
// §89 — experience-gated quality onset. Must be swept so INV-PLAN-EARLY-ONSET-GATED
// is exercised across the grid (including the 'regular' value that unlocks it and
// the injury combinations that must veto it).
const recentQualitySets = [undefined, 'none', 'occasional', 'regular']
// ⚠️ THE WIZARD'S OWN SPELLINGS, not the code's (2026-09-16). These read
// ['knee'], ['shin_splints'], ['hip_flexor'] — snake_case values the product
// CANNOT PRODUCE. `GeneratePlanScreen` offers 'Achilles', 'Knee', 'Back', 'Hip',
// 'Shin splints', 'Plantar fasciitis', and `hasInjury` matched them by raw
// substring, so 'Shin splints' never matched 'shin_splints' and THREE of six
// injury types had their coaching rules silently disabled in production. The
// sweep could not see it because it tested the code's spelling against the
// code's spelling. Fixture values must be what the PRODUCT emits.
// Count held at 6 so the seeded sample does not re-roll and rates stay
// comparable; 'Plantar fasciitis' is therefore still unswept (SWEEP-INJURY-01).
const injurySets = [[], ['Knee'], ['Achilles'], ['Shin splints'], ['Hip'], ['Back']]
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
// 2026-09-15 (FOUNDATION-LONG-RUNWAY-01) — 91 and 175 ADDED. The axis topped out
// at 40 days, which is 5 whole weeks: FOUNDATION_MAX_WEEKS takes 3 and leaves 2
// uncovered, so the sweep only ever brushed the threshold of §57's uncovered-
// runway obligation and never the cohort it exists for. A CHARITY RUNNER TYPICALLY
// GETS THEIR PLACE MONTHS OUT — measured, a 25-week marathon runway leaves 4
// uncovered weeks and a 40-week runway leaves 19. Those are the NORMAL case for
// this cohort and the grid could not see them. 91 days (13 weeks -> ~10 uncovered)
// and 175 days (25 weeks -> ~22 uncovered) put the real shape in the sweep.
const foundationGapDays = [0, 10, 24, 40, 91, 175]

// COVERAGE GATE (2026-09-04) — both of these were flagged by the gate on its
// first run as declared-but-never-set, and both are REAL engine paths.
//
// §29 / M-02 fresh-from-layoff: `weeks_at_current_volume` below
// FRESH_RETURN_WEEKS_THRESHOLD (8) makes the engine treat `current_weekly_km`
// as ASPIRATIONAL and start at a fraction of it (ruleEngine.ts, explicitFreshReturn).
// Straddles the threshold: absent, well under, just under, at, well over.
const weeksAtVolume = [undefined, 2, 7, 8, 20]

// ADR-020 / §57: the runner's answer to the >28-day-gap question. The sweep
// HARDCODED 'add' at the compose call, so `skip` and `start_now` — the whole
// deferred-decision path ADR-020 Option A exists for — were unswept.
const foundationDecisions: any[] = [undefined, 'add', 'skip', 'start_now']

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
  {
    // INTENSITY-3DAY-01 (§97 Amendment 1) — a §89-gated `experienced` runner on
    // 3 days delivered 27.3% quality against §1's 25% 10K ceiling, live in
    // production. The random grid varies days_available: 3 but never crossed it
    // with the full §89 gate, so it is pinned as a corner. `ceiling × days = 0.75`
    // → short on-ramp must be DENIED, base holds at the two-week floor.
    label: 'intensity-3day-01-10k-3d-experienced',
    race_distance_km: 10, race_date: raceDate(12), goal: 'time_target',
    target_time: '0:45:00', days_available: 3, age: 40,
    current_weekly_km: 30, longest_recent_run_km: 14,
    resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 10, time: '0:49:00' },
    training_age: '5yr+', user_declared_level: 'experienced',
    recent_quality_training: 'regular',
  },
  {
    // INTENSITY-3DAY-01 — the tighter HM ceiling (20%) breaches one day later, at
    // 4 days (`ceiling × days = 0.80`), where the 3-day case flips to maintenance
    // and exempts. Proves the guard is denominator-scoped, not a flat day count.
    label: 'intensity-3day-01-hm-4d-experienced',
    race_distance_km: 21.1, race_date: raceDate(14), goal: 'time_target',
    target_time: '1:45:00', days_available: 4, age: 40,
    current_weekly_km: 45, longest_recent_run_km: 18,
    resting_hr: 52, max_hr: 185, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 21.1, time: '1:50:00' },
    training_age: '5yr+', user_declared_level: 'experienced',
    recent_quality_training: 'regular',
  },
  {
    // INTENSITY-LONGDIST-LOWDAY-01 (Coaching Board CB-INTENSITY-50K-01) — the worst
    // observed delivered 50K build-profile quality share (16.3%, 13/80). Not an
    // early-onset artifact; intermediate gets no §89, the quality is the ordinary
    // build+peak accumulation against a low-day denominator. The random grid forces
    // foundation_decision 'add', which enlarged the denominator and masked it, so it
    // is pinned. Must sit at/under §1's 50K ceiling (raised 15 -> 17).
    label: 'intensity-longdist-50k-5d-build',
    race_distance_km: 50, race_date: raceDate(16), goal: 'time_target',
    target_time: '5:30:00', days_available: 5, age: 40,
    current_weekly_km: 40, longest_recent_run_km: 14,
    resting_hr: 50, max_hr: 185, preferred_long_run_day: 'sun',
    benchmark: { type: 'race', distance_km: 50, time: '5:00:00' },
    training_age: '2-5yr', user_declared_level: 'experienced',
    acknowledged_prep_warning: true,
  },
  {
    // GOAL-COHERENCE-01 (2026-09-16) — A TIME GOAL WITH NO TIME.
    //
    // ⚠️ THE SWEEP WAS STRUCTURALLY BLIND TO THIS, and the blindness was in the
    // harness, not the engine. `randomInput()` sets `target_time` from
    // TARGET_TIME_BY_DISTANCE **unconditionally**, independent of the `goal`
    // axis, so `goal: 'time_target'` + no `target_time` is a combination the
    // random grid CANNOT generate — 15,973 plans and not one of them.
    //
    // Measured before the fix: 3 error-severity INV-PLAN-RACE-SPECIFIC-EXPOSURE
    // violations on one plan, which THROW in dev and test. §22 demanded a
    // goal-pace rename the engine had no goal pace to produce.
    //
    // A CORNER, DELIBERATELY, NOT A NEW `goalSets` ENTRY. A third value on that
    // axis changes what `pick()` returns for every later draw, re-rolling the
    // whole seeded sample and moving every rate in this file — the trap
    // SWEEP-AGE-01 records ("widening it revealed a second unrelated defect
    // immediately, so it needs its own commit"). Corners always run and do not
    // touch the sample, and coverage of one specific shape is exactly their job.
    label: 'goal-coherence-time-target-without-target-time',
    race_distance_km: 10, race_date: raceDate(13), goal: 'time_target',
    // target_time deliberately ABSENT — this is the whole point of the case.
    days_available: 5, age: 42,
    current_weekly_km: 30, longest_recent_run_km: 12,
    fitness_level: 'intermediate', training_age: '2-5yr',
    recent_quality_training: 'occasional',
  },
]

// A distance added to the grid without a target time would silently sweep with
// `target_time: undefined` — no goal pace, no §22 path, and the goal-paced half
// of that distance untested while the run still reports clean. Fail loudly.
for (const d of distancesAndDates) {
  if (!TARGET_TIME_BY_DISTANCE[d.race_distance_km]) {
    throw new Error(`No TARGET_TIME_BY_DISTANCE entry for ${d.race_distance_km} km — add one or the goal-paced path for that distance is unswept.`)
  }
}

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
    target_time: TARGET_TIME_BY_DISTANCE[d.race_distance_km],
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
    ...(() => { const r = pick(recentQualitySets); return r ? { recent_quality_training: r } : {} })(),
    max_weekday_mins: pick(maxWeekdays),
    // UX-WIZARD-01 Stage B — sweep per-day budgets across the grid so the new
    // sizing/placement/redistribution is exercised broadly, not only by the
    // dedicated day-budget cases. ~40% of picks carry a budget map over the
    // runnable weekdays; max_weekday_mins is set to their MIN, exactly as the
    // wizard derives it (weekPlanToInputs). Undefined otherwise → the no-budget
    // path (proven byte-identical by verify:parity) keeps the majority coverage.
    ...(() => {
      // ~20% carry an UNEVEN per-day budget (the real use case: one roomy day
      // among tighter ones). The `min` is 45, not 30 — the extreme 30-min cap is
      // already sampled by `maxWeekdays`, so re-flooding it here would only
      // over-represent time-constrained runners and inflate the honest
      // PEAK-NOT-BELOW-START residual, not test the per-day distribution logic.
      const shape = pick(['none', 'none', 'none', 'none', 'uneven'] as const)
      if (shape === 'none') return {}
      const blockedWd = new Set(days.days_cannot_train ?? [])
      const wd = (['mon', 'tue', 'wed', 'thu', 'fri'] as const).filter(d => !blockedWd.has(d))
      if (wd.length === 0) return {}
      const db: Record<string, number> = {}
      wd.forEach((d, i) => { db[d] = i % 2 === 0 ? 45 : 90 })
      return { day_budgets: db, max_weekday_mins: Math.min(...Object.values(db)) }
    })(),
    ...(() => { const w = pick(weeksAtVolume); return w === undefined ? {} : { weeks_at_current_volume: w } })(),
    ...(() => { const d = pick(foundationDecisions); return d ? { foundation_decision: d } : {} })(),
    __foundationGapDays: pick(foundationGapDays),
    ...hrSet.hr,
    ...(g.goal ? { goal: g.goal } : {}),
    ...(lrd.preferred_long_run_day ? { preferred_long_run_day: lrd.preferred_long_run_day } : {}),
    ...(bm.benchmark ? { benchmark: bm.benchmark } : {}),
  }
}

// A refusal is the engine working: §44 prep-time blocks and the days-per-week
// minimums are DESIGNED to throw. Anything else that throws is a real failure.
//
// The WARN-band arm ("is below the recommended N-week minimum") was missing until
// 2026-09-04, and its absence was invisible because nothing in the grid reached
// that band: §44 uses STRICTER prep-time thresholds for a returning runner, and
// `weeks_at_current_volume` — the field that flips `isReturningForPrepTime` — was
// never set by the sweep. Adding that axis (via the input-coverage gate) turned 13
// by-design refusals into "unexpected generation failures" overnight.
//
// A warn-band throw is still the engine working: §44 refuses without
// `acknowledged_prep_warning`, which the sweep deliberately never sets (see
// COVERAGE_EXEMPTIONS) because setting it would admit shapes the product refuses.
// §113 (LONGEST-RUN-GATE-01, 2026-09-18) — long-run readiness. Added the day
// it shipped, and the sweep is the ONLY corpus that reaches it: both plan grids
// carry a minimum `longest_recent_run_km` of 8, above the floor of 5, so they
// refuse 0 of 35,952. The sweep refuses **2,634**. That is the whole reason this
// repo records "measure a new rule on the SWEEP, not the cohort grid".
const REFUSAL = /is not enough preparation|days?\/week is (not enough|below)|is below the recommended \d+-week minimum|too low to build safely|needs to start from at least/

let attempted = 0
let generated = 0
let foundationPlans = 0
let foundationWeeks = 0
let refused = 0
let violatingPlans = 0
let hardFailures = 0
const violationsByCode = new Map<string, number>()
// SWEEP_SCORE=1 — per-PLAN acceptability tally for the coaching-compliance gauge.
// READ-ONLY and env-gated: default runs are byte-identical. The sweep counts
// violations BY CODE, which cannot answer "what share of plans are clean"
// because one plan can carry several codes and the codes overlap.
const SCORE = process.env.SWEEP_SCORE === '1'
let scErrFree = 0, scWarnFree = 0, scBoth = 0, scScored = 0
// ── THE COACHING COMPLIANCE GAUGE (three states) ─────────────────────────────
// Agreed 2026-09-16. A binary clean/not-clean gauge is unreachable and, worse,
// dishonest: measured, 89.7% of the biggest warn (§106, 29.6%) fires on plans the
// constitution EXPLICITLY licenses -- §12's injury cap, §10's <6mo over-claim
// cap, §23/§46's days and weekday-minute constraints. Counting those as failures
// would mean the only route to 95% is suppressing checks that are working.
//
//   CLEAN        no errors, no warns.
//   CONSTRAINED  a residual the constitution ratifies, AND the plan says so.
//                §34's standing rule: a structural limit is acceptable when it is
//                declared. This counts as ACCEPTABLE.
//   FAILING      an error, a structural failure (detraining / inverted peak), or
//                a residual the plan does NOT declare. Silence is the defect.
//
// ACCEPTABLE = CLEAN + CONSTRAINED. Target 95%.
let gClean = 0, gConstrained = 0, gFailing = 0
// ── FIT FOR PURPOSE ──────────────────────────────────────────────────────────
// NOT the same question as the compliance gauge. That one asks "does the plan
// ADMIT its limitations". This asks "would a coach hand this to a runner" —
// which is the standard the Coaching Board actually applied on 2026-09-16, and
// by which it rejected T2 (honest, and still unfit).
// Criteria taken straight from the board's stated reasons for rejection.
let fitOk = 0
const fitFail = new Map<string, number>()
// ROOT-CAUSE SPLIT for the two dominant unfit reasons, so the fix is aimed.
const zeroQCause = new Map<string, number>()
const zqEg: string[] = []
const peakShortCause = new Map<string, number>()
let psDeclared = 0, psSilent = 0
const psEg: string[] = []
const supSplit = new Map<string, number>()
let hprLie = 0, hprOk = 0
const regSplit = new Map<string, number>()
const gUndeclaredCodes = new Map<string, number>()
const gDeclSrc = new Map<string, number>()
const gFailReason = new Map<string, number>()
// THE QUESTION THAT DECIDES WHETHER 95% IS REACHABLE. A plan that cannot build
// because the RUNNER's constraints forbid it (3 days, injury cap, time budget)
// and SAYS SO is not a defective plan -- §23/§52 rule that outcome correct, and
// §34 requires only that it be declared. A plan that fails to progress and says
// NOTHING is the M5 class. Splitting them is the difference between a reachable
// target and an impossible one.
let scNoProgress = 0, scNoProgressDeclared = 0, scNoProgressSilent = 0
// FIX 0 — reconciling INV-PLAN-PEAK-NOT-BELOW-START (28.1%) against the
// descending-plan measure (9.2%). Do they overlap, or measure different things?
let scFiresInv = 0, scFiresInvAndDescends = 0, scFiresInvButProgresses = 0, scDescendsNoInv = 0
// §106's invariant takes `deliveredPeak` over non-foundation, non-deload weeks
// and does NOT exclude RACE WEEK. For a marathon that week contains the 42.2 km
// race, so the "peak" is the race itself. Does that mask real detraining?
let scMaskedByRaceWeek = 0
// FIX 1 — does the "maintains your fitness" claim match what the plan delivers?
// The note quotes its own numbers ("peaks at X against Y earlier") and then
// concludes it MAINTAINS. Measure the gap between claim and delivery.
let scMaintClaim = 0
const scMaintDrop: number[] = []
// The invariant must apply to EVERY plan, not only ones carrying the note --
// a detraining plan is a defect whether or not it admits to being one.
const scAllDrop: number[] = []
let scAllDrop30 = 0, scAllDrop30Claimed = 0, scAllDrop30Silent = 0
// FIX 2 — the volume/quality trade. When a quality session enters a constrained
// week it takes a DAY SLOT. Quality is sized by STRUCTURE (§16/§40b), so it is a
// near-fixed ~8 km whatever the runner; the easy run it displaces scales with
// how few days they have. Measure the displacement per day-count and distance.
const scDisp = new Map<string, { n: number; q: number; e: number; step: number }>()
// IS WEEK 1 AN OUTLIER? INV-PLAN-NOT-DETRAINING references the plan's own week 1.
// If week 1 is systematically a spike, that reference is wrong and the invariant
// fires on plans that merely SETTLE rather than detrain.
let scW1Spike = 0, scFiresFromW1 = 0, scFiresFromMed = 0
// THE RATCHET. §3 cuts a deload to 70%; §2's cap then limits the climb back.
// 0.70 x 1.05^2 = 0.772 for an injury runner on the masters cadence -- a 23%
// COMPOUNDING loss per cycle. RAMP-BOUNCEBACK-01 removed the bounceback
// exemption for injury runners and asserted "the return to pre-deload still
// happens, gradually". Does it?
const scRatchet = new Map<string, { n: number; decl: number; fired: number }>()
// SILENT §1 BREACH: plans labelled `maintenance` whose quality share exceeds the
// distance ceiling. §1's invariant exempts maintenance (CD-21) and §90 Am.1's
// yield is gated off by it, so neither the checker nor the producer acts.
let scSilent1 = 0, scMaintPlans = 0
// §106 is the dominant blocker on the compliance gauge (29.6%). Is the shortfall
// the RUNNER's constraint (days / weekday minutes — §23/§46 license that) or
// ours? Split it, because only one of those is fixable.
const scPeakShort = new Map<string, { n: number; gap: number }>()
const scPeakEg: string[] = []
// The three-state gauge rests on this: is a CONSTRAINED plan also an HONEST one?
let scConstrained = 0, scConstrainedDeclared = 0, scOursUndeclared = 0
const scSilent1Over: number[] = []
let scSilent1AllEasy = 0
let scDescending = 0, scDescendingSilent = 0
const scWarnPlansByCode = new Map<string, number>()
// NOISE-GATE-01 — warn-severity violations were counted by NOTHING (the loop below
// filtered to `severity === 'error'`), so a `warn` invariant firing on 44% of the
// grid was invisible — the exact §94 INV-PLAN-DELIVERED-RAMP noise this gate exists
// to catch. Per-code warn firing rate is now measured and threshold-gated below.
const warnByCode = new Map<string, number>()

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

// ── INPUT COVERAGE GATE (proposal #4, 2026-09-04) ───────────────────────────
//
// Runs BEFORE a single plan is generated, because it asserts the SHAPE OF THE
// GRID rather than the plans that come out of it. "18,059 plans, 0 violations"
// is only safety for the inputs actually varied; four times a field has been
// held constant across every swept plan, making a branch unreachable while the
// run stayed green. See lib/plan/sweepInputCoverage.ts for the four.
//
// Every exemption carries its reason. An exemption is a claim that varying the
// field would test nothing — not a way to quiet the gate.
const COVERAGE_EXEMPTIONS: Record<string, string> = {
  athlete_name: 'Display only — never read by the engine. Redacted from the real-input corpus for the same reason.',
  race_name:    'Display only — never read by the engine. Redacted from the real-input corpus for the same reason.',
  // `fitness_intensity_level` is an ENGINE OUTPUT fed back in by
  // validateReshapedPlan, not a wizard input; generation derives it. Varying it
  // here would test a value the generate path never receives.
  fitness_intensity_level: 'Engine-derived (§79) and only ever supplied on the RESHAPE path, never to generateRulePlan.',
  // Deliberately excluded, and this one is load-bearing: `validatePrepTime`
  // REFUSES generation in the warn window unless acknowledged. Setting it true
  // would let refused shapes through and silently change what the sweep covers.
  acknowledged_prep_warning: 'Setting it would admit prep-time-refused shapes (§44) and change what the grid means. Refusals are covered by the REFUSAL count instead.',

  // ── Declared on the input but NOT read by the rule engine ──────────────────
  // Each of these is copied to `plan.meta` (or consumed only by the AI enricher,
  // which this sweep does not run) and never influences what is prescribed.
  // Varying them would generate byte-identical plans — the definition of a
  // vacuous axis. Verified by tracing each to its only reader, 2026-09-04.
  terrain:         'Copied to plan.meta only (ruleEngine.ts). No prescription path reads it.',
  motivation_type: 'Copied to plan.meta only. No prescription path reads it.',
  training_style:  'Read ONLY by the AI enricher prompt (enrich.ts) and copied to meta. This sweep runs the rule engine, which never reads it.',

  // `max_weekend_mins` was exempted here on 2026-09-04 as DECLARED BUT
  // UNIMPLEMENTED, and removed from GeneratorInput the same day
  // (MAX-WEEKEND-MINS-01). The stale-exemption arm of this gate is what flagged
  // that the exemption had gone dead — worth recording, since an exemption list
  // nobody prunes is how a real gap eventually hides behind a stale entry.
}

{
  const src = readFileSync(join(process.cwd(), 'types/plan.ts'), 'utf8')
  const fields = generatorInputFields(src)
  assertParsedShape(fields)
  const cov = inputCoverage(inputs as Record<string, unknown>[], fields, COVERAGE_EXEMPTIONS)

  if (cov.staleExemptions.length > 0) {
    console.error(`\n✗ Coverage exemptions name fields that no longer exist on GeneratorInput:`)
    for (const f of cov.staleExemptions) console.error(`    ${f}`)
    console.error(`  Remove them — a rotting exemption list hides real gaps.\n`)
    process.exit(1)
  }

  if (cov.uncovered.length > 0) {
    console.error(`\n✗ SWEEP INPUT COVERAGE — ${cov.uncovered.length} GeneratorInput field(s) never varied:\n`)
    for (const u of cov.uncovered) console.error(`    ${u.field.padEnd(28)} ${u.sample}`)
    console.error(`
  A field the grid holds constant makes its branch UNREACHABLE, and the sweep
  still reports "0 violations" — that is no coverage, not safety. It has cost
  four separate defect classes (see lib/plan/sweepInputCoverage.ts).

  Vary it in randomInput(), or add it to COVERAGE_EXEMPTIONS in this file WITH
  a reason explaining why varying it would test nothing.\n`)
    process.exit(1)
  }
  console.log(`Input coverage:    ${cov.covered.length} fields varied, ${cov.exempt.length} exempt (${fields.length} declared)`)
}

for (const input of inputs) {
  attempted++
  let plan
  let planTier: 'free' | 'trial' | 'paid' = 'trial'
  // INTENSITY-FOUNDATION-BLIND-02 — `today` is derived BEFORE generation and
  // passed to BOTH generateRulePlan and composePlanWithFoundation, so the two
  // reason about one calendar.
  //
  // It used to be derived AFTER generation and given only to compose, while
  // generation read the wall clock. Since PLAN_START is pinned to 2026-04-27 and
  // `gapDays` clamps negatives to 0, generation saw gap 0 ('none') on every run
  // once that date passed: `foundation_weeks_planned` was 0 for all 16,038
  // plans, so §91's on-ramp credit and the §1 defer had ZERO sweep coverage
  // while 9,905 of those plans were nonetheless composed with a real 3-week
  // block. The sweep was validating plans whose generator believed no block was
  // coming — and its output drifted with the wall-clock date despite a pinned
  // seed, which makes "no NEW violations" a comparison against a moving object.
  //
  // Derived from PLAN_START rather than the anchored week-1 date because
  // generation needs it before a week-1 date exists. Anchoring can shift the
  // effective gap by a few days; both sides shift together, which is the
  // property that matters here.
  const gapDaysForPlan = ((input as Record<string, unknown>).__foundationGapDays as number) ?? 0
  const today = new Date(new Date(`${PLAN_START}T00:00:00Z`).getTime() - gapDaysForPlan * 86_400_000)
    .toISOString().slice(0, 10)
  try {
    // PLAN_START passed EXPLICITLY — see the note at the top of this file. This
    // argument is the difference between a sweep and a very fast no-op.
    planTier = pick(tiers)
    plan = generateRulePlan(input, planTier, PLAN_START, undefined, today)
  } catch (e) {
    const full = e instanceof Error ? e.message : String(e)
    const msg = full.split('\n')[0]
    if (REFUSAL.test(msg)) { refused++; continue }
    hardFailures++
    // Report the VIOLATION LINES, not just the header. `validatePlan` throws with
    // "Plan invariant violations:" on line 1 and the actual codes underneath, so
    // taking `split('\n')[0]` printed a failure with no diagnosis in it — the
    // reader then has to rebuild the failing input by hand from three grid
    // columns. Keep the first few violation lines; they are what names the rule.
    if (hardFailureSamples.length < 5) {
      hardFailureSamples.push({ input, message: full.split('\n').slice(0, 4).join('\n      ') })
    }
    continue
  }
  generated++

  // ADR-020 Option A — the sweep now exercises the exact server code path:
  // composePlanWithFoundation is the single owner of plan.weeks mutation
  // post-generation, the same function /api/generate-plan calls. Forces
  // decision 'add' so coverage continues exercising the 'choice' band the way
  // it always intended (a runner who picked "Add Foundation Block"), not just
  // the 'auto' band — and validates the plan the RUNNER gets, not just the
  // engine's foundation-free output.
  //
  // NOTE: __foundationGapDays values are [0, 10, 24, 40] — none land in the
  // 1-6 day 'none' band by coincidence. If a future corner value did, coverage
  // would silently narrow here with no signal. CORNERS (unlike randomInput())
  // never set this field at all — default to 0 (gapClass 'none', a no-op),
  // not undefined (which produced NaN dates and crashed the sweep).
  // `today` and `gapDaysForPlan` are computed above, before generation.
  // Honour the swept decision rather than hardcoding 'add' — that hardcode is
  // what made `skip`/`start_now` unreachable (found by the coverage gate).
  // CORNERS never set it, so they keep the historical 'add' behaviour.
  const composed = composePlanWithFoundation(plan, input, today, input.foundation_decision ?? 'add')
  plan = composed.plan
  const fbWeekCount = plan.weeks.filter(w => w.n <= 0).length
  if (fbWeekCount) {
    foundationPlans++
    foundationWeeks += fbWeekCount
  }

  const errors = composed.violations.filter(v => v.severity === 'error')

  if (SCORE) {
    const warnCodes = new Set(composed.violations.filter(v => v.severity === 'warn').map(v => v.code))
    scScored++
    if (errors.length === 0) scErrFree++
    if (warnCodes.size === 0) scWarnFree++
    if (errors.length === 0 && warnCodes.size === 0) scBoth++
    // Plans (not violations) carrying each warn code — the sweep's existing
    // firing-rate table counts occurrences, which double-counts a plan that
    // trips the same rule in several weeks.
    for (const c of Array.from(warnCodes)) scWarnPlansByCode.set(c, (scWarnPlansByCode.get(c) ?? 0) + 1)

    const m = composed.plan.meta as unknown as Record<string, unknown>
    const declared = Boolean(m.volume_constraint_note) || m.volume_profile === 'maintenance'

    {
      // Structural failures — a plan being WRONG, not merely limited.
      const structural: string[] = []
      if (warnCodes.has('INV-PLAN-NOT-DETRAINING')) structural.push('detraining')
      if (warnCodes.has('INV-PLAN-PEAK-IN-PEAK-PHASE')) structural.push('peak not in peak phase')
      // A residual the constitution ratifies. §106's shortfall is the big one;
      // the rest are the absorbed-warn family (§34).
      const hasResidual = warnCodes.size > 0
      // ⚠️ THE BAR: a declaration must name the SPECIFIC shortfall, not merely
      // report that the plan is demanding. `difficulty_note` was accepted in the
      // gauge's first cut and carried 11.3% of CONSTRAINED on its own -- 5.6pp of
      // the headline. It says "your inputs cap how far the plan can build", which
      // names a cause and a lever but NOT what the runner is actually missing.
      // §34's obligation is that the RESIDUAL is declared, and a generic
      // difficulty label does not discharge it.
      const anyDeclared = declared
        || Boolean(m.long_run_shortfall_note) || Boolean(m.uncovered_runway_note)
        || Boolean(m.peak_shortfall_note) || Boolean(m.load_residual_note)
      if (errors.length > 0) { gFailing++; gFailReason.set('error violation', (gFailReason.get('error violation') ?? 0) + 1) }
      else if (structural.length > 0) { gFailing++; gFailReason.set(`structural: ${structural[0]}`, (gFailReason.get(`structural: ${structural[0]}`) ?? 0) + 1) }
      else if (!hasResidual) gClean++
      else if (anyDeclared) {
        gConstrained++
        const src = declared ? 'volume_constraint_note / maintenance'
          : m.long_run_shortfall_note ? 'long_run_shortfall_note'
          : m.uncovered_runway_note ? 'uncovered_runway_note'
          : m.peak_shortfall_note ? 'peak_shortfall_note (NEW)'
          : m.load_residual_note ? 'load_residual_note (NEW)'
          : 'UNREACHABLE — difficulty_note no longer counts'
        gDeclSrc.set(src, (gDeclSrc.get(src) ?? 0) + 1)
      }
      else {
        gFailing++
        gFailReason.set('residual NOT declared', (gFailReason.get('residual NOT declared') ?? 0) + 1)
        for (const c of Array.from(warnCodes)) gUndeclaredCodes.set(c, (gUndeclaredCodes.get(c) ?? 0) + 1)
      }
    }
    const mainW = composed.plan.weeks.filter(w => w.n >= 1)
    // §110's hard_pref_note claims "keeps one a week at most" — does the plan
    // actually DELIVER any quality? A note describing training the runner does
    // not get is the claim/computation mismatch class.
    if ((input as { hard_session_relationship?: string }).hard_session_relationship === 'avoid'
      && (m as Record<string, unknown>).hard_pref_note) {
      const q = mainW.flatMap(w => Object.values(w.sessions ?? {}).filter(Boolean) as Array<{ type?: string }>)
        .filter(sn => sn.type === 'quality').length
      // Measure the CLAIM against the delivery, not the note's existence. The
      // first cut of this probe counted "note present + zero quality" and so
      // could not see the fix at all -- both the true and the false wording
      // are present notes.
      const txt = String((m as Record<string, unknown>).hard_pref_note ?? '')
      const claimsACap = /keeps one a week/i.test(txt)
      if (q === 0 && claimsACap) hprLie++
      else hprOk++
    }
    // §107 regression probe — which runners newly trip the two volume-shape
    // checks, split by the input §107 actually changed.
    for (const c of ['INV-PLAN-PEAK-IN-PEAK-PHASE', 'INV-PLAN-NOT-DETRAINING']) {
      if (warnCodes.has(c)) {
        const h = (input as { hard_session_relationship?: string }).hard_session_relationship ?? 'unset'
        regSplit.set(`${c} / ${h}`, (regSplit.get(`${c} / ${h}`) ?? 0) + 1)
      }
    }

      const reasons: string[] = []
      if (errors.length > 0) reasons.push('has an error violation')
      if (warnCodes.has('INV-PLAN-NOT-DETRAINING')) reasons.push('detrains the runner')
      if (warnCodes.has('INV-PLAN-PEAK-IN-PEAK-PHASE')) reasons.push('peak phase is not the peak')
      // Board on T2: "56% of target peak" and "zero quality against a declared focus".
      const tgt = Number((m as Record<string, unknown>).peak_km_target ?? 0)
      const trainW2 = mainW.filter((w: { sessions?: Record<string, unknown> }) =>
        !Object.values(w.sessions ?? {}).some(sn => (sn as { type?: string } | undefined)?.type === 'race'))
      const pk3 = trainW2.length ? Math.max(...trainW2.map((w: { weekly_km?: number }) => w.weekly_km ?? 0)) : 0
      if (tgt > 0 && pk3 > 0 && pk3 < tgt * 0.75) {
        // §40c / VOL-SHORTFALL-01 (Coaching Board 2026-08-20, unanimous):
        // "The engine was RIGHT -- the life-first cap must win; the defect was
        // SILENCE." So a peak shortfall is NOT a fitness failure in itself. An
        // earlier cut of this gauge scored the raw shortfall and reported 25.6%
        // fit for purpose -- it was testing, as a defect, the outcome the
        // constitution ratifies. Only an UNDECLARED shortfall fails here.
        const dv = (input as { days_available?: number }).days_available ?? 0
        const cp = (input as { max_weekday_mins?: number }).max_weekday_mins
        const injc = (((input as { injury_history?: string[] }).injury_history) ?? []).some(i => /knee|shin/i.test(i))
        const stated = (input as { current_weekly_km?: number }).current_weekly_km ?? 0
        // Is the TARGET itself unreachable from where the runner starts, given
        // the plan length and §2's 10%/wk cap? That is an engine problem, not a
        // runner constraint.
        const weeksAvail = Math.max(1, mainW.length - 4)
        const reachable = stated * Math.pow(1.10, weeksAvail)
        const cause = injc ? 'INJ: §12 5%/wk cap cannot reach it'
          : dv <= 3 ? 'DAYS: 3 or fewer running days'
          : cp != null && cp <= 45 ? 'TIME: weekday ceiling <=45min'
          : tgt > reachable ? 'TARGET: unreachable from start at 10%/wk — ENGINE'
          : 'OTHER — ENGINE'
        peakShortCause.set(cause, (peakShortCause.get(cause) ?? 0) + 1)
        // §40c / VOL-SHORTFALL-01 (Coaching Board 2026-08-20, unanimous): a
        // life-first cap WINNING is correct; the defect is silence. Measure the
        // split before deciding whether this criterion is testing a defect.
        const mm = m as Record<string, unknown>
        const declared = !!(mm.volume_shortfall_note || mm.volume_constraint_note
          || mm.long_run_shortfall_note || mm.peak_shortfall_note || mm.load_residual_note)
        if (declared) psDeclared++
        else {
          psSilent++
          reasons.push('peak below 75% of target and SAYS NOTHING (§40c)')
          // FULL input, not a summary. A hand-rebuilt approximation of a
          // summary line does not reproduce the plan -- tried it, got a plan
          // that DID carry the note, and briefly "found" a defect that was my
          // own harness. Dump what generated it.
          if (psEg.length < 5) psEg.push(JSON.stringify(input))
        }
      }
      const runs3 = mainW.flatMap((w: { sessions?: Record<string, unknown> }) =>
        Object.values(w.sessions ?? {}).filter(Boolean) as Array<{ type: string }>)
      const q3 = runs3.filter(sn => ['quality', 'intervals', 'tempo', 'hard'].includes(sn.type)).length
      if (q3 === 0 && mainW.length >= 8) {
        // NOTE the ordering: `cause` is computed first because the criterion
        // depends on it. CoachingPrinciples line 3154 (2026-08-30 ruling) is
        // explicit -- "A genuine beginner ... still gets no quality sessions,
        // and that remains correct. The classifier was the defect, not the
        // ceiling." So zero quality is only a FITNESS failure for a runner the
        // engine does NOT classify beginner. Scoring the ratified case as a
        // defect is the same error this gauge already made with §40c.
        // Split by the MECHANISM in buildWeekSessions, not by inputs. The input
        // -based cut left 695 "unexplained" because several inputs funnel into
        // one code path. Quality is zero iff min(plannedQuality, fitnessCeiling)
        // is 0, and there are exactly three ways in:
        //   (1) fitnessCeiling  -- QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0
        //   (2) suppressQuality -- hard_session_relationship 'avoid' | achilles
        //   (3) plannedQuality  -- no build/peak/taper week ever asks for one
        // §79 sets primary_metric 'duration' iff intensityFitness is beginner
        // (or ultra), so the engine's own stamp reads (1) with no second
        // classifier -- the drift class this repo has already been bitten by.
        const dist0 = (input as { race_distance_km?: number }).race_distance_km ?? 0
        // §79 sets primary_metric 'duration' for beginner OR ultra, so for an
        // ultra the stamp cannot separate the two. The three causes above are
        // EXHAUSTIVE, so an ultra that is not suppressed and does have build or
        // peak weeks (i.e. plannedQuality did ask for one) can only be the
        // ceiling. Deduced from the code's own exhaustion, not re-classified.
        const hasBuildOrPeak = mainW.some((w: { phase?: string }) => w.phase === 'build' || w.phase === 'peak')
        const beginnerCeiling = m.primary_metric === 'duration' && (dist0 < 50 || hasBuildOrPeak)
        const avoidS = (input as { hard_session_relationship?: string }).hard_session_relationship === 'avoid'
        const achilS = (((input as { injury_history?: string[] }).injury_history) ?? []).some(i => /achilles/i.test(i))
        const suppressed = avoidS || achilS
        if (suppressed && !beginnerCeiling) {
          supSplit.set(achilS && avoidS ? 'both' : achilS ? 'achilles only (§21 says SUBSTITUTE)' : 'avoid only',
            (supSplit.get(achilS && avoidS ? 'both' : achilS ? 'achilles only (§21 says SUBSTITUTE)' : 'avoid only') ?? 0) + 1)
        }
        const cause = beginnerCeiling && suppressed ? 'BOTH: beginner ceiling AND suppression'
          : beginnerCeiling ? '1 CEILING: QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0 (§ ratified 3154)'
          : suppressed ? '2 SUPPRESS: avoid / achilles -> plannedQuality = 0 (the T2 class)'
          : '3 SHAPE: no week ever planned one'
        zeroQCause.set(cause, (zeroQCause.get(cause) ?? 0) + 1)
        if (!beginnerCeiling) reasons.push('zero quality, and the runner is NOT a beginner')
        if (cause.startsWith('3 ') && zqEg.length < 4) {
          zqEg.push(`weeks=${mainW.length} dist=${(input as {race_distance_km?:number}).race_distance_km} days=${(input as {days_available?:number}).days_available} ` +
            `lvl=${(input as {fitness_level?:string}).fitness_level ?? '-'}/${(input as {user_declared_level?:string}).user_declared_level ?? '-'} ` +
            `ta=${(input as {training_age?:string}).training_age ?? '-'} rq=${(input as {recent_quality_training?:string}).recent_quality_training ?? '-'} ` +
            `cwk=${(input as {current_weekly_km?:number}).current_weekly_km} prof=${String(m.volume_profile)} hsr=${(input as {hard_session_relationship?:string}).hard_session_relationship ?? '-'}`)
        }
      }
      if (reasons.length === 0) fitOk++
      else for (const r of reasons) fitFail.set(r, (fitFail.get(r) ?? 0) + 1)

    const trainW = mainW.filter(w => !Object.values(w.sessions ?? {})
      .some(sn => (sn as { type?: string } | undefined)?.type === 'race'))
    const wk1 = trainW[0]?.weekly_km ?? 0
    const pk = trainW.length ? Math.max(...trainW.map(w => w.weekly_km ?? 0)) : 0
    if (wk1 > 0 && pk <= wk1) {
      scNoProgress++
      if (declared) scNoProgressDeclared++; else scNoProgressSilent++
    }
    // M5's shape specifically: the plan does not merely fail to rise, it FALLS.
    // Lowest training week below 75% of week 1 = a detraining block.
    // Recompute §106's own comparison with race week EXCLUDED.
    const declaredKm = (input as { current_weekly_km?: number }).current_weekly_km ?? 0
    const nonFoundNoRace = composed.plan.weeks.filter(w =>
      w.phase !== 'foundation' && w.type !== 'deload' &&
      !Object.values(w.sessions ?? {}).some(sn => (sn as { type?: string } | undefined)?.type === 'race'))
    const peakNoRace = nonFoundNoRace.length ? Math.max(...nonFoundNoRace.map(w => w.weekly_km ?? 0)) : 0
    const firesInv = warnCodes.has('INV-PLAN-PEAK-NOT-BELOW-START')
    if (!firesInv && declaredKm > 0 && peakNoRace > 0 && peakNoRace + 0.5 < declaredKm) scMaskedByRaceWeek++
    const noProg = wk1 > 0 && pk <= wk1
    if (firesInv) {
      scFiresInv++
      if (noProg) scFiresInvAndDescends++; else scFiresInvButProgresses++
    } else if (noProg) scDescendsNoInv++
    const progAll = trainW.filter(w =>
      w.badge !== 'deload' && w.type !== 'deload' && w.phase !== 'taper')
    const loAll = progAll.length ? Math.min(...progAll.map(w => w.weekly_km ?? 0)) : 0
    if (wk1 > 0 && loAll > 0) {
      const dropAll = (wk1 - loAll) / wk1 * 100
      scAllDrop.push(dropAll)
      if (dropAll >= 30) {
        scAllDrop30++
        if (/hold your fitness|maintains your fitness/i.test(String(m.volume_constraint_note ?? ''))) scAllDrop30Claimed++
        else scAllDrop30Silent++
      }
    }
    if (progAll.length >= 4 && wk1 > 0 && loAll > 0) {
      const first3 = progAll.slice(0, 3).map(w => w.weekly_km ?? 0).sort((a, b) => a - b)
      const med3 = first3[1]
      if (med3 > 0) {
        if (wk1 > med3 * 1.15) scW1Spike++
        if ((wk1 - loAll) / wk1 * 100 > 30) scFiresFromW1++
        if ((med3 - loAll) / med3 * 100 > 30) scFiresFromMed++
      }
    }
    if (progAll.length >= 4 && wk1 > 0 && loAll > 0) {
      const inj = ((input as { injury_history?: string[] }).injury_history ?? []).length > 0
      const masters = ((input as { age?: number }).age ?? 0) >= 45
      const key = `${inj ? 'INJURY ' : 'healthy'} ${masters ? 'masters(3wk)' : 'standard(4wk)'}`
      const cur = scRatchet.get(key) ?? { n: 0, decl: 0, fired: 0 }
      cur.n++
      cur.decl += (wk1 - loAll) / wk1 * 100
      if ((wk1 - loAll) / wk1 * 100 > 30) cur.fired++
      scRatchet.set(key, cur)
    }
    {
      const detr = wk1 > 0 && loAll > 0 && ((wk1 - loAll) / wk1 * 100) > 30
      const AERO = new Set(['easy', 'recovery', 'rest', 'race', 'cross_train', 'strength'])
      const lastBase = [...progAll.filter(w => w.phase === 'base')].pop()
      const firstQ = progAll.find(w => w.phase !== 'base' &&
        Object.values(w.sessions ?? {}).some(sn => sn && !AERO.has((sn as { type: string }).type)))
      if (lastBase && firstQ) {
        const kmOf = (sn: unknown) => (sn as { distance_km?: number })?.distance_km ?? 0
        const qs = Object.values(firstQ.sessions ?? {}).filter(sn => sn && !AERO.has((sn as { type: string }).type))
        const es = Object.values(lastBase.sessions ?? {}).filter(sn => (sn as { type?: string })?.type === 'easy')
        if (qs.length && es.length) {
          const days = (input as { days_available?: number }).days_available ?? 0
          const dk = (input as { race_distance_km?: number }).race_distance_km ?? 0
          const dl = dk <= 12 ? '10K' : dk <= 22 ? 'HM' : dk <= 43 ? 'MAR' : 'ULTRA'
          const key = `${detr ? 'DETRAIN' : 'healthy'} ${dl} ${days}d`
          const cur = scDisp.get(key) ?? { n: 0, q: 0, e: 0, step: 0 }
          cur.n++
          cur.q += qs.reduce((a, sn) => a + kmOf(sn), 0) / qs.length
          cur.e += es.reduce((a, sn) => a + kmOf(sn), 0) / es.length
          cur.step += (firstQ.weekly_km ?? 0) - (lastBase.weekly_km ?? 0)
          scDisp.set(key, cur)
        }
      }
    }
    if (m.volume_profile === 'maintenance') {
      scMaintPlans++
      const runs = mainW.flatMap((w: { sessions?: Record<string, unknown> }) => Object.values(w.sessions ?? {}).filter(Boolean) as Array<{ type: string }>)
        .filter(sn => !['rest', 'race', 'strength', 'cross-train', 'cross_train'].includes(sn.type))
      const qn = runs.filter(sn => ['quality', 'intervals', 'tempo', 'hard'].includes(sn.type)).length
      const dk = (input as { race_distance_km?: number }).race_distance_km ?? 0
      const key = dk <= 6 ? '5K' : dk <= 12 ? '10K' : dk <= 22 ? 'HM' : dk <= 43 ? 'MARATHON' : dk <= 55 ? '50K' : '100K'
      const ceil = (GENERATION_CONFIG.INTENSITY_DISTRIBUTION as Record<string, { max_quality_session_pct: number }>)[key]?.max_quality_session_pct
      if (runs.length && ceil != null) {
        const sh = qn / runs.length * 100
        if (sh > ceil) { scSilent1++; scSilent1Over.push(sh - ceil) }
        if (qn === 0) scSilent1AllEasy++
      }
    }
    if (warnCodes.has('INV-PLAN-PEAK-NOT-BELOW-START')) {
      const declaredKm2 = (input as { current_weekly_km?: number }).current_weekly_km ?? 0
      const days2 = (input as { days_available?: number }).days_available ?? 0
      const cap2 = (input as { max_weekday_mins?: number }).max_weekday_mins
      const nf = composed.plan.weeks.filter(w =>
        w.phase !== 'foundation' && w.type !== 'deload' && w.type !== 'race' &&
        !Object.values(w.sessions ?? {}).some(sn => (sn as { type?: string } | undefined)?.type === 'race'))
      const pk2 = nf.length ? Math.max(...nf.map(w => w.weekly_km ?? 0)) : 0
      // Which constraint plausibly binds? §23/§46 name days_available and
      // max_weekday_mins explicitly as legitimate reasons a plan cannot overload.
      const lowDays = days2 > 0 && days2 <= 3
      const tightCap = cap2 != null && cap2 <= 45
      // ⚠️ THE FIRST SPLIT WAS TOO NARROW and mislabelled a quarter of the
      // firings as "ours". §23/§46 name days_available and max_weekday_mins, but
      // they are not the only LEGITIMATE reasons a plan cannot reach the stated
      // volume: §12's injury cap limits growth to 5%/week, and §10/CD-6 refuses
      // to believe a `<6mo` runner's self-reported volume at all
      // (BEGINNER_WEEK1_VOLUME_CAP_KM). A shin-splints runner claiming 60 km/wk
      // on a `<6mo` training age is capped by BOTH, and the plan peaking at 31 km
      // is those rules working, not §106 failing.
      const injCapped = (((input as { injury_history?: string[] }).injury_history) ?? [])
        .some(i => /knee|shin/i.test(i))
      const overClaim = (input as { training_age?: string }).training_age === '<6mo'
      const key = injCapped ? '§12 injury cap (5%/wk)'
        : overClaim ? '§10 <6mo over-claim cap'
        : lowDays && tightCap ? 'days<=3 AND cap<=45'
        : lowDays ? 'days<=3 only'
        : tightCap ? 'cap<=45 only'
        : 'NONE OF THE ABOVE — ours'
      if (key === 'NONE OF THE ABOVE — ours' && process.env.SWEEP_PEAK_EG === '1' && scPeakEg.length < 3) {
        scPeakEg.push(`stated=${declaredKm2} peak=${pk2} days=${days2} cap=${cap2 ?? 'none'} ` +
          `weeks=${composed.plan.weeks.filter(w => w.n >= 1).length} profile=${String((composed.plan.meta as unknown as Record<string, unknown>).volume_profile)} ` +
          `input=${JSON.stringify(input).slice(0, 430)}`)
      }
      {
        const declaredNote = Boolean((composed.plan.meta as unknown as Record<string, unknown>).volume_constraint_note)
          || (composed.plan.meta as unknown as Record<string, unknown>).volume_profile === 'maintenance'
          || Boolean((composed.plan.meta as unknown as Record<string, unknown>).difficulty_note)
        if (key !== 'NONE OF THE ABOVE — ours') {
          scConstrained++
          if (declaredNote) scConstrainedDeclared++
        } else if (!declaredNote) scOursUndeclared++
      }
      const cur = scPeakShort.get(key) ?? { n: 0, gap: 0 }
      cur.n++
      cur.gap += declaredKm2 > 0 ? (declaredKm2 - pk2) / declaredKm2 * 100 : 0
      scPeakShort.set(key, cur)
    }
    const noteTxt = String(m.volume_constraint_note ?? '')
    if (/hold your fitness|maintains your fitness/i.test(noteTxt)) {
      scMaintClaim++
      // DELOADS EXCLUDED. A deload week is SUPPOSED to be ~70% of the prior
      // week (§3), so counting it as "the plan fell" measures the deload, not
      // the trajectory. Same denominator trap that made a race week look like a
      // peak twice this week. Compare week 1 against the lowest PROGRESSIVE week.
      // TAPER EXCLUDED TOO. A taper is a PLANNED decline (§6) and counting it
      // measures the taper, not a defect: M5's lowest week (15 km) is a taper
      // week, while its actual problem is build weeks 9-10 at 18 km against a
      // week 1 of 43. Third denominator trap of the day -- race week, then
      // deloads, now the taper. Decline is only ever illegitimate across
      // base/build/peak, which is where the plan is supposed to be RISING.
      const prog = trainW.filter(w =>
        w.badge !== 'deload' && w.type !== 'deload' && w.phase !== 'taper')
      const lo = prog.length ? Math.min(...prog.map(w => w.weekly_km ?? 0)) : 0
      if (wk1 > 0 && lo > 0) scMaintDrop.push((wk1 - lo) / wk1 * 100)
    }
    const lowest = trainW.length ? Math.min(...trainW.map(w => w.weekly_km ?? 0)) : 0
    if (wk1 > 0 && lowest < wk1 * 0.75 && pk <= wk1) {
      scDescending++
      if (!declared) scDescendingSilent++
    }
  }

  // EXPLAIN SEES WARNS TOO (2026-09-15). It used to sit inside the
  // `errors.length > 0` branch, so `SWEEP_EXPLAIN=<a warn code>` printed nothing
  // and reported nothing — which is backwards. A warn is the violation you MOST
  // need to triage: an error blocks the build and gets fixed immediately, while
  // a warn is deliberately tracked and lives for weeks. Triaging
  // INV-PLAN-PEAK-LR-EARNED-TIER (10 plans in 15,973) meant hand-building three
  // separate grids, none of which reproduced it, because the only tool that
  // could name the shape refused to look at it.
  if (EXPLAIN && explained.length < 5) {
    for (const v of composed.violations.filter(e => e.code === EXPLAIN)) {
      explained.push(
        `  [${v.severity}] ${v.message}\n     week ${v.week}${v.day ? ' ' + v.day : ''} — got ${v.actual}, expected ${v.expected}` +
        `\n     plan_start: ${PLAN_START}   tier: ${planTier}   volume_profile: ${plan.meta?.volume_profile ?? '-'}` +
        `\n     input: ${JSON.stringify(input)}`)
      break
    }
  }

  if (errors.length > 0) {
    violatingPlans++
    if (false) {
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
  // NOISE-GATE-01 — count PLANS where each warn fires (once per plan, not once
  // per week-instance — the §94 standard is "fired on 44.4% of PLANS", so the
  // denominator is plans and a plan with five week-instances still counts once).
  const warnCodesThisPlan = Array.from(new Set(
    composed.violations.filter(v => v.severity === 'warn').map(v => v.code)))
  for (const code of warnCodesThisPlan) warnByCode.set(code, (warnByCode.get(code) ?? 0) + 1)
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
  // ── §52 lopsided week, UNMASKED (not caused) by COMPLIANCE-FIX-2, 2026-09-16 ──
  //
  // 2 plans in 15,973. REVEALED, not introduced, and the mechanism is traced
  // rather than assumed — reproduced on the exact failing input (100km, knee
  // history, 4 days, days_cannot_train tue/thu):
  //
  //     max_weekday_mins=30   profile=build        week 23 = 39km   1 error
  //     max_weekday_mins=60   profile=maintenance  week 23 = 42km   0
  //     max_weekday_mins=none profile=build        week 23 = 58km   0
  //
  // `lopsidedWeek` (§52's third remedy, ruleEngine) evaluates BEFORE the
  // weekday-cap pass trims easy runs. At a 30-minute cap the week falls 58 -> 39
  // km while the long run is race-anchored and §52-exempt, so its share crosses
  // 60% AFTER the producer has already decided the week is not lopsided. Producer
  // ordering, entirely independent of deload depth.
  //
  // COMPLIANCE-FIX-2's only involvement: these plans used to detrain, which made
  // them `maintenance`, which exempted them from this cap. Stopping the
  // detraining removed the label and the pre-existing breach surfaced.
  //
  // NOT FIXED HERE DELIBERATELY. Re-ordering or re-scoping `lopsidedWeek` has a
  // recorded history of backfiring: on 2026-09-15 excluding taper weeks from it
  // "looked obviously right", stripped 24 plans of the maintenance label and
  // turned an absorbed warn into a hard failure. It was reverted. That change
  // needs its own measurement, not a ride-along. Filed as LOPSIDED-ORDER-01.

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
  // it.
  // 924 -> 0 (CoachingPrinciples §82, Coaching Board 2026-09-03, unanimous).
  // The "low-volume main weeks, unrelated to the cap" attribution above was
  // WRONG — the same class of error as SC-05 earlier that day (confirm the
  // satisfying case, never infer from the failure). Every sampled violation
  // read "got 3.5, expected 4" at max_weekday_mins:30: `applyWeekdayMinsCap`
  // scaling an easy run's distance below MIN_SESSION_DISTANCE_KM.easy with no
  // floor check. The engine now holds the session at the floor instead —
  // duration exceeds the stated cap by a few minutes rather than shipping a
  // session too short to be coaching-meaningful — and declares maintenance
  // when it recurs across 2+ weeks (INV-PLAN-EASY-FLOOR-PROTECTION-DECLARED).
  // Kept as an explicit 0 so a regression reads as NEW against a stated
  // expectation. SWEEP-VISIBLE-01 closed.
  // 0 -> 1426 (2026-09-04) — NOT a regression, and not caused by any engine
  // change. The INPUT-COVERAGE GATE added `weeks_at_current_volume` to the grid,
  // a field declared on GeneratorInput since M-02 and never once set by this
  // sweep. Below FRESH_RETURN_WEEKS_THRESHOLD (8) it flips §29's fresh-from-
  // layoff path, which treats `current_weekly_km` as ASPIRATIONAL and starts the
  // plan at a fraction of it. At 5 km/week that fraction produces a FOUNDATION
  // week whose easy run is 3.5 km against MIN_SESSION_DISTANCE_KM.easy of 4.
  //
  // Attribution measured, not assumed: the same input with the field REMOVED
  // scores 0, and all three `foundation_decision` values score identically, so
  // the fresh-return axis is the whole cause and the foundation decision is not
  // implicated. 660 of 16,141 plans (~4.1%).
  //
  // Same family as §52b (a training day must be able to carry a real session)
  // and the `goal_pace_sharpener` floor protection: a floor a valid input cannot
  // satisfy is a defect in the code enforcing it, not an acceptable session
  // (D-21). Fixing it is a coaching decision about what a fresh-return week at
  // 5 km/week should contain — filed as FRESH-FLOOR-01, not taken here.
  //
  // 1426 -> 0 (FRESH-FLOOR-01, same day). `foundationBlock`'s no-long-run branch
  // forced at least one session (correctly — a foundation week is never empty)
  // and then sized it as the whole week, so a week SMALLER than one session's
  // floor shipped a session under it. §52b had nothing left to give: it reduces
  // days, and one day is the minimum. Now held at MIN_SESSION_DISTANCE_KM.easy,
  // the remedy §82 already ruled for the weekday cap — exceed the budget by a
  // little rather than ship a session that trains nothing (§9).
  //
  // The entry is kept rather than deleted: it records that the input-coverage
  // gate paid for itself on its first run, surfacing 1,426 real violations that
  // had been unreachable since M-02 declared `weeks_at_current_volume`.
  'INV-PLAN-MIN-SESSION-SIZE':             0,

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
  // ⚠️ 0 -> 2 (2026-09-16, COMPLIANCE-FIX-2). UNMASKED, not introduced. Traced on
  // the exact failing input (100km, knee, 4 days, tue/thu blocked):
  //     max_weekday_mins=30   profile=build        week 23 = 39km   1 error
  //     max_weekday_mins=60   profile=maintenance  week 23 = 42km   0
  //     max_weekday_mins=none profile=build        week 23 = 58km   0
  // `lopsidedWeek` (§52's third remedy) evaluates BEFORE the weekday-cap pass
  // trims easy runs, so at a 30-min cap the week falls 58 -> 39 km while the long
  // run is race-anchored and §52-exempt, and its share crosses 60% after the
  // producer has already decided the week is fine. Producer ordering, independent
  // of deload depth. These plans previously DETRAINED, which made them
  // `maintenance`, which exempted them from this cap; stopping the detraining
  // removed the label and the pre-existing breach surfaced.
  // NOT fixed here on purpose — re-scoping `lopsidedWeek` backfired on 2026-09-15
  // (stripped 24 plans of maintenance, turned an absorbed warn into a hard
  // failure, reverted). Filed LOPSIDED-ORDER-01.
  'INV-PLAN-LR-MAX-WEEKLY-PCT':          2,
  // 0 -> 1 (2026-09-10, INTENSITY-FOUNDATION-BLIND-02). NOT a regression from
  // this change and NOT a false positive: it is the first DELIVERED-plan §1
  // breach this sweep has ever been able to see.
  //
  // Until today generation read the wall clock while PLAN_START stayed pinned to
  // a past date, so every swept plan was generated at gap 0 — no foundation
  // weeks planned, full base phase — and then composed with a 3-week block
  // anyway. Passing `today` into generation put both halves on one calendar, and
  // the plan shapes it now produces are the ones production actually builds.
  //
  // Confirmed live under pure production semantics (real wall clock, no
  // override): marathon / intermediate / 4 days / 60 km, plan_start 24 days out.
  // §91 credits the 2 foundation weeks against the base on-ramp, base collapses
  // to ZERO weeks, quality starts in week 1, and the delivered plan lands at
  // 19.0% (15/79) against MARATHON's 18% ceiling.
  //
  // Baselined rather than fixed because the fix is a PRESCRIPTION decision —
  // whether §91's credit may spend §1's headroom, and whether all-easy §57 weeks
  // should dilute the §1 denominator at all — which belongs to the Coaching
  // Board, not to a checker-accuracy commit. Filed as FOUNDATION-ONSET-01.
  // A baseline is a debt register, not an amnesty: this must go DOWN.
  // 1 -> 2 (2026-09-10, Coaching Board CB-FOUNDATION-DENOM-01).
  //
  // 2 -> 0, DEBT PAID (2026-09-10, Coaching Board CB-ONSET-YIELD-01, §98).
  // Both entries were the same underlying defect, and it was NOT §91's credit as
  // filed: measured, §89's early onset breaches §1 on its own (29 breaches with
  // the gate open, 0 with it closed, and 11 of the 29 carried no foundation block
  // at all). §98's yield ladder trims the onset until the plan complies — bounded
  // by the on-ramp an ungated runner would get — so the breach is now impossible
  // by construction rather than tolerated here. Deterministic regressions live in
  // `onsetYieldLadder.test.ts` (falsification-tested: 12 of 13 go red when the
  // ladder is disabled). If this ever needs raising again, §98 has regressed.
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

// ── NOISE-GATE-01 — a `warn` invariant firing on too much of the grid is noise ──
//
// §1 records the standard (Willy): "an error firing on 71% of a distance's plans
// is not a safety mechanism — it is noise, and noise gets suppressed, which is how
// a real violation gets missed later." That was written down and unenforced. A
// `warn` is worse than an `error` here: errors regress the run and get seen, warns
// were counted by nothing. §94's INV-PLAN-DELIVERED-RAMP shipped firing on 44.4%
// of the grid (worst 114%) and was almost entirely noise; it was caught by someone
// choosing to measure. This gate measures for them.
//
// A rate above the threshold FAILS until it is either scoped down or acknowledged
// here with a reason — the debt-register discipline of configPrincipleSync/BASELINE.
// Acknowledgement is not amnesty: it records that a human looked and decided the
// rate is the honest residual, not a mis-scoped check.
// 30% sits between the current honest residuals (the two highest, PEAK-IN-PEAK and
// INJURY-CAP-DELIVERED, both documented board-scoped known-opens, sit at ~23%) and
// the noise band (§94's INV-PLAN-DELIVERED-RAMP shipped at 44.4%; Willy's example was
// 71%). It gives real residuals headroom while catching a genuinely mis-scoped check.
const NOISE_THRESHOLD_PCT = 30
// ONLY codes genuinely ABOVE the threshold whose rate a human has confirmed is the
// honest residual belong here — acknowledgement EXEMPTS a code from the gate, so a
// sub-threshold code must NOT be listed (that would blind the gate to it regressing
// upward). Empty today: nothing fires above 30%.
// NOISE-GATE-01's escape hatch, and the FIRST entry ever added to it. The gate
// exists so a high firing rate has to be argued rather than absorbed, so an
// entry here is a claim that must stand up on its own.
const ACKNOWLEDGED_WARN_RATES: Record<string, string> = {
  // 31.6% (5055/15973), acknowledged 2026-09-16.
  //
  // THE RATE DID NOT RISE — A MASKING BUG WAS REMOVED. It read 28.1% while
  // `deliveredPeak` included RACE WEEK, so for a marathon the plan's "peak" was
  // the 42.2 km race and a detraining block cleared the floor. Excluding race
  // week added exactly the 574 plans that masking had hidden (measured before
  // the fix, via SWEEP_SCORE=1). 31.6% is the rate this check has always had;
  // 28.1% was the bug's reading, and re-scoping it back would be re-hiding them.
  //
  // WHY THE RESIDUAL IS HONEST RATHER THAN NOISE. Measured on the same run:
  // 22.3pp of the 31.6% are plans that progress perfectly well from week 1 but
  // never reach the volume the runner STATED — a 60 km/wk runner with 3 days and
  // a weekday cap gets built to ~45. That is §106's exact purpose ("a plan never
  // peaks below where the runner already is"), and firing there is the check
  // working, not misfiring. Every one of those plans carries a declaration:
  // no-progression plans are 100% declared, 0% silent.
  //
  // ⚠️ NOT A PERMANENT ACCEPTANCE. This is the single largest contributor to the
  // coaching-compliance gap (36.6% of plans are warn-free) and is the explicit
  // subject of the fix programme opened on 2026-09-16. It is acknowledged so the
  // gate does not block the fix that revealed it, and it is expected to FALL.
  // If it is still ~31% after that programme, the acceptance was wrong.
  'INV-PLAN-PEAK-NOT-BELOW-START':
    'True rate after removing race-week masking (was 28.1% with the bug). 22.3pp are constrained runners the check is MEANT to catch, all declared. Tracked to fall by the 2026-09-16 compliance programme.',
}
const noiseRates = Array.from(warnByCode.entries())
  .map(([code, n]) => ({ code, n, pct: (n / generated) * 100 }))
  .sort((a, b) => b.pct - a.pct)
if (noiseRates.length > 0) {
  console.log('Warn-invariant firing rates (NOISE-GATE-01):')
  for (const { code, n, pct } of noiseRates) {
    const ack = code in ACKNOWLEDGED_WARN_RATES ? ' (acknowledged)' : ''
    console.log(`  ${code}: ${pct.toFixed(1)}% (${n}/${generated})${ack}`)
  }
  console.log()
}
const noisy = noiseRates.filter(r => r.pct > NOISE_THRESHOLD_PCT && !(r.code in ACKNOWLEDGED_WARN_RATES))
if (noisy.length > 0) {
  console.error(`✗ NOISE-GATE-01 — warn invariant(s) firing above ${NOISE_THRESHOLD_PCT}% of the grid:`)
  for (const { code, pct, n } of noisy) {
    console.error(`  ${code}: ${pct.toFixed(1)}% (${n}/${generated}) — re-scope the check, or add it to ACKNOWLEDGED_WARN_RATES with why the rate is the honest residual.`)
  }
  process.exit(1)
}

console.log(`✓ ${generated} plans generated and validated (${foundationPlans} carried a foundation block, ${foundationWeeks} foundation weeks). No NEW violations above baseline.`)

if (SCORE) {
  const pct = (n: number) => `${(n / scScored * 100).toFixed(1)}%`
  console.log('\n== FIT FOR PURPOSE (the board\'s standard, not the honesty one) ==')
  console.log(`  FIT          ${fitOk}/${scScored}   ${(fitOk / scScored * 100).toFixed(1)}%`)
  console.log(`  NOT FIT      ${scScored - fitOk}  ${((scScored - fitOk) / scScored * 100).toFixed(1)}%   reasons (a plan can have several):`)
  for (const [r, n] of Array.from(fitFail.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(5)}  ${(n / scScored * 100).toFixed(1).padStart(5)}%  ${r}`)
  }
  for (const e of zqEg) console.log(`  D3 EG: ${e}`)
  console.log('\n  ROOT CAUSE — zero quality (7,087 plans):')
  for (const [c, n] of Array.from(zeroQCause.entries()).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(5)}  ${c}`)
  console.log('  ROOT CAUSE — peak below 75% of target (8,319 plans):')
  for (const [c, n] of Array.from(peakShortCause.entries()).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(5)}  ${c}`)
  console.log(`    peak-shortfall DECLARED (§40c satisfied): ${psDeclared}   SILENT: ${psSilent}`)
  for (const e of psEg) console.log(`      SILENT EG: ${e}`)
  console.log('  §107 REGRESSION PROBE — who trips the volume-shape checks:')
  for (const [c, n] of Array.from(regSplit.entries()).sort()) console.log(`      ${String(n).padStart(5)}  ${c}`)
  console.log(`  §110 NOTE HONESTY — 'avoid' notes whose CLAIM matches delivery: ${hprOk}, claim a cap but deliver ZERO: ${hprLie}`)
  console.log('  SUPPRESS split (non-beginner only):')
  for (const [c, n] of Array.from(supSplit.entries()).sort((a, b) => b[1] - a[1])) console.log(`      ${String(n).padStart(5)}  ${c}`)
  const acceptable = gClean + gConstrained
  console.log('\n══ COACHING COMPLIANCE GAUGE ══════════════════════════════════')
  console.log(`  ACCEPTABLE   ${acceptable}/${scScored}   ${(acceptable / scScored * 100).toFixed(1)}%   (target 95%)`)
  console.log(`    CLEAN        ${gClean}  ${(gClean / scScored * 100).toFixed(1)}%   no errors, no warns`)
  console.log(`    CONSTRAINED  ${gConstrained}  ${(gConstrained / scScored * 100).toFixed(1)}%   ratified residual, declared`)
  console.log(`  FAILING      ${gFailing}  ${(gFailing / scScored * 100).toFixed(1)}%`)
  for (const [r, n] of Array.from(gFailReason.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(5)}  ${r}`)
  }
  if (gUndeclaredCodes.size) {
    console.log('  WHICH residuals go undeclared (the work list):')
    for (const [c, n] of Array.from(gUndeclaredCodes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8)) {
      console.log(`      ${String(n).padStart(5)}  ${c}`)
    }
  }
  console.log('  what is doing the DECLARING in CONSTRAINED:')
  for (const [r, n] of Array.from(gDeclSrc.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(5)}  ${(n / gConstrained * 100).toFixed(1).padStart(5)}%  ${r}`)
  }
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('\n── detail (SWEEP_SCORE=1) ──')
  console.log(`  plans scored                 ${scScored}`)
  console.log(`  zero ERROR violations        ${scErrFree}  ${pct(scErrFree)}`)
  console.log(`  zero WARN violations         ${scWarnFree}  ${pct(scWarnFree)}`)
  console.log(`  zero errors AND zero warns   ${scBoth}  ${pct(scBoth)}   <-- the strict definition`)
  console.log(`\n  FIX 0 — do the two measures overlap?`)
  console.log(`    fires INV-PLAN-PEAK-NOT-BELOW-START        ${scFiresInv}  ${pct(scFiresInv)}`)
  console.log(`      ...AND peak <= week 1 (both agree)       ${scFiresInvAndDescends}  ${pct(scFiresInvAndDescends)}`)
  console.log(`      ...BUT plan DOES progress from week 1    ${scFiresInvButProgresses}  ${pct(scFiresInvButProgresses)}`)
  console.log(`    peak <= week 1 WITHOUT the invariant       ${scDescendsNoInv}  ${pct(scDescendsNoInv)}`)
  console.log(`\n  RACE-WEEK MASKING — plans §106 MISSES because race week inflates the peak:`)
  console.log(`    would fire if race week excluded           ${scMaskedByRaceWeek}  ${pct(scMaskedByRaceWeek)}`)
  if (scMaintClaim > 0) {
    const d = scMaintDrop.slice().sort((a, b) => a - b)
    const q = (f: number) => d[Math.min(d.length - 1, Math.floor(d.length * f))]
    const band = (lo: number, hi: number) => d.filter(x => x >= lo && x < hi).length
    console.log(`\n  FIX 1 — plans CLAIMING "hold/maintains your fitness": ${scMaintClaim}  ${pct(scMaintClaim)}`)
    console.log(`    delivered drop, week 1 -> lowest training week:`)
    console.log(`      median ${q(0.5).toFixed(0)}%   p90 ${q(0.9).toFixed(0)}%   worst ${d[d.length - 1].toFixed(0)}%`)
    console.log(`      drop <10% (genuinely holding)  ${band(-999, 10)}  ${(band(-999, 10) / d.length * 100).toFixed(1)}% of claimers`)
    console.log(`      drop 10-25%                    ${band(10, 25)}  ${(band(10, 25) / d.length * 100).toFixed(1)}%`)
    console.log(`      drop 25-40%                    ${band(25, 40)}  ${(band(25, 40) / d.length * 100).toFixed(1)}%`)
    console.log(`      drop >=40% (claim is FALSE)    ${band(40, 9999)}  ${(band(40, 9999) / d.length * 100).toFixed(1)}%`)
  }
  if (scAllDrop.length) {
    const a = scAllDrop.slice().sort((x, y) => x - y)
    const qa = (f: number) => a[Math.min(a.length - 1, Math.floor(a.length * f))]
    console.log(`\n  THRESHOLD — decline across base/build/peak, ALL plans (n=${a.length}):`)
    console.log(`    median ${qa(0.5).toFixed(0)}%  p75 ${qa(0.75).toFixed(0)}%  p90 ${qa(0.9).toFixed(0)}%  worst ${a[a.length-1].toFixed(0)}%`)
    for (const t of [10, 20, 25, 30, 35, 40, 50]) {
      const n = a.filter(x => x >= t).length
      console.log(`    >= ${String(t).padStart(2)}% decline : ${String(n).padStart(5)}  ${(n / a.length * 100).toFixed(1)}%`)
    }
    console.log(`\n    AT THE DERIVED 30% (= 100 - RECOVERY_WEEK_VOLUME_PCT):`)
    console.log(`      breaching        ${scAllDrop30}`)
    console.log(`      ...carrying the maintenance claim ${scAllDrop30Claimed}`)
    console.log(`      ...saying NOTHING                 ${scAllDrop30Silent}`)
  }
  if (scRatchet.size) {
    console.log(`\n  THE DELOAD RATCHET — mean decline and detraining rate by cohort:`)
    console.log(`    cohort                    n      mean decline   detraining`)
    for (const [k, v] of Array.from(scRatchet.entries()).sort()) {
      console.log(`    ${k.padEnd(22)} ${String(v.n).padStart(5)}   ${(v.decl / v.n).toFixed(1).padStart(11)}%   ${(v.fired / v.n * 100).toFixed(1).padStart(8)}%`)
    }
  }
  if (scConstrained > 0) {
    console.log(`\n  DOES A CONSTRAINED PLAN DECLARE ITSELF? (the three-state gauge rests on this)`)
    console.log(`    §106 firings with a ratified constraint   ${scConstrained}`)
    console.log(`      ...carrying a note / maintenance label  ${scConstrainedDeclared}  ${(scConstrainedDeclared / scConstrained * 100).toFixed(1)}%`)
    console.log(`    "ours" firings that are ALSO silent        ${scOursUndeclared}`)
  }
  if (scPeakShort.size) {
    console.log(`\n  §106 SHORTFALL — whose constraint is it?`)
    console.log(`    cohort                        n      mean shortfall vs stated`)
    let tot = 0
    for (const v of Array.from(scPeakShort.values())) tot += v.n
    for (const [k, v] of Array.from(scPeakShort.entries()).sort((a, b) => b[1].n - a[1].n)) {
      console.log(`    ${k.padEnd(26)} ${String(v.n).padStart(5)}  ${(v.gap / v.n).toFixed(1).padStart(6)}%   (${(v.n / tot * 100).toFixed(1)}% of firings)`)
    }
  }
  console.log(`\n  SILENT §1 BREACH (maintenance exempts the check AND gates off the yield):`)
  console.log(`    maintenance plans                 ${scMaintPlans}  ${pct(scMaintPlans)}`)
  console.log(`    ...breaching their §1 ceiling     ${scSilent1}  ${pct(scSilent1)}`)
  console.log(`    maintenance plans with ZERO quality (CD-21's actual case) ${scSilent1AllEasy}  ${pct(scSilent1AllEasy)}`)
  if (scSilent1Over.length) {
    const o = scSilent1Over.slice().sort((a, b) => a - b)
    console.log(`    breach magnitude over ceiling: median +${o[Math.floor(o.length / 2)].toFixed(1)}pp  p90 +${o[Math.floor(o.length * 0.9)].toFixed(1)}pp  worst +${o[o.length - 1].toFixed(1)}pp`)
  }
  console.log(`\n  IS WEEK 1 A SPIKE? (does INV-PLAN-NOT-DETRAINING reference the right week?)`)
  console.log(`    week 1 > 1.15x median of first 3 progressive weeks : ${scW1Spike}  ${pct(scW1Spike)}`)
  console.log(`    fires measured FROM WEEK 1                        : ${scFiresFromW1}  ${pct(scFiresFromW1)}`)
  console.log(`    fires measured FROM MEDIAN of first 3             : ${scFiresFromMed}  ${pct(scFiresFromMed)}`)
  if (scDisp.size) {
    console.log(`\n  FIX 2 — DISPLACEMENT: what a quality session costs when it takes a day slot`)
    console.log(`    cohort              n      base->build   quality km   easy km   net/swap`)
    for (const [k, v] of Array.from(scDisp.entries()).filter(e => e[1].n >= 25).sort()) {
      const q = v.q / v.n, e = v.e / v.n
      console.log(`    ${k.padEnd(18)} ${String(v.n).padStart(5)}   ${(v.step / v.n).toFixed(1).padStart(9)} km   ${q.toFixed(1).padStart(9)}   ${e.toFixed(1).padStart(7)}   ${(q - e).toFixed(1).padStart(7)}`)
    }
  }
  console.log(`\n  PROGRESSION SPLIT — is the plan wrong, or correctly constrained and honest?`)
  console.log(`    peak <= week 1 (no progression) ${scNoProgress}  ${pct(scNoProgress)}`)
  console.log(`      of which DECLARED            ${scNoProgressDeclared}  ${pct(scNoProgressDeclared)}`)
  console.log(`      of which SILENT             ${scNoProgressSilent}  ${pct(scNoProgressSilent)}   <-- real defects`)
  console.log(`    DESCENDING (M5 class)          ${scDescending}  ${pct(scDescending)}`)
  console.log(`      of which SILENT             ${scDescendingSilent}  ${pct(scDescendingSilent)}`)
  console.log('\n  PLANS carrying each warn code (not occurrences):')
  for (const [c, n] of Array.from(scWarnPlansByCode.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pct(n).padStart(6)}  ${c}  (${n})`)
  }
}
