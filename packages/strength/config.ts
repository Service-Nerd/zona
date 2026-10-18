// STRENGTH-ENGINE-01 — every strength numeric, with the principle that explains it.
//
// The strength engine's statute book, in the same way `GENERATION_CONFIG` is the
// run engine's. Every key maps to a section of `docs/canonical/StrengthPrinciples.md`
// (S1–S12), and `strengthConfigSync.test.ts` fails the build when a key has no
// section. Coaching Board, 2026-10-16 (Phase 0 sitting): CORRECT WITH AMENDMENT.
//
// ⚠️ These are evidence-graded DEFAULTS, not findings. ACSM 2026 itself calls the
// minimal-dose and concurrent-training evidence insufficient. Tune here, never inline.

import type { InjuryTag, SessionMinutes, SessionsPerWeek } from './types'

export const STRENGTH_CONFIG = {
  // S1 — frequency and the split
  SESSIONS_PER_WEEK_RANGE: [1, 4] as const,
  RECOMMENDED_SESSIONS_PER_WEEK: 2 as SessionsPerWeek,
  /** S1 Am. — never more than two heavy-leg sessions a week, whatever the day count. */
  MAX_HEAVY_LEG_SESSIONS_PER_WEEK: 2,

  // S2/S3 — placement against the run week (§7)
  /** Days between two heavy-leg sessions (48 h). */
  MIN_DAYS_BETWEEN_HEAVY_LEGS: 2,
  /** Days after an easy-day heavy-leg session that must hold no quality/long/race run. */
  HEAVY_LEGS_CLEAR_DAYS_AFTER: 2,
  /** Same-day gap note when stacked after a quality run. */
  STACK_GAP_HOURS_MIN: 3,
  STACK_GAP_HOURS_IDEAL: 6,

  // S5 — taper and race week (§6)
  HEAVY_LEGS_CUTOFF_DAYS_BEFORE_RACE: 10,
  RACE_WEEK_DAYS: 7,
  /** No strength at all on race day or the day before. */
  NO_STRENGTH_DAYS_BEFORE_RACE: 1,
  TAPER_SESSIONS_PER_WEEK: 1,
  TAPER_SESSIONS_PER_WEEK_MASTERS: 2,

  // S6 — dose
  /** Weeks of technique-first work before heavy loading, by experience. */
  NOVICE_BLOCK_WEEKS: { new: 4, some: 2, regular: 0 } as const,
  NOVICE_REPS: 10,
  NOVICE_RIR: 3,
  /** Running-focused lower-body main lifts after the novice block: heavy. */
  HEAVY_REPS_RUNNING_LOWER: 5,
  MAIN_REPS_GENERAL: 8,
  MAIN_REPS_UPPER: 8,
  ACCESSORY_REPS: 10,
  MAIN_SETS: 3,
  /** S10 — the fill step may add sets up to these when a session is under budget. */
  MAIN_SETS_MAX: 4,
  ACCESSORY_SETS_MAX: 3,
  CORE_SETS_MAX: 3,
  /** Fill until the session uses this share of its budget. */
  FILL_TARGET: 0.8,
  ACCESSORY_SETS: 2,
  CORE_SETS: 2,
  CORE_SECONDS: 30,
  /** Taper / maintenance: one set at kept intensity holds strength (Spiering 2021). */
  MAINTENANCE_MAIN_SETS: 2,
  MAINTENANCE_ACCESSORY_SETS: 1,
  /** Peak: heavy and low volume. */
  PEAK_MAIN_SET_REDUCTION: 1,
  /** Run deload week → strength deload: sets × this, rounded, floor 1 (§3). */
  DELOAD_SET_FACTOR: 0.6,
  /** A recovery-eased session (S13): the day's sets × this, rounded, floor 1. Equal to the deload factor by
   *  ruling (STRENGTH-RECOVERY-01); named separately so it can diverge by a later ruling, never by accident. */
  RECOVERY_SET_FACTOR: 0.6,
  /** Weeks a chosen exercise is kept before the next variant (progression block). */
  BLOCK_WEEKS: 4,

  // S7 — effort
  RIR_FLOOR: 1,
  RIR_FLOOR_LOWER_HEAVY: 2,
  RIR_MAIN: 2,

  // S8 — plyometrics
  PLYO_MIN_WEEKS: 4,
  /** `new` lifters wait a second block. */
  PLYO_MIN_WEEKS_NEW: 8,
  PLYO_CONTACTS_START: 30,
  PLYO_CONTACTS_MAX: 60,
  PLYO_CONTACTS_STEP: 10,
  PLYO_CONTACTS_STEP_EVERY_WEEKS: 2,
  PLYO_CONTACTS_PER_SET: 10,
  /** §21's list, by value. The bridge's parity test keeps it equal to HILL_RESTRICTING_INJURIES. */
  PLYO_RESTRICTING_INJURIES: ['knee', 'itb', 'achilles', 'shin', 'calf', 'plantar'] as InjuryTag[],

  // S10 — the session clock
  WARMUP_MINUTES: { 30: 6, 45: 8, 60: 10 } as Record<SessionMinutes, number>,
  REST_S: { heavy: 150, main: 90, accessory: 60, core: 30, plyo: 60, warmup: 0, mobility: 0 } as const,
  SECONDS_PER_REP: 3,
  SECONDS_PER_CONTACT: 1,
  TRANSITION_S: 30,
  WARMUP_ITEM_SECONDS: 40,
  MOBILITY_ITEM_SECONDS: 45,
  /** A non-mobility session must use at least this share of its budget. */
  MIN_BUDGET_USE: 0.5,
  /** Race-week mobility session length, minutes. */
  MOBILITY_SESSION_MINUTES: 15,

  // S12 — standalone (no run plan)
  STANDALONE_WEEKS: 8,
  STANDALONE_BASE_WEEKS: 4,

  // ── S14 progression from the runner's log (STRENGTH-PROGRESSION-01, Coaching Board 2026-10-18) ──
  /** The smallest sensible jump on a lower-body lift. */
  LOAD_STEP_KG_LOWER: 2.5,
  /** The smallest sensible jump on an upper-body lift. */
  LOAD_STEP_KG_UPPER: 1,
  /** A step bigger than this share of the load is too big: add a rep instead (Sims). */
  LOAD_STEP_MAX_PCT: 0.1,
  /** Reps added before the load goes up, when the step is too big. */
  REP_PROGRESSION_MAX: 2,
  /** "Hard" twice at one load: come down by this share. */
  LOAD_REDUCE_PCT: 0.1,
  /** At most one step per lift in this many days (Willy). */
  LOAD_STEP_MIN_DAYS: 7,
  /** Suggested loads round to this. */
  LOAD_ROUND_KG: 0.5,
  /** Which muscles an injury tag makes a lift "load the injury" (S14, Willy): "easy" then counts as "right". */
  INJURY_LOADED_MUSCLES: {
    knee: ['quads'], itb: ['hip_abductors', 'quads'], achilles: ['calves', 'soleus'], shin: ['calves', 'soleus'],
    calf: ['calves', 'soleus'], plantar: ['calves', 'soleus'], hip: ['glutes', 'hip_abductors', 'adductors', 'hip_flexors'],
    hamstring: ['hamstrings'], back: ['back'], shoulder: ['shoulders', 'chest'],
  } as const,
} as const

export type StrengthConfig = typeof STRENGTH_CONFIG
