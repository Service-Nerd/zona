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

  // Quality sessions per taper week. Last entry is always race week (= 0).
  TAPER_QUALITY_PER_WEEK: {
    '5K':       [1, 0],
    '10K':      [1, 0],
    'HM':       [1, 1, 0],
    'MARATHON': [1, 1, 1, 0],
    '50K':      [1, 1, 1, 0],
    '100K':     [1, 1, 1, 1, 0],
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

  // Absolute time cap, by race distance.
  LONG_RUN_CAP_MINUTES: {
    '5K':       90,
    '10K':      120,
    'HM':       135,
    'MARATHON': 210,
    '50K':      300,
    '100K':     420,
  },

  // First two weeks of any plan: long run capped at longest_recent_run_km × this.
  WEEK_1_2_LONG_RUN_CAP_MULTIPLIER: 1.10,

  // ── VDOT conservatism (CoachingPrinciples §10) ──────────────────────────────
  // The signature Zona move: err on the side of restraint when in doubt.
  VDOT_CONSERVATIVE_DISCOUNT_PCT: 3,
  VDOT_STALE_BENCHMARK_ADDITIONAL_DISCOUNT_PCT: 5,
  VDOT_STALE_BENCHMARK_MONTHS: 6,

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
