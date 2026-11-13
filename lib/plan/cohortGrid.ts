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

// GRID-MARATHON-CAPABLE-01 (2026-09-19) — 70 ADDED, and the arithmetic is why.
//
// §24 requires a marathon peak long run of >= 75% of race distance: 31.65 km.
// §52 caps any single run at 60% of its week. A runner who satisfies both
// therefore needs a week of at least 31.65 / 0.6 = ~53 km — and the grid topped
// out at 50. **Every marathon measurement ever taken on this grid was scoped to
// runners who could not satisfy §24 in the first place**, which is how "100% of
// marathon time-goal plans are maintenance-grade, 0% reach the §24 floor" got
// reported as a catastrophic engine finding when it was an artefact of the
// corpus (LR-CONSEC-01 sitting, 2026-09-17).
//
// Same class as `training_age` never being set (GRID-COVERAGE-01) and the
// round-robin consuming heads (LIVENESS-DEBT-01): the grid was answering a
// narrower question than the one being asked of it, and said nothing about the
// difference. Costs +33% grid size; `cohort:shape` rates re-baselined with the
// move declared, since a fourth volume genuinely changes who is in the
// population.
const VOLUMES = [20, 35, 50, 70] as const

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
// BLOCKED-DAYS-CHECKER-SPELLING-01 (2026-09-25) — THE WIZARD'S SPELLING, not the
// code's. These cells read `['tue','thu']` and `['tue']`, which
// `GeneratePlanScreen` cannot produce: it maps through `FULL_BY_SHORT` and sends
// `'tuesday'` (confirmed on 11 of 13 stored plans). So the corpus exercised a
// spelling no runner sends, and `invariants.ts` was CASTING rather than
// converting — the checker was wrong for every real user and right for every
// swept one.
//
// ⚠️ FREE, AND MEASURED RATHER THAN ASSUMED. The engine normalises
// (`ruleEngine.ts:806`), so the two spellings produce byte-identical `weeks` and
// byte-identical `meta` apart from `meta.generator_input`, which echoes the raw
// input back for replay by design. No `cohortShape` or `planFitness` metric
// reads that field, so no baseline moves — same swap-don't-add reasoning as the
// parity grid's own injury axis.
//
// ⚠️ IT STILL DOES NOT REACH THE DIVERGING SHAPE. The cast only misreports when
// ALL FIVE weekdays are blocked (3 of 420 swept cases), and no cell here does
// that — a 2-day weekend-only runner cannot generate cleanly under NODE_ENV=test
// (§110/§1: zero quality is a real violation for them), so it belongs in
// `blockedDaysSpelling.test.ts`'s forged-plan fixture, not in this grid.
const DAY_SETS = [
  { days_available: 3, days_cannot_train: ['tuesday', 'thursday'] },
  { days_available: 4, days_cannot_train: [] as string[] },
  { days_available: 5, days_cannot_train: ['tuesday'] },
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

/**
 * **41,472 inputs. Exhaustive and ordered.**
 *
 * ⚠️ THIS COMMENT SAID 31,104 UNTIL 2026-09-20, and CLAUDE.md already warns
 * "read it from the file, not from here" because the grid has been widened
 * repeatedly. It had been widened again since. **A stale count in the file that
 * is cited as the authority is worse than no count** — the number is now
 * asserted by `cohortGridSize.test.ts`, which fails when the product of the
 * axes moves, so the next widening cannot land silently.
 */
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
                // COHORT-GRID-UNSET-LEVEL-01 (2026-11-03) — `user_declared_level`, NOT
                // `fitness_level`. The wizard sends the runner's level on the former,
                // WHETHER ACCEPTED OR OVERRIDDEN, and never on the latter, which is the
                // API's structural override and binds peak km (§79,
                // `GeneratePlanScreen.tsx`). No production caller sets it.
                //
                // 🔴 WHAT THE FORCED FIELD COST, MEASURED ON THIS GRID WITH
                // `derivedLevelsFor`. `fitness_level` wins outright inside `resolveLevels`,
                // so every row had `structural === intensity === level`. Swapping it moves
                // the STRUCTURAL level on **19,008 of 41,472 rows (45.8%)** and the
                // intensity level on **0**: experienced-STRUCTURE goes 13,824 -> **1,728**,
                // because a declaration binds structure DOWNWARD ONLY. The grid was
                // claiming 33.3% experienced structure where the wizard's shape delivers
                // **4.2%**.
                //
                // ⚠️ THESE FIGURES READ 25.0% AND 8.3% UNTIL A CODE REVIEW CAUGHT IT:
                // measured with `resolveLevels(i)` and no VDOT, where half this grid
                // carries a benchmark. Use `derivedLevelsFor` — it composes `vdotFor`
                // first, which is what the engine builds the plan with.
                //
                // ⚠️ AND IT GAINS CELLS IT COULD NOT BUILD: 19,008 rows where structural
                // and intensity DIFFER (6,912 beginner/intermediate, 6,912
                // beginner/experienced, 5,184 intermediate/experienced) — §79's two-signal
                // split, the entire reason §79 exists, previously unreachable by
                // `cohort:shape`, `measure:fitness`, `invariant:liveness`, `audit:plans`
                // and the strength sweep. §79 Am.3's over-claim shape (declared above the
                // assessed structural band) goes **0 -> 19,008** and the credible-caution
                // shape **0 -> 8,640**. Three board rulings on 2026-11-03 were ratified on
                // the old shape (§117 Am.5, §117's peak gate, §2 Amendment's week-1 hazard).
                user_declared_level: level,
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

/**
 * A refusal is the engine working (§44 prep-time, §52 days, §111 base volume,
 * §113 long-run readiness). Anything else that throws is a real failure and
 * must not be counted as one.
 *
 * ⚠️ REFUSAL-COPY-02 — this used to be a REGEX OVER THE MESSAGE TEXT, which
 * made the refusal copy a wire format without saying so: rewording the §44/§52
 * messages for tone broke four checks across three files. Re-exported from
 * `designedRefusal.ts`, which matches the ERROR TYPE, so copy is free to change
 * and a genuine fault can never drift into matching.
 */
export { isDesignedRefusal } from './designedRefusal'

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
// GRID-DAY-BUDGET-NO-CAP-01 (2026-11-08) — the PRODUCTION pairing, derived, not typed.
//
// The wizard never sends `day_budgets` alone: `weekPlanToInputs` derives
// `max_weekday_mins` as the MINIMUM across the weekdays the runner actually runs and
// sends both. This axis sent the budgets with no cap, so `input.max_weekday_mins` was
// undefined on 3,072 of 6,144 rows — and every rule gated on the single cap existing
// read as unexercised. The plan-level §81 weekday-overrun detector opens
// `if (!cap) return null`, so it returned null for ALL of them: the corpus with the only
// per-day budgets anywhere was the one corpus blind to the detector those budgets break.
//
// ⚠️ NARROWER THAN IT FIRST LOOKED. `scripts/property-validate-plans.ts` and the
// coach-review canonical cases (persona 06's Tue 90) already derive the minimum
// correctly. ONE corpus, not six — the COHORT-GRID-UNSET-LEVEL-01 class in a second
// field, and `corpusProductionShape.test.ts` now holds this pairing too.
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'] as const
/** `max_weekday_mins` as `weekPlanToInputs` derives it FOR A FULLY-BUDGETED WEEK: the minimum
 *  over the weekdays the runner actually runs. `undefined` when no weekday carries a budget.
 *
 *  ⚠️ NOT THE WHOLE PRODUCTION DERIVATION, and `/code-review` was right to say so. The wizard
 *  takes `min(dayBudgets[d] ?? weekdayDefaultMins)` — it falls back to the single chip the
 *  runner picked for "a weekday". This helper has no default to fall back to, so a PARTIAL shape
 *  such as `{ tue: 90 }` against a 35-minute default yields 90 here and 35 in production, and the
 *  `GRID-DAY-BUDGET-NO-CAP-01` arm would certify that as production shape. Latent only because
 *  every shape in this file budgets all five weekdays — asserted below, so it stays latent. */
export function derivedWeekdayCap(
  budgets: Partial<Record<typeof WEEKDAY_KEYS[number], number>> | undefined,
  daysCannotTrain: readonly string[] = [],
): number | undefined {
  if (!budgets) return undefined
  const rest = new Set(daysCannotTrain.map(d => String(d).slice(0, 3).toLowerCase()))
  const mins = WEEKDAY_KEYS.filter(d => !rest.has(d))
    .map(d => budgets[d])
    .filter((m): m is number => typeof m === 'number' && Number.isFinite(m) && m > 0)
  return mins.length > 0 ? Math.min(...mins) : undefined
}
// LIVENESS-DEBT-01 (2026-09-17). A SIXTH axis, and it is here for the reason the
// other five are: `INV-PLAN-OVERDO-BRAKE` is gated on
// `hard_session_relationship === 'overdo'`, NEITHER grid ever set anything but
// 'neutral', and a plan mutation cannot reach an INPUT field — so the rule was
// structurally unwakeable and sat in the liveness debt register as "nobody has
// looked yet".
//
// All four values, not just 'overdo': 'avoid' gates §110 (CB-HSR-AVOID-01, where
// `avoid` acted as an off switch, 2,953 plans got zero quality and no invariant
// fired) and 'love' gates §96's honesty line. A declared enum held at one value
// is the exact shape GRID-COVERAGE-01 was written against.
const TARGETED_HSR = ['neutral', 'overdo', 'avoid', 'love'] as const
const TARGETED_DISTANCES = [
  { km: 10,   weeks: 12 },
  { km: 21.1, weeks: 16 },
  { km: 42.2, weeks: 18 },
] as const

/**
 * The five `GeneratorInput` fields `cohortGrid` still never varies.
 *
 * 3 x 4 x 4 x 4 x 4 x 2 x 4 = 6,144 inputs (~9s). Held at ONE representative base
 * otherwise, because the point is to make each mechanism REACHABLE, not to
 * re-measure the population — `cohortGrid` owns that.
 *
 * `user_declared_level` is the load-bearing one for the charity cohort: the
 * wizard sends it (`GeneratePlanScreen.tsx`), none of the 11 charity personas
 * set it, and a first-timer who declares 'intermediate' goes from 0 quality
 * sessions to 6-10. That path had no coverage anywhere before this grid.
 */
/** The cartesian only. Sample THIS; take `targetedGridExtra()` in full beside it. */
export function targetedGridCore(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  for (const d of TARGETED_DISTANCES)
    for (const injury_history of TARGETED_INJURIES)
      for (const declared of TARGETED_DECLARED)
        for (const weeksAtVolume of TARGETED_WEEKS_AT_VOLUME)
          for (const foundation of TARGETED_FOUNDATION)
            for (const dayBudgets of TARGETED_DAY_BUDGETS)
              for (const hsr of TARGETED_HSR) {
              out.push({
                athlete_name: 'Athlete', age: 40, race_name: 'Test',
                primary_metric: 'distance', plan_start: COHORT_PLAN_START,
                race_distance_km: d.km, race_date: raceDateIn(d.weeks, 'sun'),
                goal: 'finish', resting_hr: 55, max_hr: 184,
                current_weekly_km: 30, longest_recent_run_km: 12,
                // COHORT-GRID-UNSET-LEVEL-01 — `fitness_level: 'beginner'` WAS HERE, and
                // it made this grid's own `user_declared_level` axis INERT ON STRUCTURE.
                // The forced field floored structure at beginner, and a declaration binds
                // structure downward only, so all three non-undefined values resolved to
                // the same structural level as `undefined`: 6,144 of 6,144 rows beginner.
                // The axis was added by GRID-COVERAGE-02 Phase 2 to reach exactly that
                // path. 30 km/week with a 12 km longest run assesses as INTERMEDIATE, so
                // removing it moves **4,608 of 6,144 rows (75.0%)** on structure and
                // **1,536 (25.0%)** on intensity — the rows that declare nothing, whose
                // intensity was pinned to beginner by the forced field — and the grid
                // finally holds both structural bands. §79's directions invert with it:
                // over-claim 3,072 -> 1,536, credible caution **0 -> 1,536**.
                // ⚠️ This comment said "3,072 (50.0%)" until a code review caught it; that
                // is the over-claim count, not the structural-move count.
                recent_quality_training: 'occasional',
                hard_session_relationship: hsr,
                training_age: '6-18mo',
                days_available: 4, days_cannot_train: [],
                injury_history: [...injury_history],
                ...(declared !== undefined ? { user_declared_level: declared } : {}),
                ...(weeksAtVolume !== undefined ? { weeks_at_current_volume: weeksAtVolume } : {}),
                ...(foundation !== undefined ? { foundation_decision: foundation } : {}),
                // Both fields, always: see GRID-DAY-BUDGET-NO-CAP-01 above.
                ...(dayBudgets !== undefined
                  ? { day_budgets: { ...dayBudgets },
                      max_weekday_mins: derivedWeekdayCap(dayBudgets, []) }
                  : {}),
              } as unknown as GeneratorInput)
            }

  return out
}

/**
 * The whole grid: the cartesian plus the focused reach blocks.
 *
 * ⚠️ CONSUMERS THAT SAMPLE MUST NOT USE THIS. Sample `targetedGridCore()` and concatenate
 * `targetedGridExtra()` in full — a stride over the combined grid both re-permutes on every
 * append AND can drop the only rows that reach a cohort. `audit:plans` and `measure:fitness`
 * do it that way; everything that consumes the grid WHOLE can use this.
 */
export function targetedGrid(): GeneratorInput[] {
  return [...targetedGridCore(), ...targetedGridExtra()]
}

/**
 * 🔴 THE FOCUSED BLOCKS, EXPORTED SEPARATELY SO THEY CAN NEVER BE SAMPLED AWAY.
 *
 * `audit:plans` takes `stride(targetedGrid(), 1500)` and `measure:fitness` took
 * `spread(...).slice(0, 6000)`. Both are LENGTH-DEPENDENT: appending 16 rows re-permuted
 * every sampled row, turned the suite red, and moved a marathon specificity figure 61.6% ->
 * 47.4% **with no engine file in the diff** (`/code-review`, 2026-11-07).
 *
 * ⚠️ AND A STABLE STRIDE ALONE WOULD NOT HAVE BEEN ENOUGH: a block that exists for REACH must
 * be taken IN FULL, or a 1-in-4 sample would drop the only rows that reach the cohort. So
 * consumers sample the CARTESIAN and concatenate this wholesale. That is the whole point of a
 * focused block — `PARITY-HSR-01`'s pattern, which samples nothing.
 */
export function targetedGridExtra(): GeneratorInput[] {
  const out: GeneratorInput[] = []
  // ── ENVELOPE-LRR-BLIND-01 — THE NEVER-RUN RUNNER, REACHABLE AT LAST ─────────
  //
  // 🔴 MEASURED 2026-11-07: **0 of `cohortGrid`'s 41,472 rows carry
  // `longest_recent_run_km: 0`**, because it is DERIVED (`max(3, cwk * 0.4)`), and this
  // grid pins it at 12. So no measurement corpus could reach the runner who tells us they
  // have never run — the cohort §117 Amendment 7 was built for, and the one
  // `useCaseEnvelope` reports coverage on (`min(cw * 0.45, dist * 0.75)`, also derived).
  //
  // ⚠️ APPENDED, NOT CROSSED, which is this grid's own stated purpose: these fields "gate
  // MECHANISMS (a branch fires or it does not), not cohort CLASSIFICATION — so what they
  // need is reach, not a full cross". A third axis here would multiply 6,144.
  //
  // ⚠️ VOLUME AND LONGEST RUN ARE INDEPENDENT. Varying one while deriving the other cannot
  // reach the interaction, which is the whole defect being closed.
  for (const d of TARGETED_DISTANCES)
    for (const r of [{ cwk: 0, lr: 0 }, { cwk: 6, lr: 0 }, { cwk: 20, lr: 0 }, { cwk: 20, lr: 2 }])
      out.push({
        athlete_name: 'Athlete', age: 40, race_name: 'Test',
        primary_metric: 'distance', plan_start: COHORT_PLAN_START,
        race_distance_km: d.km, race_date: raceDateIn(d.weeks, 'sun'),
        goal: 'finish', resting_hr: 55, max_hr: 184,
        current_weekly_km: r.cwk, longest_recent_run_km: r.lr,
        recent_quality_training: 'none', hard_session_relationship: 'neutral',
        training_age: '<6mo', days_available: 4, days_cannot_train: [],
        injury_history: [], user_declared_level: 'beginner',
        acknowledged_days_warning: true, acknowledged_prep_warning: true,
      } as unknown as GeneratorInput)

  // ── GRID-GOAL-INSIDE-LINE-01 — A BENCHMARKED GOAL *INSIDE* §120's 5% LINE ───
  //
  // 🔴 MEASURED 2026-11-07: of `cohortGrid`'s **10,368 benchmarked time-target rows, ZERO**
  // produce `goal_pace_reach.gap_pct <= 5`. So §120 Amendment 2's reachability line — and
  // Amendment 3's comparator, ruled the same week — had no corpus case on the ADMITTED side
  // of it. The gate could only ever see goals being withheld, never goals being allowed.
  //
  // ⚠️ THE PAIR IS DERIVED, NOT TYPED. Swept benchmark/target combinations and measured
  // `gap_pct`: a 10 km benchmark of 50:00 with a 49:30 target lands at **3.10%**, inside the
  // line and not withheld. 49:00 gives 4.10%. Both are kept, because a single case one side
  // of a boundary cannot show the boundary MOVING.
  for (const g of [{ target: '0:49:30', tag: 3.1 }, { target: '0:49:00', tag: 4.1 }])
    for (const cwk of [40, 55])
      out.push({
        athlete_name: 'Athlete', age: 35, race_name: 'Test',
        primary_metric: 'distance', plan_start: COHORT_PLAN_START,
        race_distance_km: 10, race_date: raceDateIn(26, 'sun'),
        goal: 'time_target', target_time: g.target,
        resting_hr: 55, max_hr: 184,
        current_weekly_km: cwk, longest_recent_run_km: Math.round(cwk * 0.4),
        recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
        // ⚠️ `'18mo-3yr'` WAS HERE AND IS NOT A `TrainingAge` (`'<6mo' | '6-18mo' | '2-5yr' |
        // '5yr+'`), so `trainingAgeIsExperienced` read false and §79's re-entry lift and
        // ADR-021's early-onset gate could not fire on these rows — the same class as the
        // blocked-days spelling note above (`/code-review`, 2026-11-07).
        training_age: '2-5yr', days_available: 5, days_cannot_train: [],
        injury_history: [], user_declared_level: 'intermediate',
        // 🔴 UNDATED, DELIBERATELY. A pinned `benchmark_date` climbs §10's staleness ramp
        // against the WALL CLOCK: measured, these rows sat at 3.1%/4.1% today, 3.9%/4.9% on
        // 2026-11-25 and 4.8%/5.7% from 2026-12-23 — so the 49:00 row would leave §120's
        // admitted side in about two weeks and the arm asserting "inside the line" would go red
        // on a calendar. `GOALPACE-5K-CLOCK-01` is that exact failure, fixed earlier the same
        // day, and `pinnedClock.test.ts` cannot see this file. §42: blank means FRESH, so an
        // undated benchmark takes the stable base discount and never ramps.
        benchmark: { type: 'race', distance_km: 10, time: '0:50:00' },
        acknowledged_days_warning: true, acknowledged_prep_warning: true,
      } as unknown as GeneratorInput)

  // ── GRID-NO-MENOPAUSAL-TENDON-01 — MASTERS AGE x TENDON HISTORY, AT LAST ────
  //
  // 🔴 MEASURED: the cell exists in NEITHER cartesian. `cohortGrid` varies age over
  // {35, 52} and carries `injury_history: []` on all 41,472 rows; `targetedGridCore`
  // carries the injuries and is `age: 40` on all 6,144 — below `MASTERS_AGE_THRESHOLD`
  // (45), so the worst achilles case ever measured was invisible to the masters segment
  // as well as to any crossed one. Sims raised it at the §94 Am. 5 sitting: tendon and
  // fascia stiffness are oestrogen-sensitive and adaptation is slower peri- and
  // post-menopause, so this is the cohort with the strongest tissue argument and no
  // corpus could reach it.
  //
  // 🔴 AND THE ENGINE CANNOT BE TOLD ABOUT MENOPAUSE AT ALL. `GeneratorInput` has `age`
  // and NO sex or gender field, so "post-menopausal" is unrepresentable and age is the
  // only proxy there is. These rows are therefore MASTERS AGE x TENDON HISTORY, which is
  // the buildable half of what Sims asked for; the physiological half cannot be keyed on
  // by any rule, the same wall the cycle work hit (`@capgo/capacitor-health` exposes no
  // menstrual data type, which is why ENGINE-03a/CA-05 are blocked). Stating it here
  // because a corpus named for a cohort it cannot actually identify is how a measurement
  // comes to be trusted for more than it covers.
  //
  // ⚠️ APPENDED, NOT CROSSED. This grid's own rule: these fields "gate MECHANISMS, not
  // cohort CLASSIFICATION — so what they need is reach, not a full cross". Crossing an
  // injury axis into `cohortGrid` would be 41,472 x 3 on a check that runs every build,
  // which is the thing that rule exists to refuse. 6 rows reach the cell.
  //
  // ⚠️ THE CORPUS ALONE DOES NOT CREATE THE CELL, and that was the item's real gap.
  // `deliveredRampTail.test.ts` segments into three MUTUALLY EXCLUSIVE buckets with
  // injury tested first, so these rows would land in `injury` and the cross would still
  // not exist. The fourth segment ships with them.
  //
  // 🔑 COMPLEMENTARY TO `measure-plan-fitness.ts`'s HAND-BUILT COHORT, NOT A DUPLICATE OF
  // IT. That script constructs age {40, 52} x injury {none, KNEE} by hand, calling it the
  // worst case. Knee is LEVER-SCOPED — ADR-022's levers and §12's producer cap name knee and
  // shin — so what it measures is the worst case among runners the engine can act for. This
  // cell is TENDON, which no lever governs. The genuinely worse cell was the one with no
  // corpus. Do not delete either as redundant.
  //
  // ⚠️ ONE AGE, NOT A RANGE. 52 matches `cohortGrid`'s own masters value so the two
  // corpora agree, and 52 vs 58 differs only in Tanaka max-HR derivation — no rule
  // branches between them, so a second age would add rows and no mechanism.
  // Volume/longest run mirror the worst achilles case the sitting measured (HM,
  // 30 km/week, longest 12) so the only moved variable against `targetedGridCore` is age.
  for (const d of TARGETED_DISTANCES)
    for (const injury of [['Achilles'], ['Plantar fasciitis']] as const)
      out.push({
        athlete_name: 'Athlete', age: 52, race_name: 'Test',
        primary_metric: 'distance', plan_start: COHORT_PLAN_START,
        race_distance_km: d.km, race_date: raceDateIn(d.weeks, 'sun'),
        goal: 'finish', resting_hr: 55, max_hr: 184,
        current_weekly_km: 30, longest_recent_run_km: 12,
        recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
        training_age: '6-18mo', days_available: 4, days_cannot_train: [],
        // The WIZARD's spellings (`GeneratePlanScreen.tsx` -> `INJURIES`), per the note on
        // TARGETED_INJURIES: a fixture in a spelling the product cannot emit is how
        // 'Shin splints' never matched 'shin_splints' for months with every test green.
        // Both are in `HILL_RESTRICTING_INJURIES` and both are tendon/fascia, which is the
        // tissue Sims's argument is about.
        injury_history: [...injury],
        // `user_declared_level` deliberately UNSET: no production caller sends
        // `fitness_level`, and at 30 km/week with a 12 km longest run the engine assesses
        // INTERMEDIATE (COHORT-GRID-UNSET-LEVEL-01).
        acknowledged_days_warning: true, acknowledged_prep_warning: true,
      } as unknown as GeneratorInput)

  // ── CORPUS-BENCHMARK-VARIETY-01 — THE BENCHMARK AXIS, HELD AT ONE VALUE EVERYWHERE ──
  //
  // 🔴 MEASURED: excluding "no benchmark", `cohortGrid` carries ONE distinct benchmark across
  // 41,472 rows, `targetedGridCore` ZERO, `useCaseEnvelope` zero, and `verify-parity` one. So
  // nothing that varies with the benchmark VALUE was measurable by any standing harness —
  // VDOT banding, §10's staleness ramp, §19's anchors, §120's reachability. Same class as
  // COHORT-GRID-UNSET-LEVEL-01 and PARITY-GRID-UNSET-LEVEL-01: the axis exists and is pinned.
  //
  // ⚠️ DATES ARE RELATIVE TO THIS GRID'S OWN PINNED START, not to `slowGoalDates()` and not to
  // a literal. The first cut used `slowGoalDates()` (today-anchored) against a pinned race date
  // and produced a benchmark dated AFTER the race. See the derivation below.
  //
  // ⚠️ FOUR ROWS, NOT A CROSS. This block exists for REACH; crossing a benchmark axis into
  // the cartesian would multiply 6,144. Three 5K times span the VDOT bands and one 10K gives a
  // second distance. It reaches VDOT BANDING; it does not reach §10's staleness ramp, for the
  // reason written below.
  {
    // 🔴 DATES RELATIVE TO THIS GRID'S OWN PINNED START, NOT TO THE WALL CLOCK (code review).
    // The first cut took `slowGoalDates()`, which derives from `new Date()` — paired with this
    // grid's pinned `COHORT_PLAN_START` and a `raceDateIn` race date that produced a benchmark
    // dated AFTER the race, widening by a day every day, a shape the wizard cannot emit. It
    // validated only because `assertPlausibleBenchmark` defaults to `new Date()` too.
    // ⚠️ `GOALPACE-5K-CLOCK-01` says derive dates rather than pin them, and this obeys it — the
    // anchor is just this corpus's own start instead of today, because the whole grid is
    // clock-pinned by design. Relative to a pinned anchor cannot age; relative to today can.
    const dayBefore = (days: number) =>
      new Date(Date.parse(`${COHORT_PLAN_START}T00:00:00Z`) - days * 864e5).toISOString().slice(0, 10)
    // ⚠️ NOT "fresh" — that is what this said and it was FALSE (code review). Measured, every
    // row returns `discountPct: 7`, the cap, because §10 compares to `new Date()` while this
    // grid is pinned to April. 14 days before the pinned start is simply a date that PRECEDES
    // the race, which is the only property this block needs and can have.
    const benchmarkDate = dayBefore(14)
    // 🔴 §10's STALENESS RAMP IS NOT REACHABLE FROM THIS CORPUS, AND THE ROW THAT CLAIMED TO
    // REACH IT IS GONE. Code review caught the first cut sitting exactly on the 7% cap;
    // re-anchoring it mid-ramp then turned out to be impossible here, measured rather than
    // argued — `applyVdotDiscount` compares `benchmark_date` to `new Date()`, and this grid's
    // `plan_start` is pinned at 2026-04-27, so EVERY date that precedes its race is already far
    // past the cap. All five rows returned discountPct 7.
    //
    // The two requirements are incompatible in a clock-pinned corpus: a benchmark must precede
    // the race (or it is a shape the wizard cannot emit) AND sit at a controlled age against
    // today (or the ramp is not exercised). Only a corpus whose dates derive from today can do
    // both — `slowGoalGrid`, via `slowGoalDates()`. **Stating it instead of shipping a row that
    // looks like coverage and is a constant.**
    const BENCHES = [
      { distance_km: 5, time: '0:19:30', benchmark_date: benchmarkDate },   // fast
      { distance_km: 5, time: '0:24:00', benchmark_date: benchmarkDate },   // mid
      { distance_km: 5, time: '0:33:00', benchmark_date: benchmarkDate },   // slow
      { distance_km: 10, time: '0:58:00', benchmark_date: benchmarkDate },  // second distance
    ]
    for (const b of BENCHES)
      out.push({
        athlete_name: 'Athlete', age: 38, race_name: 'Test',
        primary_metric: 'distance', plan_start: COHORT_PLAN_START,
        race_distance_km: 10, race_date: raceDateIn(16, 'sun'),
        goal: 'time_target', target_time: '0:52:00',
        resting_hr: 55, max_hr: 184,
        current_weekly_km: 30, longest_recent_run_km: 12,
        recent_quality_training: 'occasional', hard_session_relationship: 'neutral',
        training_age: '2-5yr', days_available: 4, days_cannot_train: [],
        injury_history: [] as string[],
        benchmark: { type: 'race', ...b },
        acknowledged_days_warning: true, acknowledged_prep_warning: true,
      } as unknown as GeneratorInput)
  }

  return out
}
