// ─── Benchmark input ──────────────────────────────────────────────────────────
// Used to derive VDOT and accurate training paces (Jack Daniels model).
// 'race': any recent race result. 'tt_30min': distance covered in a 30-minute time trial.

export interface BenchmarkInput {
  type: 'race' | 'tt_30min'
  distance_km: number    // race distance OR distance covered in 30 min
  time: string           // finish time e.g. "25:30", "1:52:00". For tt_30min always "30:00".
  benchmark_date?: string // ISO date — used to apply stale-benchmark VDOT discount (>6 mo)
}

export type TrainingAge = '<6mo' | '6-18mo' | '2-5yr' | '5yr+'

// ─── Plan generator input ─────────────────────────────────────────────────────
// Shared between the API route and the client form — must not import server modules.

export interface GeneratorInput {
  // Required
  race_date: string
  race_distance_km: number
  goal: 'finish' | 'time_target'
  current_weekly_km: number
  longest_recent_run_km: number
  days_available: number
  age: number                   // used for Tanaka max HR derivation

  // Derived server-side (optional — computed from age + data if absent)
  fitness_level?: 'beginner' | 'intermediate' | 'experienced'
  resting_hr?: number           // optional — improves zone accuracy via Karvonen
  max_hr?: number               // optional — derived from age (Tanaka: 208 − 0.7 × age)

  // R23 rebuild — drives returning-runner allowance + reshape decisions
  training_age?: TrainingAge

  // M-02 — fresh-from-layoff detection. When < FRESH_RETURN_WEEKS_THRESHOLD,
  // engine treats current_weekly_km as aspirational and starts the plan at
  // FRESH_RETURN_START_FRACTION × current_weekly_km. (CoachingPrinciples §29)
  weeks_at_current_volume?: number

  // 2026-04-28 / H-01 — two-step prep-time UX (CoachingPrinciples §44). When
  // validatePrepTime returns 'warn' and this flag is absent or false, the
  // engine refuses generation and surfaces alternatives. Setting it true on a
  // second call signals the runner has seen the warning and accepts the
  // constraint; the plan is then generated with maintenance-grade expectations.
  acknowledged_prep_warning?: boolean

  // R23 rebuild — preferred long-run weekend day (default Sun if absent)
  preferred_long_run_day?: 'sat' | 'sun'

  // Benchmark — optional, enables VDOT-based pace derivation
  benchmark?: BenchmarkInput

  // Optional
  race_name?: string
  target_time?: string
  zone2_ceiling?: number
  days_cannot_train?: string[]
  max_weekday_mins?: number
  max_weekend_mins?: number
  training_style?: 'predictable' | 'variety' | 'minimalist' | 'structured'
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  motivation_type?: 'identity' | 'achievement' | 'health' | 'social'
  injury_history?: string[]
  terrain?: 'road' | 'trail' | 'mixed'
  athlete_name?: string
}

export type WeekType =
  | 'completed'
  | 'deload_done'
  | 'current'
  | 'normal'
  | 'deload'
  | 'race_event'
  | 'race'

export type SessionType =
  | 'run' | 'easy' | 'long'
  | 'quality' | 'tempo' | 'intervals' | 'hard'
  | 'race' | 'recovery'
  | 'strength' | 'cross-train'
  | 'rest'

// INV-PLAN-009: { name, start_week, end_week } — added R23; absent on legacy plans
export interface Phase {
  name: 'base' | 'build' | 'peak' | 'taper'
  start_week: number
  end_week: number
}

export type PrimaryMetric = 'distance' | 'duration'

export interface Session {
  /** INV-PLAN-009: deterministic ID "w{N}-{day}" e.g. "w5-wed". Present on R23+ plans; absent on legacy. */
  id?: string
  type: SessionType
  label: string
  /** Legacy free-text display field. Kept for backward compat with hand-authored gists.
   *  Generator writes structured fields below instead. App prefers structured when present. */
  detail: string | null

  // Structured fields — generator-populated, optional for legacy gists
  distance_km?: number                    // e.g. 8.5
  duration_mins?: number                  // e.g. 45
  primary_metric?: PrimaryMetric          // session-level override of plan default
  zone?: string                           // e.g. "Zone 2" | "Zone 3–4"
  hr_target?: string                      // e.g. "< 145 bpm" | "155–165 bpm"
  pace_target?: string                    // e.g. "6:30–7:00 /km"
  rpe_target?: number                     // 1–10
  /** Why this session + what to watch for. Max 3 items. */
  coach_notes?: [string, string?, string?]
}

export interface Week {
  n: number
  date: string                            // ISO date string e.g. "2026-04-06"
  label: string
  theme: string
  type: WeekType
  phase?: 'base' | 'build' | 'peak' | 'taper'
  badge?: 'deload' | 'holiday' | 'race'
  sessions: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', Session>>
  long_run_hrs: number | null
  weekly_km: number
  weekly_duration_mins?: number           // for time-based plans, alongside weekly_km
  race_notes?: string
  tune_up_callout?: string                // L-01 — optional mid-build tune-up race suggestion
}

export interface PlanMeta {
  // Core identity
  athlete: string
  handle: string
  race_name: string
  race_date: string
  race_distance_km: number
  charity: string
  plan_start: string
  quit_date: string

  // HR profile
  resting_hr: number
  max_hr: number
  zone2_ceiling: number

  // Plan metadata
  version: string
  last_updated: string
  notes: string

  // Plan-level display default — 'distance' assumed if absent (legacy compat)
  primary_metric?: PrimaryMetric

  // Athlete profile — stored so R20 reshaper can operate without re-asking the user
  fitness_level?: 'beginner' | 'intermediate' | 'experienced'
  goal?: 'finish' | 'time_target'
  target_time?: string                    // e.g. "4:30:00" — only if goal = time_target
  days_available?: number
  training_style?: 'predictable' | 'variety' | 'minimalist' | 'structured'
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  motivation_type?: 'identity' | 'achievement' | 'health' | 'social'
  injury_history?: string[]               // e.g. ["achilles", "knee"]
  terrain?: 'road' | 'trail' | 'mixed'

  // Generator metadata
  generated_at?: string                   // ISO timestamp of generation
  generator_version?: string              // e.g. "1.0"

  // R18 — confidence score produced at generation time (INV-PLAN-008: PAID only)
  confidence_score?: number               // 1–10
  confidence_risks?: string[]             // e.g. ["low base volume", "tight timeline"]

  // R23 — hybrid generation fields
  tier?: 'free' | 'trial' | 'paid'       // tier at which plan was generated
  compressed?: boolean                    // true if available weeks < ideal minimum for this distance
  coach_intro?: string                    // PAID only — enricher-generated intro paragraph

  // R24 — VDOT / zone model fields
  age?: number                            // athlete age at time of generation
  vdot?: number                           // Jack Daniels VDOT score (raw, benchmark-derived) — matches Daniels' published tables
  vdot_training_anchor?: number           // discounted VDOT used to derive training paces (CoachingPrinciples §10)
  goal_pace_per_km?: string               // e.g. "5:04 /km" — target race pace, not a training zone
  recalibration_weeks?: number[]          // week numbers where a benchmark re-test is scheduled
  benchmark?: BenchmarkInput              // stored so recalibration can reference original

  // R23 rebuild — VDOT conservatism + returning runner + compressed flag
  vdot_discount_applied_pct?: number     // total VDOT discount (3% default + 5% if benchmark stale)

  // H-06 — peak vs base overload classification (CoachingPrinciples §23)
  volume_profile?: 'build' | 'maintenance'  // 'build' when peak ≥ 110% of W1; else 'maintenance'
  volume_constraint_note?: string         // human-readable explanation when 'maintenance'

  // M-05 — replace single `compressed` boolean with persona-aware classification.
  // (CoachingPrinciples §31)
  compression_classification?: 'optimal' | 'appropriate_for_persona' | 'constrained_by_inputs'
  training_age?: TrainingAge             // stored for R20 reshaper
  returning_runner_allowance_active?: boolean  // true if 15%/3wk allowance applied
  fresh_return_active?: boolean                  // true if M-02 layoff start-fraction applied

  // 2026-04-28 / M-02 — communicate the returning-runner / fresh-return
  // allowance to the runner. CoachingPrinciples §51. Format mirrors
  // volume_constraint_note: a single human-readable diagnosis + what was
  // scaled and why. Present only when the corresponding allowance fired.
  returning_runner_note?: string

  // 2026-04-28 / L-03 — HR data fallback surface (CoachingPrinciples §50).
  // hr_zone_method names which of the four fallback levels was used; non-Karvonen
  // methods carry hr_assumption_note. Estimated max is surfaced when computed
  // from age (Tanaka).
  hr_zone_method?: 'karvonen' | 'karvonen_estimated_max' | 'percent_of_max' | 'percent_of_estimated_max'
  hr_assumption_note?: string
  hr_estimated_max?: number

  // 2026-04-28 / H-01 — prep-time validation surface (CoachingPrinciples §44).
  // 'ok' on adequately-resourced plans, 'warned' on plans generated under an
  // acknowledged warn-status timeline. Block-status inputs never reach plan
  // construction (PrepTimeError surfaces at the entry point).
  prep_time_status?: 'ok' | 'warned'
  prep_time_warning?: string
  prep_time_alternatives?: string[]
  prep_time_weeks_available?: number
  prep_time_weeks_required_ok?: number
}

export interface Plan {
  meta: PlanMeta
  /** Phase distribution — present on R23+ plans; absent on legacy gist plans. */
  phases?: Phase[]
  weeks: Week[]
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  distance: number        // metres
  moving_time: number     // seconds
  elapsed_time: number    // seconds
  total_elevation_gain: number
  average_heartrate?: number
  max_heartrate?: number
  average_speed: number
  suffer_score?: number
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  strava_refresh_token?: string
  created_at: string
}
