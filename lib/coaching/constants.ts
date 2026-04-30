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
