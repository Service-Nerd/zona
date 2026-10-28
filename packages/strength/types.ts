// STRENGTH-ENGINE-01 (ADR-024) — the strength engine's public types.
//
// 🔴 THIS PACKAGE IMPORTS NOTHING FROM THE APP. Not `@/lib/plan`, not `@/types`,
// not Supabase, not the AI owner. It meets the run engine only through
// `RunContext`, built by `lib/strength-bridge`. That boundary is what lets it
// become its own app (call it with `null`), and `boundary.test.ts` holds it.

export type Day = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type EquipmentTag =
  | 'bodyweight' | 'bands' | 'dumbbells' | 'kettlebell' | 'bench' | 'box'
  | 'pullup_bar' | 'barbell' | 'rack' | 'cable' | 'machines'

export type InjuryTag =
  | 'knee' | 'itb' | 'achilles' | 'shin' | 'calf' | 'plantar' | 'hip' | 'hamstring' | 'back' | 'shoulder'

export type Focus = 'running' | 'general'
export type Experience = 'new' | 'some' | 'regular'
export type SessionMinutes = 30 | 45 | 60
export type SessionsPerWeek = 1 | 2 | 3 | 4

/** What the runner tells the strength engine (ADR-024 §3). */
export interface StrengthProfile {
  focus: Focus
  session_minutes: SessionMinutes
  sessions_per_week: SessionsPerWeek
  equipment: EquipmentTag[]
  experience: Experience
  /** Added to the run plan's injury tags, never replacing them. */
  injury_tags?: InjuryTag[]
  /** Diagnosed osteoporosis / vertebral fracture: no high impact, no loaded spinal flexion. */
  bone_health_flag?: boolean
  /** Days the runner cannot do strength. Derived from `available_days` when those are set (PINNED-DAYS-01). */
  unavailable_days?: Day[]
  /** PINNED-DAYS-01 (S1 Am.2) — the days the runner CHOSE to lift (1–MAX_CHOSEN_DAYS). When set they ARE the
   *  sessions: `sessions_per_week` is their count and every other day is unavailable, so a session never moves off
   *  them. Absent: the engine chooses the days (the behaviour before 2026-10-18). */
  available_days?: Day[]
}

// ── RunContext — the ONLY thing strength knows about running (ADR-024 §2) ──

/** Which days are hard, never how hard. No paces, zones or distances. */
export type RunRole = 'rest' | 'easy' | 'recovery' | 'long' | 'quality' | 'race' | 'cross'
export type RunPhase = 'base' | 'build' | 'peak' | 'taper' | 'race_week' | 'deload' | 'maintenance'

export interface RunDay {
  /** ISO local date, YYYY-MM-DD. */
  date: string
  day: Day
  week_n: number
  role: RunRole
  /** SESSION-SLOTS-01 — how many runs the day holds (2 = a double the runner made). Absent = one or none. */
  runs?: number
}

export interface RunWeek {
  n: number
  phase: RunPhase
}

export interface RunContext {
  version: 1
  /** Every calendar day the run plan covers, in order, no gaps. */
  days: RunDay[]
  weeks: RunWeek[]
  race_date: string | null
  injury_tags: InjuryTag[]
  /** Age at or over the run engine's masters threshold, decided by the bridge. */
  masters: boolean
}

// ── Catalogue ──

export type Pattern =
  | 'squat' | 'hinge' | 'single_leg' | 'calf' | 'hip_abduction' | 'plyometric'
  | 'upper_push' | 'upper_pull'
  | 'anti_rotation' | 'anti_extension' | 'lateral_core'
  | 'mobility' | 'warmup'

export type Region = 'lower' | 'upper' | 'core' | 'prep'

export type Muscle =
  | 'quads' | 'glutes' | 'hamstrings' | 'calves' | 'soleus' | 'hip_abductors' | 'adductors'
  | 'core' | 'obliques' | 'chest' | 'shoulders' | 'triceps' | 'back' | 'biceps' | 'hip_flexors' | 'full_body'

export interface Exercise {
  id: string
  name: string
  pattern: Pattern
  muscles: Muscle[]
  /** Any ONE inner list satisfies it. `[['bodyweight']]` needs nothing. */
  equipment: EquipmentTag[][]
  level: 1 | 2 | 3
  unilateral: boolean
  impact: 'none' | 'low' | 'high'
  /** Loaded spinal flexion: excluded under the bone-health flag (S9). */
  spinal_flexion_loaded?: boolean
  avoid_with: InjuryTag[]
  /** How the dose is counted. */
  measure: 'reps' | 'seconds' | 'contacts'
  regress_to?: string
  progress_to?: string
  /** A warm-up move that IS a training exercise in lighter form: left out of the warm-up
   *  when that exercise is in the session, so a session never says the same thing twice. */
  same_as?: string
  /** The kit anchors the body rather than loading it (an inverted row hangs from a barbell in a rack): a
   *  bodyweight lift, logged by feel only (S14). STRENGTH-BW-LOG-01. */
  bodyweight?: true
  /** Never fills a MAIN slot (S9 Am.1): an isolation, ballistic or supramaximal-eccentric move
   *  is not where heavy load lives. Accessory slots only. */
  not_main?: boolean
  media: { animation_id: string }
  cues: string[]
}

// ── Output ──

export type SessionKind = 'full_body' | 'lower_core' | 'upper_core' | 'mobility'
export type SplitKind = 'full_body' | 'full_body_plus_upper' | 'upper_lower' | 'standalone'
export type BlockRole = 'warmup' | 'plyo' | 'main' | 'accessory' | 'core' | 'mobility'

export interface Prescription {
  exercise_id: string
  sets: number
  reps?: number
  seconds?: number
  contacts?: number
  /** Reps in reserve. `null` for timed, mobility and warm-up work. */
  rir: number | null
  rest_s: number
  per_side: boolean
  /** Items sharing a tag are done as a superset; rest counts once per round. */
  superset?: string
  /** S3 Am.2 — light leg work on a session that is not a heavy-leg session: calf or hip, submaximal. Never counts
   *  as heavy legs (S2), so it may sit beside a long run. */
  light?: true
}

export interface Block {
  role: BlockRole
  items: Prescription[]
}

export interface StrengthSession {
  date: string | null
  day: Day
  week_n: number
  kind: SessionKind
  heavy_legs: boolean
  /** Stacked after a quality run the same day: carries the gap note (S4). */
  after_quality_run: boolean
  estimated_minutes: number
  blocks: Block[]
  /** STRENGTH-RECOVERY-01 (S13) — set by `easeForRecovery` when the runner accepted a recovery ease. */
  eased_for?: 'recovery'
}

export interface StrengthWeek {
  n: number
  phase: RunPhase
  sessions: StrengthSession[]
}

export type StrengthNote =
  | 'bodyweight_ceiling'
  | 'split_is_inference'
  | 'legs_limited_by_run_week'
  | 'fewer_sessions_than_asked'
  | 'pattern_unavailable'

export interface StrengthPlan {
  version: 1
  standalone: boolean
  split: SplitKind
  profile: StrengthProfile
  weeks: StrengthWeek[]
  /** Honest notes for the runner-facing layer to phrase (S11). */
  notes: StrengthNote[]
  /** STRENGTH-START-WEEK-01 — the date strength started (ISO). The technique block, the jumps
   *  gate and every level climb count from the week containing it, never from the run plan's
   *  week 1. No session is placed before it. Kept across regenerations. */
  start_date: string
  /** STRENGTH-PROGRESSION-01 — the run plan's injury tags plus the profile's, as generation used them, so S14 can slow
   *  progression on a lift that loads one. Absent on plans generated before 2026-10-18 (fall back to the profile's). */
  injury_tags?: InjuryTag[]
  /** STRENGTH-LEGS-DAY-01 — when the runner's chosen days leave ordinary weeks without a legal heavy-leg day, the one
   *  unchosen day whose swap would let heavy legs in most often, and the run it holds. Never acted on by the engine:
   *  the runner chose their days (PINNED-DAYS-01). Absent when nothing would improve. */
  legs_day_suggestion?: { day: Day; replaces: Day; run: RunRole | null; weeks: number }
}
