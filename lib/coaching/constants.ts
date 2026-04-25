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

// Quality session minimum gap (hours) — re-exported from generationConfig so
// reshape rules and plan generation read the same source (CoachingPrinciples §7,
// ADR-009). Single-line wrapper kept for back-compat with existing consumers.
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
export const MIN_QUALITY_GAP_HOURS = GENERATION_CONFIG.MIN_HOURS_BETWEEN_QUALITY

// Taper protection — no adjustments in final N weeks
export const TAPER_PROTECTION_WEEKS = 3

// Max volume increase per adjustment — re-exported from generationConfig (§2).
export const MAX_VOLUME_INCREASE_PCT = GENERATION_CONFIG.MAX_WEEKLY_VOLUME_INCREASE_PCT
