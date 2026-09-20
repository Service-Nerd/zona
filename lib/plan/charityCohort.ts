// charityCohort.ts — the named charity-runner scenario set (2026-09-13).
//
// A charity partner refers first-timers running 10K / HM / MARATHON for a cause:
// low base, injuries common, finish goals, sometimes a compressed timeline, often
// older. The property sweep and cohort grid prove VALIDITY across a combinatorial
// grid, but marathon was thin on NAMED, asserted cases (0 in the real-input
// corpus) and there were no injury personas in the golden set — precisely the
// charity profile. This is the single source of those personas, consumed by:
//   - scripts/charity-scenarios.ts  (human/board-legible generate+validate report)
//   - lib/plan/charityCohort.test.ts (durable regression: 0 error violations,
//     or a by-design refusal)
//
// Add a persona here when a new real charity shape appears; both consumers pick
// it up. Keep it weighted to the high-risk end (marathon, injury, masters,
// compressed, low base) — that is where the doctrine is actually stressed.

import type { GeneratorInput } from '../../types/plan'

/** Fixed plan start (a Monday), like the golden set — never the wall clock. */
export const CHARITY_PLAN_START = '2026-04-27'
const DAY_MS = 86_400_000

export interface CharityPersona {
  id: string
  /**
   * PERSONA-CORPUS-01 (2026-09-19) — which corpus this persona belongs to.
   *
   * `'charity'` (the default, and every persona that predates this field) is
   * the referred-first-timer set this file was built for. `'engine'` is the
   * wider realistic-runner set added after the end-to-end regression pass,
   * where SIX hand-built runners found a defect that **0 of 45,764 grid plans
   * could reach** (`PHASE-EMPTY-01` / `GRID-EARLY-ONSET-01`).
   *
   * Tagged rather than split into a second array, because two registers of the
   * same objects with a human in between is how they drift. `CHARITY_PERSONAS`
   * stays a derived filter, so every existing consumer sees exactly what it
   * saw before.
   */
  cohort?: 'charity' | 'engine'
  /** Which coaching doctrine this scenario stresses. */
  note: string
  /** Weeks from plan start to race day. */
  weeks: number
  /**
   * Which weekend day the race falls on. ~95% of real races are Sat or Sun, and
   * the two are NOT interchangeable: the race weekday interacts with
   * `preferred_long_run_day`, so a Saturday race with a Sunday long-run day
   * pushes that long run AFTER the race (§77 must drop it) while a Sunday race
   * puts the race ON the long-run day. Declared per persona rather than derived,
   * so the split is visible and deliberate. Defaults to 'sun'.
   */
  raceDay?: 'sat' | 'sun'
  /** True when a by-design refusal (prep-time / days-minimum) is the correct
   *  outcome — the plan is honest that it cannot promise the ask. */
  expectRefusal?: boolean
  /** ⚠️ Includes the two TRANSIENT acknowledgement fields, which live on
   *  `PrepTimeAwareInput` rather than `GeneratorInput` and so could not be
   *  expressed here before. A persona that cannot acknowledge a warning models
   *  a runner who never clicks "yes, I understand" — see M4. */
  input: Omit<GeneratorInput, 'race_date'>
    & { acknowledged_days_warning?: boolean; acknowledged_prep_warning?: boolean }
}

/**
 * Race day for a persona, `weeks` weeks after plan start — landing on the SUNDAY
 * that ends that week.
 *
 * ⚠️ This used to be `planStart + weeks × 7`, and `CHARITY_PLAN_START` is a
 * Monday, so **every charity persona had a Monday race** — as did all six
 * canonical cases. A Monday race has no in-week day before it, so §30's shakeout
 * never runs and the PRECEDING week's long run lands the day before the goal
 * race (PV2-G). Every review round was therefore exercising that one unusual
 * shape, and a normal weekend race had never been reviewed.
 *
 * `- 1` day puts the race on the Sunday of week `weeks`, which is both the
 * common real-world case and a cleaner plan: the final week is a full week
 * ending with the race, rather than a one-day week containing only Monday.
 *
 * The early-week case is not lost — canonical case `07-hm-monday-race` keeps it
 * visible in every round until PV2-G is built.
 */
export function charityRaceDate(
  weeks: number, planStart = CHARITY_PLAN_START, raceDay: 'sat' | 'sun' = 'sun',
): string {
  const d = new Date(planStart + 'T00:00:00Z')
  // planStart is a Monday, so weeks*7 - 1 is the SUNDAY that ends week `weeks`;
  // one day earlier is that week's Saturday.
  const offset = weeks * 7 - (raceDay === 'sun' ? 1 : 2)
  return new Date(d.getTime() + offset * DAY_MS).toISOString().slice(0, 10)
}

export function charityInput(p: CharityPersona, planStart = CHARITY_PLAN_START): GeneratorInput {
  return { ...p.input, race_date: charityRaceDate(p.weeks, planStart, p.raceDay ?? 'sun') } as GeneratorInput
}

/**
 * THE PERSONA CORPUS — realistic people, not grid axes.
 *
 * ⚠️ WHY THIS EXISTS ALONGSIDE THE GRIDS, and it is the most useful thing in
 * this file. A grid is an axis product: it can express "experienced" and it can
 * express "12 weeks", but it cannot express "experienced AND back running
 * regularly AND only 12 weeks", because the grid's axes are independent and a
 * real runner's are not. Measured three times in one month:
 *
 *   injury x masters          the cell existed in NEITHER grid
 *   CB-SUBFLOOR-ADMIT-01      the corpus could not reach it
 *   GRID-EARLY-ONSET-01       0 of 45,764 grid plans; 6 hand-built runners hit
 *                             it on the first attempt
 *
 * **Add a persona whenever a defect is found from a real shape** — the corpus
 * then grows from actual failures rather than from imagination, which is the
 * only way it stays ahead of the grids.
 */
export const PLAN_PERSONAS: CharityPersona[] = [
  // ---- MARATHON (the thin, high-risk distance) ----
  {
    id: 'M1 first-timer marathon, low base, long runway',
    note: '§2/§3 ramp off a tiny base; §45/§47 long-run floor vs §52 cap; volume-shortfall honesty',
    weeks: 24,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 15, longest_recent_run_km: 8,
      days_available: 4, age: 38, training_age: '<6mo', recent_quality_training: 'none' },
  },
  {
    id: 'M2 charity marathon, low base, COMPRESSED 12wk',
    note: '§44 prep-time honesty; time_compressed + volume_constrained classification',
    raceDay: 'sat',
    weeks: 12,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 10,
      days_available: 3, age: 41, training_age: '6-18mo', recent_quality_training: 'none',
      acknowledged_prep_warning: true },
  },
  {
    id: 'M3 returning marathon + knee history',
    note: '§90/ADR-022 injury delivered-volume levers; returning-runner allowance',
    weeks: 18,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 25, longest_recent_run_km: 14,
      days_available: 4, age: 44, training_age: '2-5yr', weeks_at_current_volume: 3,
      injury_history: ['knee'], recent_quality_training: 'none' },
  },
  {
    id: 'M4 sub-4:00 marathon, busy 3-day, weekday cap 45',
    // ⚠️ THIS PERSONA WAS LABELLED A REFUSAL FOR MONTHS AND IT IS NOT ONE
    // (2026-09-20). Its note read "by-design refusal (§44 days-minimum)" and
    // `expectRefusal: true`, so every review round reported "⛔ refused by
    // design" and the board reasoned about a runner we turn away.
    //
    // `DaysAvailableError` carries TWO reasons. This one is
    // `warn_unacknowledged` — a CONFIRMATION PROMPT. The runner is told "3
    // days is under the 4 a time goal needs; expect to finish rather than hit
    // the time", ticks the box, and receives a plan: 16 weeks, 30 -> 44 km,
    // classified maintenance with an honest note. Only `block` is a refusal.
    //
    // The persona now models a runner who clicks "yes, I understand", because
    // one who never clicks it is a model of nobody. Same defect as the
    // use-case envelope had (2,304 prompts counted as refusals) — I fixed it
    // there and not here, so it survived in the corpus the BOARD reads.
    // Genuine `block` coverage is carried by M6 below.
    note: 'time_target under a weekday cap on 3 days — CONFIRMATION PROMPT then a maintenance plan, not a refusal',
    raceDay: 'sat',
    weeks: 16,
    input: { acknowledged_days_warning: true, acknowledged_prep_warning: true,
      race_distance_km: 42.2, goal: 'time_target', target_time: '4:00:00', current_weekly_km: 40,
      longest_recent_run_km: 20, days_available: 3, age: 36, max_weekday_mins: 45,
      training_age: '2-5yr', recent_quality_training: 'regular' },
  },
  {
    id: 'M7 marathon off a 4 km/week base — the refusal §117 does NOT reach',
    // ⚠️ ADDED 2026-09-20 BECAUSE CORRECTING M4 LEFT NO REFUSAL COVERAGE AT ALL.
    // M4 was labelled `expectRefusal` for months and was actually a
    // confirmation prompt; fixing it removed the only persona the round
    // believed was refused. This is a real one: §111 blocks a marathon whose
    // delivered peak would exceed MAX_BASE_BUILD_RATIO x the runner's start,
    // and it is a `block`, not a prompt — no acknowledgement clears it.
    //
    // Measured: a capped peak for this cohort lands below the credible
    // marathon floor for 100% of cases (median 22.4 km against 52.8), so the
    // refusal is the correct outcome and not a gap. It must also name a next
    // step (§44's "not yet"), which the round asserts.
    // ⚠️ RE-POINTED 2026-09-20 FROM 8 km/week TO 4, BECAUSE §117 ADMITS 8.
    // The finish-goal run-walk shape drops the beginner marathon peak to 32,
    // and §111's door with it: ceil(32/4) = 8. So the persona that existed to
    // exercise the refusal path stopped being refused the day §117 shipped —
    // which is the intended outcome and would ALSO have silently deleted the
    // corpus's only genuine block if the id had simply been left to pass.
    //
    // ⚠️ THIS IS THE SECOND TIME THE REFUSAL PERSONA HAS HAD TO BE REBUILT.
    // M4 carried `expectRefusal` for months while actually being a
    // confirmation prompt; M6 replaced it and lasted one day. A corpus's
    // refusal coverage is only as durable as the door it points at, and the
    // door moves. 4 km/week is below §117's 8 AND below §116's on-ramp floor
    // of 6, so it exercises the one cohort nothing currently reaches.
    note: 'sub-floor base BELOW §117 — §111 block, the refusal path the corpus would otherwise never exercise',
    raceDay: 'sun',
    weeks: 20,
    expectRefusal: true,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 4,
      longest_recent_run_km: 2, days_available: 4, age: 34,
      fitness_level: 'beginner', training_age: '6-18mo',
      recent_quality_training: 'none', hard_session_relationship: 'neutral',
      injury_history: [], max_hr: 186,
      acknowledged_days_warning: true, acknowledged_prep_warning: true } as never,
  },
  {
    id: 'M5 masters charity marathon (age 58)',
    note: 'masters cadence; age→maxHR; injury vector (Willy/Sims)',
    weeks: 20,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 16,
      days_available: 4, age: 58, training_age: '2-5yr', recent_quality_training: 'occasional' },
  },
  // ---- HALF MARATHON ----
  {
    id: 'H1 first-timer HM, very low base',
    note: 'beginner duration-anchored; §52 lopsided-week → maintenance honesty',
    weeks: 16,
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 10, longest_recent_run_km: 5,
      days_available: 3, age: 34, training_age: '<6mo', recent_quality_training: 'none' },
  },
  {
    id: 'H2 charity HM + shin splints',
    note: 'injury caps; tissue tolerance vs fitness ramp',
    raceDay: 'sat',
    weeks: 14,
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 25, longest_recent_run_km: 12,
      days_available: 4, age: 40, training_age: '6-18mo', injury_history: ['shin_splints'],
      recent_quality_training: 'none' },
  },
  {
    id: 'H3 sub-2:00 HM, intermediate',
    note: 'quality onset (§89); pace bands; time_target build',
    weeks: 13,  // was 12: a SUNDAY race is 6 days short of a whole
    // week, so this persona — designed to sit exactly ON the prep-time minimum
    // — fell under it when the cohort moved off Monday races. Bumped to keep the
    // scenario it was written to test (a runner who just clears the minimum),
    // rather than silently converting it into a refusal case.
    input: { race_distance_km: 21.1, goal: 'time_target', target_time: '1:59:00', current_weekly_km: 35,
      longest_recent_run_km: 16, days_available: 4, age: 33, training_age: '2-5yr',
      recent_quality_training: 'regular' },
  },
  // ---- 10K ----
  {
    id: 'T1 couch-to-10K charity beginner',
    note: 'low-vol short race; beginner structure; no phantom quality',
    raceDay: 'sat',
    weeks: 10,
    input: { race_distance_km: 10, goal: 'finish', current_weekly_km: 8, longest_recent_run_km: 4,
      days_available: 3, age: 37, training_age: '<6mo', recent_quality_training: 'none' },
  },
  {
    id: 'T2 sub-50 10K improver',
    note: 'time_target; intensity distribution at moderate volume',
    weeks: 11,  // was 10: a SUNDAY race is 6 days short of a whole
    // week, so this persona — designed to sit exactly ON the prep-time minimum
    // — fell under it when the cohort moved off Monday races. Bumped to keep the
    // scenario it was written to test (a runner who just clears the minimum),
    // rather than silently converting it into a refusal case.
    input: { race_distance_km: 10, goal: 'time_target', target_time: '49:00', current_weekly_km: 30,
      longest_recent_run_km: 12, days_available: 4, age: 31, training_age: '2-5yr',
      recent_quality_training: 'regular' },
  },
  {
    id: 'T3 masters 10K + knee (age 55)',
    note: 'masters + injury combined; conservative ramp (delivered injury-cap + peak-not-below-start residuals cluster here)',
    raceDay: 'sat',
    weeks: 12,
    input: { race_distance_km: 10, goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 9,
      days_available: 4, age: 55, training_age: '2-5yr', injury_history: ['knee'],
      recent_quality_training: 'occasional' },
  },
  // ── DECLARED-LEVEL VARIANTS (added 2026-09-15) ────────────────────────────
  //
  // WHY THESE EXIST. Every persona above lets the engine ASSESS the runner. The
  // wizard, however, sends `user_declared_level` on EVERY generation
  // (`GeneratePlanScreen.tsx`), and a charity first-timer who ticks
  // "intermediate" because they ran a 10K once is the most likely real-world
  // deviation from this whole set. It had no coverage in any review round.
  //
  // Measured before §79 Amendment 3: T1 declaring `intermediate` received
  // **Hill reps — 90s at Zone 4-5, RPE 8 in week 5** and Long VO2max in week 7,
  // with zero invariant errors. These three are the same runners as M1/H1/T1,
  // differing ONLY by that one wizard answer, so a regression shows up as a
  // diff against their twin rather than needing its own expected output.
  {
    id: 'T1d couch-to-10K who DECLARES intermediate',
    note: 'declared level above structural — §79 Am.3 must withhold vo2max/hills',
    raceDay: 'sat',
    weeks: 10,
    input: { race_distance_km: 10, goal: 'finish', current_weekly_km: 8, longest_recent_run_km: 4,
      days_available: 3, age: 37, training_age: '<6mo', recent_quality_training: 'none',
      user_declared_level: 'intermediate' },
  },
  {
    id: 'H1d first-timer HM who DECLARES intermediate',
    note: 'declared level above structural on a very low base; tempo yes, intervals no',
    weeks: 14,
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 10, longest_recent_run_km: 5,
      days_available: 3, age: 34, training_age: '<6mo', recent_quality_training: 'none',
      user_declared_level: 'intermediate' },
  },
  {
    id: 'M1d first-timer marathon who DECLARES experienced',
    note: 'the strongest over-claim available in the wizard, on the least prepared marathoner',
    weeks: 18,
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 15, longest_recent_run_km: 8,
      days_available: 4, age: 38, training_age: '<6mo', recent_quality_training: 'none',
      user_declared_level: 'experienced' },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ENGINE PERSONAS — PERSONA-CORPUS-01 (2026-09-19)
  //
  // The six runners built by hand for the end-to-end regression pass. They are
  // here because they FOUND something: E4 produced `{ base 1..0 }`, an inverted
  // phase the canonical schema rejects, which 45,764 grid plans never reached.
  // Deliberately NOT charity shapes — the point is coverage the charity set and
  // the grids both miss.
  // ──────────────────────────────────────────────────────────────────────────
  {
    id: 'E1 never-run beginner, marathon, long runway',
    note: 'the flagship first-timer: §111 admission, §2/§3 ramp off nothing, §80 time-on-feet',
    weeks: 28, cohort: 'engine',
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 15, longest_recent_run_km: 5,
      days_available: 4, age: 35, training_age: '<6mo', recent_quality_training: 'none' },
  },
  {
    id: 'E2 beginner, marathon, TIME goal',
    note: '§110 Am.2 — the only beginner cohort that gets quality; §22 goal-pace exposure',
    weeks: 28, cohort: 'engine',
    input: { race_distance_km: 42.2, goal: 'time_target', target_time: '4:30:00',
      current_weekly_km: 30, longest_recent_run_km: 14, days_available: 5, age: 35,
      training_age: '6-18mo', recent_quality_training: 'occasional' },
  },
  {
    id: 'E3 masters 58, HM, knee history',
    note: '§3 masters cadence x §21 injury substitution x §110 zero-quality honesty',
    weeks: 16, cohort: 'engine',
    input: { race_distance_km: 21.1, goal: 'finish', current_weekly_km: 20, longest_recent_run_km: 10,
      days_available: 4, age: 58, training_age: '2-5yr', recent_quality_training: 'none',
      injury_history: ['knee'] },
  },
  {
    id: 'E4 experienced, 10K, TIME goal, SHORT runway',
    note: '⚠️ THE ONE THAT FOUND PHASE-EMPTY-01. ADR-021 early onset on a 12-week plan collapses '
        + 'the base phase to zero weeks. NEITHER grid pairs experienced + regular quality + short runway.',
    weeks: 12, cohort: 'engine',
    input: { race_distance_km: 10, goal: 'time_target', target_time: '0:45:00',
      current_weekly_km: 55, longest_recent_run_km: 22, days_available: 5, age: 35,
      training_age: '5yr+', recent_quality_training: 'regular' },
  },
  {
    id: 'E5 intermediate, marathon, 3 days + 30-min weekday cap',
    note: 'the constrained week: §52 lopsidedness, §114 long-run share, weekday-cap honesty note',
    weeks: 28, cohort: 'engine',
    input: { race_distance_km: 42.2, goal: 'finish', current_weekly_km: 30, longest_recent_run_km: 16,
      days_available: 3, max_weekday_mins: 30, age: 40, training_age: '2-5yr',
      recent_quality_training: 'occasional' },
  },
  {
    id: 'E6 experienced, 50K ultra, finish',
    note: 'ultra shapes: §80 duration anchoring, back-to-back longs, §110 floor scoping',
    weeks: 30, cohort: 'engine',
    input: { race_distance_km: 50, goal: 'finish', current_weekly_km: 55, longest_recent_run_km: 30,
      days_available: 5, age: 42, training_age: '5yr+', recent_quality_training: 'regular' },
  },
]

/**
 * The charity subset — every persona that predates PERSONA-CORPUS-01 plus any
 * later one explicitly tagged `'charity'`.
 *
 * DERIVED, not a second list: existing consumers (`charity-scenarios.ts`,
 * `charityCohort.test.ts`, the `charity personas` cohort in `audit:plans`, and
 * the marathon review personas in `measure:fitness`) see exactly what they saw
 * before, so no charity baseline moves.
 */
export const CHARITY_PERSONAS: CharityPersona[] = PLAN_PERSONAS.filter(p => p.cohort !== 'engine')

/** The wider realistic-runner set. See PLAN_PERSONAS for why it exists. */
export const ENGINE_PERSONAS: CharityPersona[] = PLAN_PERSONAS.filter(p => p.cohort === 'engine')
