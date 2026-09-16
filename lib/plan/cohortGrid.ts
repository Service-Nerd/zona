// COHORT-SHAPE-01 — the fixed population the shape regression measures.
//
// DELIBERATELY EXHAUSTIVE, NOT SAMPLED. `property-validate-plans.ts` samples
// 20,000 inputs from a seeded RNG, which is right for finding rare violations
// and wrong here: a sampled grid's RATES wobble between runs, and a regression
// harness whose baseline moves on its own teaches everyone to ignore it.
// Every combination below runs, every time, in the same order.
//
// Pinned `planStart`. A grid that reads the wall clock silently changes what it
// measures — SWEEP-VACUOUS-01, where a time-dependent grid stopped generating
// and reported a clean bill of health for months.
//
// ENUM VALUES ARE THE REAL ONES. Three separate measurement grids on
// 2026-09-11 passed `fitness_level: 'advanced'`, `recent_quality_training:
// 'occasionally'` and `hard_session_relationship: 'regularly'` — none of which
// exist. The engine matched none of them, fell to defaults, and produced
// hundreds of valid plans from inputs that were partly fiction. §55 rejects
// those now (`InputEnumError`), so this grid cannot silently drift that way
// again: a typo here throws rather than quietly measuring the wrong cohort.

import type { GeneratorInput } from '@/types/plan'

export const COHORT_PLAN_START = '2026-04-27'

/**
 * Race dates derived from the pinned start, never from `new Date()`.
 *
 * ⚠️ `COHORT_PLAN_START` is a MONDAY and `+ weeks * 7` keeps it one, so every
 * race in this grid used to fall on a Monday — and a Monday race has no in-week
 * day before it, which is precisely the shape in which a race-eve defect CANNOT
 * appear. That is how RACE-WEEK-FITNESS-01 survived every check while §39 put a
 * 72-minute run the day before a beginner's first marathon on 81 of 81 plans.
 * `REVIEW-HARNESS-MONDAY-01` fixed the review cases and deliberately left this
 * grid; this closes it.
 *
 * Offsets match `charityCohort.ts`'s `charityRaceDate` exactly rather than
 * inventing a second convention: Sunday is start + weeks*7 - 1, Saturday - 2.
 */
const raceDateIn = (weeks: number, raceDay: RaceDay = 'sun') =>
  new Date(new Date(`${COHORT_PLAN_START}T00:00:00Z`).getTime()
    + (weeks * 7 - (raceDay === 'sun' ? 1 : 2)) * 86_400_000)
    .toISOString().slice(0, 10)

type RaceDay = 'sat' | 'sun'
/** ~95% of real races are Sat or Sun, and the two are NOT interchangeable — the
 *  race weekday decides which days race week can still carry a session. */
const RACE_DAYS: readonly RaceDay[] = ['sat', 'sun']

const DISTANCES = [
  { km: 5,    target: '0:25:00', weeks: 12 },
  { km: 10,   target: '0:52:00', weeks: 12 },
  { km: 21.1, target: '1:55:00', weeks: 16 },
  { km: 42.2, target: '4:15:00', weeks: 18 },
] as const

const VOLUMES = [20, 35, 50] as const

// ── GRID-COVERAGE-01 (2026-09-14) — three axes the grid was BLIND to ──────────
//
// Measured: of 31 declared `GeneratorInput` fields this grid varied only TEN.
// Thirteen were never set at all and eight were constant. The property sweep
// varies 24 and gates on it; `cohortGrid` never has — so the sweep proved plans
// were VALID across 24 dimensions while `cohort:shape` proved the POPULATION was
// unchanged across only 10. A change can reshape who gets what along a dimension
// this grid cannot see, and one did.
//
// What that cost, concretely (QUALITY-ONSET-ORDER-01): §79's intensity re-entry
// keys on `training_age`, which was NEVER SET — so §79's lift never fired
// anywhere in `verify`, `cohort:shape` or the liveness corpus, and
// `INV-PLAN-RETURNING-INTENSITY-REENTRY` sat in the baseline as never-woken for
// months. The defect surfaced on the page of a coaching review, not in a check.
//
// Added in value order. `benchmark` matters most: with no VDOT anywhere,
// `assessFitness` sets `structural = intensity = byVolume`, so §79's two-signal
// DISAGREEMENT — the entire reason §79 exists — could never occur.
const TRAINING_AGES = [undefined, '2-5yr', '5yr+'] as const
/** A benchmark supplies VDOT. Without one the two §79 signals cannot disagree. */
const BENCHMARKS = [undefined, { type: 'race', distance_km: 5, time: '0:27:30', benchmark_date: '2026-04-01' }] as const
/** §3's masters recovery cadence keys on age >= MASTERS_AGE_THRESHOLD (45). */
const AGES = [35, 52] as const
const LEVELS = ['beginner', 'intermediate', 'experienced'] as const
const DAY_SETS = [
  { days_available: 3, days_cannot_train: ['tue', 'thu'] },
  { days_available: 4, days_cannot_train: [] as string[] },
  { days_available: 5, days_cannot_train: ['tue'] },
] as const
/** `undefined` matters as much as a value — most runners never set a cap. */
const CAPS = [30, 60, undefined] as const
const GOALS = ['finish', 'time_target'] as const
/**
 * GRID-COVERAGE-02 — `recent_quality_training` was a CONSTANT (`'occasional'`),
 * and it is the gate ADR-021/§89 keys on. Measured before this axis existed:
 * `early_quality_onset` fired on **0 of 7,452** plans, so §89's whole
 * experience-gated onset, §97's one-week on-ramp, and the `oneWeekOnRamp` arm of
 * §79's intensity re-entry were UNREACHABLE by every check built on this grid —
 * `cohort:shape`, the invariant-liveness corpus, and every `measure-*` script.
 *
 * Two values, not three. `'regular'` is what opens the gate and `'occasional'`
 * is the common case; `'none'` behaves as `'occasional'` for every mechanism
 * that reads this field, so a third value would double the runtime to prove a
 * distinction the engine does not draw. The grid's exhaustive-and-un-sampled
 * property is doctrine, so an axis is added only when it reaches a mechanism.
 */
const RECENT_QUALITY = ['occasional', 'regular'] as const

/** 4x3x3x3x3x2 x 3x2x2x2x2 = 31,104 inputs. Exhaustive and ordered. */
export function cohortGrid(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  for (const d of DISTANCES)
    for (const cwk of VOLUMES)
      for (const level of LEVELS)
        for (const days of DAY_SETS)
          for (const cap of CAPS)
            for (const goal of GOALS)
              for (const trainingAge of TRAINING_AGES)
                for (const benchmark of BENCHMARKS)
                  for (const age of AGES)
                  for (const recentQuality of RECENT_QUALITY)
                    for (const raceDay of RACE_DAYS) {
              out.push({
                athlete_name: 'Athlete',
                age,
                race_name: 'Test',
                primary_metric: 'distance',
                plan_start: COHORT_PLAN_START,
                race_distance_km: d.km,
                race_date: raceDateIn(d.weeks, raceDay),
                goal,
                ...(goal === 'time_target' ? { target_time: d.target } : {}),
                resting_hr: 55,
                max_hr: 184,                    // Tanaka at 35, pinned
                current_weekly_km: cwk,
                longest_recent_run_km: Math.max(3, Math.round(cwk * 0.4)),
                fitness_level: level,
                recent_quality_training: recentQuality,
                hard_session_relationship: 'neutral',
                injury_history: [],
                ...(cap !== undefined ? { max_weekday_mins: cap } : {}),
                ...(trainingAge !== undefined ? { training_age: trainingAge } : {}),
                ...(benchmark !== undefined ? { benchmark } : {}),
                ...days,
              } as unknown as GeneratorInput)
            }
  return out
}

/** A refusal is the engine working (§44 prep-time, days-per-week minimums).
 *  Anything else that throws is a real failure and must not be counted as one. */
export const COHORT_REFUSAL =
  /is not enough preparation|days\/week is (not enough|below)|is below the recommended \d+-week minimum/

// ── GRID-COVERAGE-02 Phase 2 (2026-09-15) — the SECOND, TARGETED grid ────────
//
// WHY A SECOND GRID RATHER THAN MORE AXES. `cohortGrid` is exhaustive and
// un-sampled, and that property is doctrine — it is what lets `cohort:shape`
// claim a rate rather than an estimate. It is also already 31,104 rows (~29s)
// inside `npm run verify`, so every further axis DOUBLES a check that runs on
// every build. Crossing the five remaining fields into it would be ~500k rows.
//
// These five fields do not need crossing with everything. They gate MECHANISMS
// (a branch fires or it does not), not cohort CLASSIFICATION — so what they need
// is reach, not a full cross. That is the `corpus` pattern the invariant-liveness
// baseline already names: a targeted grid for shapes the main grid cannot build.
//
// SCOPED TO THE CHARITY DISTANCES (10K / HM / marathon) deliberately: that is the
// cohort this exists to protect, and 5K/ultra add rows without adding mechanism.
// The WIZARD's spellings, not the code's (2026-09-16). Behaviour-neutral now that
// `hasInjury` normalises separators, but a fixture written in a spelling the
// product cannot emit is how 'Shin splints' never matched 'shin_splints' in
// production for months while every test passed.
const TARGETED_INJURIES: readonly (readonly string[])[] = [[], ['Knee'], ['Shin splints'], ['Achilles']]
const TARGETED_DECLARED = [undefined, 'beginner', 'intermediate', 'experienced'] as const
const TARGETED_WEEKS_AT_VOLUME = [undefined, 1, 4, 12] as const
const TARGETED_FOUNDATION = [undefined, 'add', 'skip', 'start_now'] as const
const TARGETED_DAY_BUDGETS = [undefined, { mon: 30, tue: 45, wed: 30, thu: 60, fri: 30 }] as const
const TARGETED_DISTANCES = [
  { km: 10,   weeks: 12 },
  { km: 21.1, weeks: 16 },
  { km: 42.2, weeks: 18 },
] as const

/**
 * The five `GeneratorInput` fields `cohortGrid` still never varies.
 *
 * 3 x 4 x 4 x 4 x 4 x 2 = 1,536 inputs (~3s). Held at ONE representative base
 * otherwise, because the point is to make each mechanism REACHABLE, not to
 * re-measure the population — `cohortGrid` owns that.
 *
 * `user_declared_level` is the load-bearing one for the charity cohort: the
 * wizard sends it (`GeneratePlanScreen.tsx`), none of the 11 charity personas
 * set it, and a first-timer who declares 'intermediate' goes from 0 quality
 * sessions to 6-10. That path had no coverage anywhere before this grid.
 */
export function targetedGrid(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  for (const d of TARGETED_DISTANCES)
    for (const injury_history of TARGETED_INJURIES)
      for (const declared of TARGETED_DECLARED)
        for (const weeksAtVolume of TARGETED_WEEKS_AT_VOLUME)
          for (const foundation of TARGETED_FOUNDATION)
            for (const dayBudgets of TARGETED_DAY_BUDGETS) {
              out.push({
                athlete_name: 'Athlete', age: 40, race_name: 'Test',
                primary_metric: 'distance', plan_start: COHORT_PLAN_START,
                race_distance_km: d.km, race_date: raceDateIn(d.weeks, 'sun'),
                goal: 'finish', resting_hr: 55, max_hr: 184,
                current_weekly_km: 30, longest_recent_run_km: 12,
                fitness_level: 'beginner',
                recent_quality_training: 'occasional',
                hard_session_relationship: 'neutral',
                training_age: '6-18mo',
                days_available: 4, days_cannot_train: [],
                injury_history: [...injury_history],
                ...(declared !== undefined ? { user_declared_level: declared } : {}),
                ...(weeksAtVolume !== undefined ? { weeks_at_current_volume: weeksAtVolume } : {}),
                ...(foundation !== undefined ? { foundation_decision: foundation } : {}),
                ...(dayBudgets !== undefined ? { day_budgets: { ...dayBudgets } } : {}),
              } as unknown as GeneratorInput)
            }
  return out
}
