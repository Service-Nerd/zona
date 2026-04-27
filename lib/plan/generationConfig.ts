// FREE — infrastructure
// Single source of truth for every coaching numeric used by the plan generator
// and its downstream consumers. See docs/canonical/CoachingPrinciples.md for
// the principle behind each value, and docs/architecture/ADR-009-config-driven-generation.md
// for why this file exists.
//
// Authoring rule: every value in this file has a corresponding section in
// CoachingPrinciples.md. Adding a value without a principle is a defect.
// Changing a value without updating CoachingPrinciples.md is a defect.

export const GENERATION_CONFIG = {

  // ── Polarised training (CoachingPrinciples §1) ──────────────────────────────
  // Non-elites need protection from grey zone. Measured in MINUTES, not km, so
  // time-based plans honour the same ratios.
  INTENSITY_DISTRIBUTION: {
    '5K':       { easy_pct: 75, quality_pct: 25 },
    '10K':      { easy_pct: 75, quality_pct: 25 },
    'HM':       { easy_pct: 80, quality_pct: 20 },
    'MARATHON': { easy_pct: 82, quality_pct: 18 },
    '50K':      { easy_pct: 85, quality_pct: 15 },
    '100K':     { easy_pct: 88, quality_pct: 12 },
  },

  // ── 10% rule + recovery cadence (CoachingPrinciples §2, §3) ─────────────────
  MAX_WEEKLY_VOLUME_INCREASE_PCT: 10,
  RETURNING_RUNNER_ALLOWANCE_PCT: 15,
  RETURNING_RUNNER_GRACE_WEEKS:    3,
  RECOVERY_WEEK_FREQUENCY_STANDARD: 4,
  RECOVERY_WEEK_FREQUENCY_MASTERS:  3,
  MASTERS_AGE_THRESHOLD: 45,
  RECOVERY_WEEK_VOLUME_PCT: 70,

  // ── Phase structure (CoachingPrinciples §4, §5) ─────────────────────────────
  // Specificity rises as the race approaches.
  SPECIFICITY_BY_PHASE: {
    base:  { general_pct: 100, specific_pct: 0 },
    build: { general_pct: 70,  specific_pct: 30 },
    peak:  { general_pct: 40,  specific_pct: 60 },
    taper: { general_pct: 30,  specific_pct: 70 },
  },

  // Phase distribution as % of total plan weeks. Taper is the remainder, set by
  // TAPER_BY_DISTANCE.days converted to weeks.
  PHASE_DISTRIBUTION: {
    base_pct:  35,
    build_pct: 35,
    peak_pct:  15,
  },

  // ── Taper (CoachingPrinciples §6) ───────────────────────────────────────────
  // Maintain intensity, cut volume, never detrain.
  TAPER_BY_DISTANCE: {
    '5K':       { days: 10, volume_reduction_pct: 35, keep_quality: true },
    '10K':      { days: 10, volume_reduction_pct: 35, keep_quality: true },
    'HM':       { days: 14, volume_reduction_pct: 45, keep_quality: true },
    'MARATHON': { days: 21, volume_reduction_pct: 55, keep_quality: true },
    '50K':      { days: 21, volume_reduction_pct: 55, keep_quality: true },
    '100K':     { days: 28, volume_reduction_pct: 60, keep_quality: true },
  },

  // Race week volume — applied to the LAST week of every plan. Shakeouts only;
  // independent of TAPER_BY_DISTANCE.volume_reduction_pct (which governs the
  // full taper weeks BEFORE race week).
  RACE_WEEK_VOLUME_PCT: 18,

  // Strength sessions — flagged off until R21 ships full content.
  // When false: engine skips strength placement entirely (frees up day slots
  // for easy fillers, preventing "1 run/week" plans for low-volume runners).
  // When true: engine schedules 1–2 strength sessions per week per phase (legacy
  // behaviour). See backlog § R21 — Strength Sessions.
  STRENGTH_ENABLED: false,

  // ── Quality session sizing ───────────────────────────────────────────────────
  // Quality session distance as % of weekly volume (single source — was hardcoded
  // 0.18 in multiple places before). When two quality sessions in a peak week,
  // the second is scaled down by SECONDARY_QUALITY_PCT_OF_PRIMARY.
  QUALITY_SESSION_PCT_OF_WEEKLY:    18,
  SECONDARY_QUALITY_PCT_OF_PRIMARY: 80,

  // ── Volume sequence initialisation ──────────────────────────────────────────
  // buildVolumeSequence clamps the starting volume to a band relative to peakKm:
  //   floor = peakKm × FLOOR_PCT/100  (prevents starting too low for the target)
  //   ceiling = peakKm × CEILING_PCT/100  (prevents starting too close to peak)
  BUILD_VOL_INIT_FLOOR_VS_PEAK:   35,
  BUILD_VOL_INIT_CEILING_VS_PEAK: 85,

  // ── Distance display + minimum session distances ────────────────────────────
  // All session distances round to this precision before display.
  // 0.5 km = whole-number-ish (12.0, 14.5, 9.0) — clean, not nitpicky.
  DISTANCE_ROUNDING_PRECISION_KM: 0.5,

  // Floor distances per session type. Below these, the session is too short to
  // be coaching-meaningful. Engine clamps up.
  MIN_SESSION_DISTANCE_KM: {
    long:               5,
    easy:               4,
    quality:            5,
    secondary_quality:  4,
  },

  // ── Returning runner detection threshold ────────────────────────────────────
  // A user is detected as a "returning runner" when their training_age > 2 years
  // AND their current_weekly_km is below this fraction of peakKm. Below this
  // threshold the body has obvious headroom for the 15% allowance window.
  RETURNING_RUNNER_VOLUME_THRESHOLD_PCT: 50,  // % of peakKm

  // ── Compressed-plan detection threshold ─────────────────────────────────────
  // After buildVolumeSequence applies the 10% post-process cap, a plan is
  // considered "compressed" if peak-phase weeks never reach this fraction of
  // peakKm. Surfaced via plan.meta.compressed.
  PEAK_REACHED_THRESHOLD_PCT: 95,  // % of peakKm

  // ── Peak overload requirement (CoachingPrinciples §23) ─────────────────────
  // A plan that does not exceed PEAK_OVER_BASE_RATIO is downgraded to a
  // "maintenance" plan rather than presented as a "build". The constitution:
  // a build that does not produce overload is mislabelled.
  PEAK_OVER_BASE_RATIO: 1.10,            // peak weekly_km / W1 weekly_km
  PEAK_OVERLOAD_MIN_PLAN_WEEKS: 8,       // below this length, ratio not enforced

  // ── Prep-time validation (CoachingPrinciples §44) ──────────────────────────
  // Minimum weeks of preparation per race distance / goal type. Two-step UX:
  //   block → refuse generation, list alternatives.
  //   warn  → refuse unless input.acknowledged_prep_warning === true.
  //   ok    → proceed.
  // For goal: 'finish', the warn zone is treated as ok (only block applies).
  // Returning runners shift all thresholds up by PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS.
  PREP_TIME_THRESHOLDS: {
    '5K':       { block: 4,  warn: 8 },
    '10K':      { block: 6,  warn: 10 },
    'HM':       { block: 8,  warn: 12 },
    'MARATHON': { block: 10, warn: 16 },
    '50K':      { block: 14, warn: 20 },
    '100K':     { block: 14, warn: 20 },
  },
  PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS: 2,

  // ── Long-run progression cap (CoachingPrinciples §45) ──────────────────────
  // Universal — no phase exemption. Long-run distance increase week-on-week
  // capped at the GREATER of LONG_RUN_PROGRESSION_CAP_PCT (% of prior LR) or
  // LONG_RUN_PROGRESSION_CAP_ABS_KM (absolute). Step-back from a deload to the
  // pre-deload distance is permitted within LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT.
  LONG_RUN_PROGRESSION_CAP_PCT:           20,
  LONG_RUN_PROGRESSION_CAP_ABS_KM:         5,
  LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT: 5,

  // ── Peak weekly volume floor for long races (CoachingPrinciples §46) ───────
  // Time-targeted plans for marathon and ultra need an absolute weekly-volume
  // floor in peak phase, not just a peak-vs-base ratio. HM and shorter rely on
  // PEAK_OVER_BASE_RATIO alone. When the floor is unreachable, plan downgrades
  // to maintenance via the §23 / §38 mechanism.
  MARATHON_PEAK_VOLUME_FLOOR_RATIO: 1.25,  // ×race_distance — covers 40–43km races
  ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO: 1.00, // ×race_distance — 43–55km
  ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO: 0.80,// ×race_distance — >55km
  ULTRA_PEAK_VOLUME_FLOOR_CAP_KM:    130,  // absolute cap for >55km

  // ── Peak long-run alternation (CoachingPrinciples §47) ─────────────────────
  // No two consecutive peak weeks may both carry a peak-level long run.
  PEAK_LR_ALTERNATION_THRESHOLD_PCT: 90,   // % of peak LR distance defining "peak-level"
  PEAK_LR_STEPBACK_MAX_PCT:          80,   // % of peak LR distance defining a "step-back" LR

  // ── Strides on midweek easy (CoachingPrinciples §28) ───────────────────────
  // From this week onwards, the engine appends a stride coach-note to one
  // midweek easy run per week. Skipped in race week and deload weeks.
  STRIDES_FIRST_WEEK: 3,

  // ── Tune-up race callout (CoachingPrinciples §32) ──────────────────────────
  // Plans of this length or longer get a mid-build tune-up race suggestion.
  // Placed on the latest non-deload build week before peak. Optional — the
  // coach note appears as plan.weeks[i].tune_up_callout, not a separate
  // session. Users can ignore it without breaking the plan.
  TUNE_UP_MIN_PLAN_WEEKS: 10,

  // ── Race-week shakeout (CoachingPrinciples §30, §39) ──────────────────────
  // Race week has no quality session — shakeouts only. Hard cap on duration
  // and a stride note on the first shakeout preserve neuromuscular sharpness
  // without adding race-day fatigue. For HM/marathon, an additional easy
  // mid-week run prevents the taper from going too deep.
  RACE_WEEK_SHAKEOUT_MAX_MINS: 35,
  RACE_WEEK_EASY_KM: {
    HM:       7,    // 6–8 km easy on a non-shakeout day
    MARATHON: 9,    // 8–10 km
  },

  // ── Fresh-from-layoff detection (CoachingPrinciples §29) ───────────────────
  // If weeks_at_current_volume is set and below this threshold, the runner is
  // returning from a layoff and not actually consolidated at their stated
  // current_weekly_km. The engine treats current_weekly_km as aspirational and
  // starts the plan at FRESH_RETURN_START_FRACTION × current_weekly_km.
  FRESH_RETURN_WEEKS_THRESHOLD: 8,
  FRESH_RETURN_START_FRACTION:  0.7,

  // Heuristic detection (R2/M-03) — when the runner has experienced training
  // age but very low current volume / longest run, infer fresh-from-layoff
  // even without the explicit weeks_at_current_volume input. Both thresholds
  // must be hit; otherwise no inference is made.
  HEURISTIC_FRESH_RETURN_WEEKLY_KM:  25,
  HEURISTIC_FRESH_RETURN_LONG_RUN_KM: 10,

  // ── Injury weekly volume cap (knee, shin splints) ──────────────────────────
  // CoachingPrinciples §12 — for these two injury types, weekly volume cap
  // tightens from MAX_WEEKLY_VOLUME_INCREASE_PCT (10%) to this stricter limit.
  INJURY_WEEKLY_INCREASE_CAP_PCT: 5,  // % above previous week's volume

  // ── Injury-aware session selection (CoachingPrinciples §21) ────────────────
  // Injury keywords that trigger exclusion of hill sessions during base/build
  // phases. Substrings; matched case-insensitively against injury_history.
  // Peak phase may reintroduce hills only if the runner has completed build
  // symptom-free (gated by explicit user check-in — not yet implemented).
  HILL_RESTRICTING_INJURIES: ['knee', 'itb', 'achilles', 'shin', 'calf', 'plantar'] as readonly string[],

  // Quality sessions per taper week. Last entry is always race week (= 0).
  // Length = total taper-phase weeks INCLUDING race week. Capped per
  // CoachingPrinciples §49 (taper duration). Length must be ≤ MAX_TAPER_PHASE_WEEKS.
  TAPER_QUALITY_PER_WEEK: {
    '5K':       [1, 0],
    '10K':      [1, 0],
    'HM':       [1, 1, 0],
    'MARATHON': [1, 1, 1, 0],
    '50K':      [1, 1, 1, 0],
    '100K':     [1, 1, 1, 0],
  },

  // ── Taper duration cap (CoachingPrinciples §49) ────────────────────────────
  // Maximum total taper-phase weeks INCLUDING race week. Engine cannot allocate
  // more weeks to taper than these caps; excess weeks flow to base / build.
  // Round-2 Case 04 review found a 4-week marathon taper detrains and compresses
  // the build. The cap below holds marathon at 3 actual taper weeks (4 entries),
  // ultra at 3 (was 4 for 100K).
  MAX_TAPER_PHASE_WEEKS: {
    '5K':       2,   // 1 taper + race
    '10K':      2,
    'HM':       3,   // 2 taper + race
    'MARATHON': 4,   // 3 taper + race
    '50K':      4,
    '100K':     4,
  },

  // ── Hard / easy spacing (CoachingPrinciples §7) ─────────────────────────────
  MIN_HOURS_BETWEEN_QUALITY: 48,

  // OVERRIDE — rebuild spec proposed 24h. Set to 48h on coaching grounds:
  // for the target audience, a long run on heavy legs from a quality session
  // the day before is the most reliable injury vector. See CoachingPrinciples §7.
  MIN_HOURS_BETWEEN_QUALITY_AND_LONG: 48,

  // ── Quality session frequency (CoachingPrinciples §8) ───────────────────────
  // OVERRIDE — rebuild spec proposed 3 for experienced. Set to 2 on the basis
  // that the third quality session is rarely accommodated by life and consistently
  // produces the symptoms Zona exists to prevent. See CoachingPrinciples §8.
  QUALITY_SESSIONS_PER_WEEK_MAX: {
    beginner:     0,
    intermediate: 2,
    experienced:  2,
  },

  // ── Long-run rules (CoachingPrinciples §9) ──────────────────────────────────
  // Phase-aware fraction of weekly volume.
  LONG_RUN_PCT_OF_WEEKLY_VOLUME: {
    base:  28,
    build: 30,
    peak:  32,
    taper: 40,
  },

  // Long run must be at least this multiple of the easy session distance.
  // Enforces the principle that the long run is always the longest run of the
  // week. When the natural phase-fraction-based distribution would invert this
  // (low-volume / low-day-count plans), the engine redistributes volume to
  // honour this ratio while preserving total weekly km.
  LONG_RUN_MIN_RATIO_VS_EASY: 1.25,

  // Absolute time cap, by race distance.
  LONG_RUN_CAP_MINUTES: {
    '5K':       90,
    '10K':      120,
    'HM':       135,
    'MARATHON': 210,
    '50K':      300,
    '100K':     420,
  },

  // Tighter cap for finish-goal 5K plans (CoachingPrinciples §40, R2/L-01).
  // 5K finish-goal runners don't need 84-minute long runs; aerobic development
  // through frequency + total volume, not extended LRs.
  LONG_RUN_CAP_MINUTES_5K_FINISH: 70,

  // ── Peak long-run race specificity (CoachingPrinciples §24, §35) ──────────
  // Time-targeted plans for HM and longer require race-distance specificity in
  // the long run. Floor (not ceiling) — peak long run must REACH this fraction
  // of race distance, capped by LONG_RUN_CAP_MINUTES. Distances ≤10K do not
  // require race-distance specificity (their long run is for aerobic
  // development, not specificity).
  //
  // Three tiers (R2/M-01):
  //   floor   — default, conservative; engine guarantees this minimum.
  //   target  — runner's longest_recent_run_km is ≥ floor of race distance.
  //   stretch — runner has hard_session_relationship: 'love', no injury
  //             history, and longest_recent_run_km ≥ floor.
  // Floors are minimums, not targets — when persona supports more, push higher.
  PEAK_LR_RATIO_VS_RACE: {
    HM:       0.85,
    MARATHON: 0.75,
  },
  PEAK_LR_RATIO_TARGET: {
    HM:       0.90,
    MARATHON: 0.80,
  },
  PEAK_LR_RATIO_STRETCH: {
    HM:       0.95,
    MARATHON: 0.85,
  },

  // First two weeks of any plan: long run capped at longest_recent_run_km × this.
  WEEK_1_2_LONG_RUN_CAP_MULTIPLIER: 1.10,

  // ── VDOT conservatism (CoachingPrinciples §10) ──────────────────────────────
  // The signature Zona move: err on the side of restraint when in doubt.
  VDOT_CONSERVATIVE_DISCOUNT_PCT: 3,
  VDOT_STALE_BENCHMARK_ADDITIONAL_DISCOUNT_PCT: 5,
  VDOT_STALE_BENCHMARK_MONTHS: 6,

  // R2/L-03 — staleness compounding. Discount scales with benchmark age:
  // base discount ≤ FRESH_WEEKS, then +PER_4WK_PCT per additional 4-week
  // block, capped at MAX_PCT. Replaces the binary 6-month threshold; the
  // legacy fields above are retained for back-compat with applyRecalibration.
  VDOT_STALENESS_FRESH_WEEKS:        4,   // ≤ this many weeks: base discount only
  VDOT_STALENESS_PER_4WK_PCT:        1,   // +1% per additional 4-week block
  VDOT_STALENESS_MAX_DISCOUNT_PCT:   7,   // cap at 7% total

  // ── Pace and zone display rules (CoachingPrinciples §11, §12) ───────────────
  USE_PACE_RANGES_NOT_POINTS: true,
  EASY_RUN_ZONE_CAP: 'Z2_TOP', // resolves to top of ZONES.Z2 at runtime

  // ── Fitness classification (CoachingPrinciples §13) ─────────────────────────
  // VDOT-first; volume fallback for users without a benchmark.
  FITNESS_THRESHOLDS: {
    vdot_beginner_max:    35,
    vdot_intermediate_max: 50,
  },

  // ── Max HR formula (CoachingPrinciples §14, zone-rules.md) ──────────────────
  // Tanaka: 208 − 0.7 × age. Used as a fallback when user has not provided max_hr.
  MAX_HR_FORMULA: 'tanaka',

  // ── HR zones (CoachingPrinciples §14, zone-rules.md) ────────────────────────
  // Five named zones, two formulas. Karvonen when resting HR present, % MaxHR
  // otherwise. Auto-selection lives inside computeZones() in ruleEngine.ts.
  //
  // Forward compat: a future paid "zone method selector" feature swaps these
  // tables based on user_settings.zone_method (Karvonen / Daniels / Friel / etc).
  // No engine or consumer change required — they all read zone strings.
  ZONES: {
    Z1: { karvonen_pct: [50, 60],  maxhr_pct: [65, 70]  },
    Z2: { karvonen_pct: [60, 70],  maxhr_pct: [70, 80]  },
    Z3: { karvonen_pct: [70, 80],  maxhr_pct: [80, 87]  },
    Z4: { karvonen_pct: [80, 90],  maxhr_pct: [87, 93]  },
    Z5: { karvonen_pct: [90, 100], maxhr_pct: [93, 100] },
  },
} as const

// Type helpers — derived from the const object so tables and types stay in sync.
export type RaceDistanceKey = keyof typeof GENERATION_CONFIG.INTENSITY_DISTRIBUTION
export type PhaseKey        = keyof typeof GENERATION_CONFIG.SPECIFICITY_BY_PHASE
export type FitnessLevelKey = keyof typeof GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX
export type ZoneKey         = keyof typeof GENERATION_CONFIG.ZONES

// Mapping km → canonical race-distance key. Boundaries match the existing
// DISTANCE_CONFIGS in lib/plan/length.ts (5K ≤ 6km, 10K ≤ 12km, HM ≤ 22km,
// Marathon ≤ 43km, 50K ≤ 55km, 100K beyond).
export function raceDistanceKey(distanceKm: number): RaceDistanceKey {
  if (distanceKm <= 6)  return '5K'
  if (distanceKm <= 12) return '10K'
  if (distanceKm <= 22) return 'HM'
  if (distanceKm <= 43) return 'MARATHON'
  if (distanceKm <= 55) return '50K'
  return '100K'
}
