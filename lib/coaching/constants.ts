export const COACHING_RULE_ENGINE_VERSION = '1.0.0'

// Session scoring weights (must sum to 1.0)
export const SCORE_WEIGHTS = {
  hr_discipline: 0.50,
  distance:      0.25,
  pace:          0.15,
  ef:            0.10,
} as const

// Verdict thresholds (total score 0–100)
export const VERDICT_BANDS = {
  nailed:     80,
  close:      60,
  off_target: 40,
  // < 40 = concerning
} as const

// Zone discipline (weekly aggregate)
export const ZONE_DISCIPLINE_BANDS = {
  disciplined: 85,
  decent:      70,
  loose:       50,
  // < 50 = freelancing
} as const

// Acute:chronic load ratio thresholds
export const LOAD_RATIO = {
  watch: 1.3,
  flag:  1.4,  // flag if >1.4 for 2 consecutive weeks
} as const

// Shadow load — actual vs planned
export const SHADOW_LOAD_THRESHOLD_PCT = 15  // >15% over plan triggers reflection

// EF trend — aerobic efficiency decline
export const EF_DECLINE_THRESHOLD_PCT = -8  // >8% drop vs 4-week rolling avg

// Easy session weight in zone discipline calculation
export const EASY_SESSION_WEIGHT = 2

// Max activities to include in EF baseline
export const EF_BASELINE_WINDOW = 6

// HR stream zone margin (bpm tolerance around zone boundaries)
export const HR_ZONE_TOLERANCE_BPM = 3

// Max adjustments per week
export const MAX_ADJUSTMENTS_PER_WEEK = 2

// Fatigue-accumulation trigger (Trigger 4 — CoachingPrinciples §R20-T4)
export const FATIGUE_HIGH_TAGS = ['Heavy', 'Wrecked', 'Cooked'] as const
export const FATIGUE_ACCUMULATION_THRESHOLD = 3   // consecutive sessions before softening fires
export const FATIGUE_SOFTENING_LONG_RUN_PCT = 0.80 // long run reduced to 80% (20% cut)

// Quality session minimum gap (hours) — re-exported from generationConfig so
// reshape rules and plan generation read the same source (CoachingPrinciples §7,
// ADR-009). Single-line wrapper kept for back-compat with existing consumers.
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
export const MIN_QUALITY_GAP_HOURS = GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY

// Taper protection — no adjustments in final N weeks
export const TAPER_PROTECTION_WEEKS = 3

// Max volume increase per adjustment — re-exported from generationConfig (§2).
export const MAX_VOLUME_INCREASE_PCT = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT

// Pre-session readiness signal — re-export from generationConfig (CoachingPrinciples §59).
// Single source of truth: the trigger thresholds live in GENERATION_CONFIG.READINESS.
export const READINESS = GENERATION_CONFIG.READINESS

// Multi-month trend (AI-DEPTH-03) — same-effort runs over time
// Powers Tier A reframe specificity: "Z2 HR has dropped 12 bpm since Feb."
// Buckets are monthly; thresholds gate noise.
export const TREND_SERIES = {
  /** Default lookback window in months. */
  DEFAULT_WINDOW_MONTHS: 6,
  /** Minimum buckets (months) before a trend is reported. */
  MIN_BUCKETS: 2,
  /** Minimum runs per bucket before the bucket counts. */
  MIN_RUNS_PER_BUCKET: 2,
  /** Minimum total matching runs across the window. */
  MIN_TOTAL_RUNS: 6,
  /** Minimum HR delta in bpm between first/last bucket to call it a trend. */
  MIN_HR_DELTA_BPM: 4,
  /** Minimum pace delta in seconds/km between first/last bucket. */
  MIN_PACE_DELTA_SEC: 5,
} as const

// Reframe risk-gate thresholds (POST-RUN-REFRAME-01 / Step 4)
// When these fire, the reframe is silenced — the coaching warning surfaces instead.
// Doctrine: reframe-positive against a risk signal is harm.
// brand.md § Reframe Voice → "Risk flags trump reframe."
export const REFRAME_RISK = {
  /** HR drift bpm threshold for "severe" — silences the reframe. Above the
   *  "mention in reframe" threshold (10 bpm) used in normal feedback. */
  SEVERE_HR_DRIFT_BPM: 15,
  /** HR drift % threshold for "severe" (0–1 scale, not percent). */
  SEVERE_HR_DRIFT_PCT: 0.10,
  /** Consecutive Heavy/Wrecked sessions before fatigue silences the reframe.
   *  Matches FATIGUE_ACCUMULATION_THRESHOLD intentionally — same rule. */
  FATIGUE_ACCUMULATION_SESSIONS: 3,
  /** Recent 'flag' coaching_flag count (window: last 5 completions) before
   *  repeated-overload silences the reframe. Two flags in 5 is the bar. */
  REPEATED_OVERLOAD_FLAG_COUNT: 2,
  REPEATED_OVERLOAD_WINDOW: 5,
} as const

// Reframe data-source ladder (POST-RUN-REFRAME-01)
// The reframe must work for any user — Tier A is rich-data, Tier C is minimum-data.
// Thresholds calibrate what counts as "enough evidence" for each tier.
// See docs/canonical/brand.md § Reframe Voice for the architectural rationale.
export const REFRAME_TIER = {
  /** Minimum analysed runs in last 12 weeks to qualify for Tier A (cohort + trend evidence). */
  TIER_A_MIN_ACTIVITIES: 12,
  /** Lookback window for the Tier A activity count. */
  TIER_A_WINDOW_DAYS: 84,
  /** Minimum session_completions in last 4 weeks to qualify for Tier B (RPE pattern evidence). */
  TIER_B_MIN_COMPLETIONS: 6,
  /** Lookback window for the Tier B completion count. */
  TIER_B_WINDOW_DAYS: 28,
  /** Max characters accepted for a user reflection note before trimming. */
  USER_NOTE_MAX_CHARS: 2000,
} as const

// Cohort similarity matching — past-self comparison (R25 cut #1)
// CoachingPrinciples §58. Two-axis match for cut #1: distance band + HR band.
// Three-axis (adding session.type) deferred to cuts #2/#3 which need richer cohort filtering.
export const COHORT_SIMILARITY = {
  /** Distance match window — runs within ±N% of target distance count as similar. */
  DISTANCE_TOLERANCE_PCT: 15,
  /** Minimum past similar runs before comparison fires. Below this, sample is noise. */
  MIN_COHORT_SIZE: 3,
  /** Default lookback window. Captures seasonal patterns. */
  WINDOW_DAYS_DEFAULT: 365,
  /** Shrunk window for dense users — recent history is more representative. */
  WINDOW_DAYS_DENSE: 180,
  /** Cohort size in last 6 months that triggers dense-window switch. */
  DENSE_THRESHOLD: 30,
  /** HR band breakpoints — three-bucket effort classification (low / mid / high). */
  HR_BAND_BREAKPOINTS: { low: 145, mid: 165 },
} as const
