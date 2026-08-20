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
  /**
   * CoachingPrinciples §50 — where max_hr came from. 'observed' means it was read
   * from device history (the highest heart rate on record), which is a floor, not
   * a maximum, for anyone who has never run flat out wearing a sensor. Best-effort:
   * set when the wizard reads HealthKit directly; a value arriving via
   * user_settings has no recorded provenance and is left unmarked. The
   * plausibility gate protects both cases — it is source-independent by design.
   */
  max_hr_source?: 'observed'

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
  /** Structural classification, generator-stamped. A long run and a race-week
   *  shakeout are both `type: 'easy'`; before `role`, they were told apart by
   *  matching words in `label` — which the AI enricher rewrites, silently
   *  breaking classification (D-17). `role` is the label-independent signal:
   *  the enricher cannot set it (EnrichedWeekSchema exposes only label +
   *  coach_notes). Absent on legacy plans → consumers fall back to the label
   *  heuristic (see lib/plan/sessionRole.ts). */
  role?: 'long_run' | 'shakeout'
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
  /** Pace string for an embedded long-run pace segment (e.g. "5:45–6:05 /km"). Present only
   *  on long runs that carry a structural pace segment per §24b/§24d. Used by invariant checks. */
  lr_segment_pace?: string

  // ─── AI-DEPTH-07 additive fields (2026-05-12) ──────────────────────────────
  // Schema-only — engine does not populate these yet. Reserved for AI-DEPTH-08
  // (post-race reshape) and future depth work. All optional; absence = legacy
  // behaviour. Consumers must tolerate undefined.

  /** Pivotal session flag — set true on long runs, race-pace tempos, planned
   *  tune-ups. AI-DEPTH-08 uses this to know which sessions to defend during
   *  a post-race reshape. */
  key_session?: boolean
  /** Embedded run-walk strategy for the session, e.g. "9:1 from km 10" or
   *  "5:1 throughout". Free-form; displayed verbatim. Marathon / ultra primarily. */
  run_walk_strategy?: string
  /** In-session fueling protocol, e.g. "gel every 25 min from km 10" or
   *  "60g carb/hr, sip water at every aid station". Free-form; displayed verbatim. */
  fueling_protocol?: string
}

export interface Week {
  n: number
  date: string                            // ISO date string e.g. "2026-04-06"
  label: string
  theme: string
  type: WeekType
  phase?: 'base' | 'build' | 'peak' | 'taper' | 'foundation' | 'maintenance_restoration' | 'maintenance_base'
  badge?: 'deload' | 'holiday' | 'race'
  sessions: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', Session>>
  long_run_hrs: number | null
  weekly_km: number
  weekly_duration_mins?: number           // for time-based plans, alongside weekly_km
  race_notes?: string
  tune_up_callout?: string                // L-01 — optional mid-build tune-up race suggestion

  /** GEN-FIX-10 (§8, 2026-08-06) — a reshape deliberately removed this week's
   *  quality session in response to a fatigue or efficiency signal. Records WHY
   *  the week no longer looks like a build week, so INV-PLAN-QUALITY-EXPECTED
   *  can tell an intentional downgrade from a generator defect. Set by the
   *  reshaper; never by generateRulePlan. */
  quality_downgraded?: {
    trigger: string      // AdjustmentTrigger.type, e.g. 'ef_decline' | 'fatigue_accumulation'
    at:      string      // ISO timestamp
  }

  /** AI-DEPTH-07 — race-day result captured into the plan on the race week.
   *  Populated post-event (by an explicit log-result action; not by Strava
   *  webhooks). Consumed by AI-DEPTH-08 (post-race reshape) and any future
   *  retrospective surfaces. Null/undefined = race not yet run or not logged. */
  result_embedded?: RaceResult | null

  /** MAINT-02 — AI-generated weekly debrief for post-race maintenance weeks.
   *  PAID (gated by `maintenance_coaching`). One flat, factual sentence per §75
   *  voice register. Distinct from `theme` (rule-engine, no AIMark) so the render
   *  layer can mark only this AI copy. Absent when the enricher is skipped or fails
   *  (silent — ADR-006). Only ever populated on maintenance_restoration/base weeks. */
  coach_debrief?: string

  /** MAINT-07 — §75 Phase 3 marker: the final `PHASE3_LAST_WEEKS` weeks of the
   *  maintenance block, where the app re-opens the forward conversation (the
   *  CA-03 goal ladder surfaces here and nowhere earlier — §67).
   *
   *  Deliberately NOT a third `phase` value: Phase 3 weeks ARE `maintenance_base`
   *  weeks in every training respect (same volume, same quality cap, same
   *  invariants) — only the surfacing differs. A separate phase string would have
   *  forced ~14 call sites that switch on `maintenance_restoration|maintenance_base`
   *  to learn a third case, for no training-load reason.
   *
   *  Absent on maintenance plans generated before MAINT-07 — read it through
   *  `isReengagementWeek()`, which falls back to deriving the window from the
   *  block's shape (no migration, no regeneration). */
  reengagement?: boolean
}

/** AI-DEPTH-07 — race-day result envelope.
 *
 *  Captures both telemetry (splits, HR drift) and diagnostics (what worked,
 *  what broke, fueling outcome). Telemetry fields can be auto-populated from
 *  Strava / HealthKit on the race-week activity; diagnostic fields are
 *  runner-written reflection. All fields optional — partial captures are valid.
 *
 *  Lives on `Week.result_embedded` for the race week. Distinct from
 *  `meta.benchmark` (which is a forward-looking VDOT input, not a backward-
 *  looking outcome).
 */
export interface RaceResult {
  /** Finish time, formatted "h:mm:ss" or "mm:ss" (e.g. "4:32:17", "21:48"). */
  finish_time?: string
  /** Actual distance covered, km. May differ from the planned race_distance_km
   *  (course re-measure, partial-finish, DNF early). */
  distance_km?: number
  /** ISO date the race was run. May differ from plan.meta.race_date on rescheduled events. */
  date?: string
  /** Per-segment splits. Pace strings (e.g. "5:24 /km") + optional HR per split.
   *  Either per-km, per-mile, or per-named-segment depending on what the source provides. */
  splits?: Array<{ km: number; pace: string; hr?: number }>
  /** Average HR across the race, bpm. */
  avg_hr?: number
  /** Peak HR, bpm. */
  max_hr?: number
  /** Cardiac drift: % increase in HR between first and second half at comparable pace.
   *  Positive = drift up (typical); negative = strong even-effort. */
  hr_drift_pct?: number
  /** Runner-rated overall effort, 1–10. */
  rpe?: number
  /** High-level outcome bucket. Drives post-race reshape branching when AI-DEPTH-08 ships. */
  outcome?: 'on_target' | 'off_target' | 'dnf' | 'pb'
  /** §75 Layer 5 — what the athlete wants from the maintenance period that follows.
   *  Captured in the post-plan review; scales the base-anchored maintenance volume.
   *  Absent = 'tick_over' (the conservative default). Never inferred from a next race. */
  maintenance_intent?: 'rest' | 'tick_over' | 'stay_sharp'
  /** Free-form runner reflection — sole field for unstructured notes. */
  notes?: string
  /** Fueling outcome — what worked, what didn't, where it broke down.
   *  Used by AI-DEPTH-08 to propose `fueling_protocol` updates for future plans. */
  fueling_outcome?: string
  /** Pacing/strategy outcome — went out hard, even split, faded at km X, etc.
   *  Used by AI-DEPTH-08 to propose `run_walk_strategy` or pacing adjustments. */
  strategy_outcome?: string
  /** Free-form: what specifically went well. */
  what_worked?: string
  /** Free-form: what specifically broke. */
  what_broke?: string
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
  generator_input?: GeneratorInput        // PV2-A/§1 — full input, for byte-exact replay

  // R18 — confidence score produced at generation time (INV-PLAN-008: PAID only)
  confidence_score?: number               // 1–10
  confidence_risks?: string[]             // e.g. ["low base volume", "tight timeline"]

  // R23 — hybrid generation fields
  tier?: 'free' | 'trial' | 'paid'       // tier at which plan was generated
  compressed?: boolean                    // true if available weeks < ideal minimum for this distance
  coach_intro?: string                    // PAID only — enricher-generated intro paragraph (2–3 sentences + confidence)
  plan_intro?: string                     // FREE first-plan only — CA-01 one-line "why this plan" taste of Kit's voice (Haiku, ~1–2 sentences). Distinct from coach_intro; never co-exists with it.

  // GEN-FIX-02 — enrichment provenance. 'failed' means the user holds rule-engine
  // output (silent fallback, ADR-006); 'pending' on a SAVED plan means the client
  // persisted before final_plan arrived (N8 save race). Absent = pre-GEN-FIX-02.
  enrichment?: 'applied' | 'failed' | 'skipped' | 'pending'

  // R24 — VDOT / zone model fields
  age?: number                            // athlete age at time of generation
  vdot?: number                           // Jack Daniels VDOT score (raw, benchmark-derived) — matches Daniels' published tables
  vdot_training_anchor?: number           // discounted VDOT used to derive training paces (CoachingPrinciples §10)
  goal_pace_per_km?: string               // e.g. "5:04 /km" — target race pace, not a training zone
  recalibration_weeks?: number[]          // week numbers where a benchmark re-test is scheduled
  recalibrations_applied?: number[]       // PV2-H — recalibration weeks whose TT result has been applied (so the prompt fires once)
  benchmark?: BenchmarkInput              // stored so recalibration can reference original

  // R23 rebuild — VDOT conservatism + returning runner + compressed flag
  vdot_discount_applied_pct?: number     // total VDOT discount (3% default + 5% if benchmark stale)

  // H-06 — peak vs base overload classification (CoachingPrinciples §23)
  volume_profile?: 'build' | 'maintenance'  // 'build' when peak ≥ 110% of W1; else 'maintenance'
  volume_constraint_note?: string         // human-readable explanation when 'maintenance'

  // M-05 — replace single `compressed` boolean with persona-aware classification.
  // (CoachingPrinciples §31)
  compression_classification?: 'optimal' | 'appropriate_for_persona' | 'constrained_by_inputs'

  // Difficulty band (CoachingPrinciples §44 amendment + §31) — ordinal demand
  // label on every generated plan. FREE (SLT 2026-08-18). Distinct from the PAID
  // numeric confidence score: this is a *pre-generation feasibility* read of the
  // runner's chosen timeline/constraints, derived only from prep-time margin +
  // compression_classification. Never a percentage (Coaching Board veto). The
  // refusal tier is the §44 block, which throws before a plan exists.
  // `difficulty_note` is present only for 'demanding' / 'very_demanding' — a
  // one-line honest statement of what makes the plan a real ask (mirrors
  // volume_constraint_note). 'comfortable' needs no explanation.
  difficulty_band?: 'comfortable' | 'demanding' | 'very_demanding'
  difficulty_note?: string

  /** SC-06 / CD-16 — the runner's stated target pace is faster than the interval
   *  pace their benchmark supports, so the sessions labelled VO2max are prescribed
   *  SLOWER than the sessions labelled race pace. The plan cannot be executed as
   *  written by both pace and heart rate. Set pre-generation from inputs (target
   *  vs benchmark), so it stays inside the §44 band's SLT boundary — a feasibility
   *  read of the runner's chosen goal, not a quality judgement on the plan.
   *  `INV-PLAN-INTENSITY-ORDERING` requires that a plan containing the inversion
   *  surfaces it: the board's ruling is "reconcile it or be honest about it". */
  goal_beyond_measured_fitness?: boolean
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
  // CoachingPrinciples §50. The last two added 2026-08-06 (GEN-FIX-05):
  //   observed_max                    — max came from device history, not a measured effort
  //   age_estimate_implausible_input  — supplied max rejected as implausible; Tanaka used
  // D2 (2026-08-06) — present only when the VDOT and volume signals disagreed.
  // `fitness_level` is then the conservative answer (drives volume and caps);
  // this is the higher one (drives the quality-session allowance only).
  // §80 (D3) — present when LONG_RUN_CAP_MINUTES stopped the peak long run
  // reaching the finish-goal duration floor. An honest statement of what the
  // plan cannot give, rather than a silent shortfall.
  // D4 (2026-08-06) — `compressed` conflated two unrelated facts and was true
  // for nearly every plan, including ones with weeks to spare. These are the
  // two things it meant; `compressed` is now a deprecated OR of them.
  time_compressed?: boolean      // fewer calendar weeks than the distance's minimum
  volume_constrained?: boolean   // the volume ramp never reached target peak

  long_run_shortfall_note?: string

  fitness_intensity_level?: 'beginner' | 'intermediate' | 'experienced'
  fitness_signal_note?: string

  hr_zone_method?: 'karvonen' | 'karvonen_estimated_max' | 'percent_of_max' | 'percent_of_estimated_max'
                 | 'observed_max' | 'age_estimate_implausible_input'
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

  // CoachingPrinciples §52 (low-day extension) — days-availability gate.
  // 'ok' on adequately-resourced plans, 'warned' on plans generated under
  // an acknowledged sub-recommended days/wk. Block-status inputs never
  // reach plan construction (DaysAvailableError surfaces at the entry point).
  // (`days_available` itself is already declared above as part of the
  // athlete profile; surfaced here only as warning/alternatives.)
  days_available_status?: 'ok' | 'warned'
  days_required_ok?: number
  days_available_warning?: string
  days_available_alternatives?: string[]

  // Audit trail of automatic post-pass corrections the engine made to honour
  // coaching rules (e.g. V1 simultaneous-stimulus split, V2 vo2max onset
  // shift, V5 stimulus regression escalation). One entry per rule fired —
  // human-readable, intended for debugging and post-hoc review.
  rule_adjustments?: RuleAdjustment[]

  // ENGINE-04 — taper recalibration (CoachingPrinciples §68).
  // Set when taper volumes are re-anchored to actual functional peak.
  taper_recalibrated_at?:     string   // ISO timestamp of recalibration
  functional_peak_km?:        number   // actual functional peak used as anchor
  planned_peak_km_at_recal?:  number   // original planned pre-taper volume (for coach card)

  // MAINT-06 — post-race maintenance is its OWN plan object, not weeks appended
  // to the race plan (§75). When the race completes, the race plan is archived as
  // completed and the active plan becomes a standalone maintenance plan carrying
  // this marker. `plan_kind` absent/'race' = a normal goal-race plan.
  plan_kind?:        'race' | 'maintenance'
  source_race_name?: string   // maintenance plan: the race it follows (for copy + next-goal)
  source_race_distance_km?: number  // maintenance plan: race distance (drives next-goal ladder)
  source_race_date?: string         // maintenance plan: ISO date the source race was run — drives "N weeks post-race" coaching recency (ADR-013). Carried from the race plan's race_date before it's cleared.
  source_race_outcome?: string      // maintenance plan: on_target | dnf | ...
  source_finish_time?: string       // maintenance plan: finish time (next-goal achievement line)
  maintenance_transition_seen?: boolean  // maintenance plan: one-time "after the race" announcement acknowledged
}

/** Audit entry for a post-pass rule that fired during plan generation. */
export interface RuleAdjustment {
  rule: string                   // e.g. 'V1-volume-quality-split'
  violation: string              // human-readable description of what was wrong
  resolution: string             // what was done about it
  weeks_affected: number[]       // 1-indexed week numbers
}

/** Pre-plan buffer guidance — present when prep_time_weeks_available significantly
 *  exceeds prep_time_weeks_required (CoachingPrinciples §44 extension).
 *  Informational only — not a session block. */
export interface PrePlanGuidance {
  buffer_weeks: number
  guidance: string
  /** Approximate ISO date range, e.g. "2026-01-05 → 2026-03-30". */
  week_estimate: string
}

export interface Plan {
  meta: PlanMeta
  /** Phase distribution — present on R23+ plans; absent on legacy gist plans. */
  phases?: Phase[]
  weeks: Week[]
  /** Optional pre-plan buffer guidance — emitted when buffer > threshold. */
  pre_plan?: PrePlanGuidance
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
