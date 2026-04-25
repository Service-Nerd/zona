// FREE — infrastructure
// Per-distance plan shape. A 5K plan and a 100K plan share almost no structure
// beyond the four-phase shell — this file captures the differences without
// branching them through the engine's main flow.
//
// See docs/canonical/CoachingPrinciples.md §17 and
// docs/canonical/session-catalogue.md for selection rules.

export const PLAN_SIGNATURES = {

  '5K': {
    min_weeks: 8, ideal_weeks: 10, max_weeks: 12,
    sessions_per_week_default: 4,
    quality_categories_focus:  ['vo2max', 'threshold'],
    long_run_cap_minutes:      90,
    taper_final_session:       'intervals_short',
    free_tier_available:       true,
  },

  '10K': {
    min_weeks: 10, ideal_weeks: 12, max_weeks: 14,
    sessions_per_week_default: 4,
    quality_categories_focus:  ['vo2max', 'threshold'],
    long_run_cap_minutes:      120,
    taper_final_session:       'intervals_long',
    free_tier_available:       true,
  },

  'HM': {
    min_weeks: 12, ideal_weeks: 14, max_weeks: 16,
    sessions_per_week_default:  4,
    quality_categories_focus:   ['threshold', 'race_specific'],
    long_run_cap_minutes:       135,
    peak_includes_race_pace:    true,
    taper_final_session:        'hm_pace_intervals',
    free_tier_available:        true,
  },

  // OVERRIDE — rebuild spec set free_tier_available: true. Marathon stays PAID
  // per commercial decision (2026-04-25). Ultra distances also remain paid.
  'MARATHON': {
    min_weeks: 14, ideal_weeks: 16, max_weeks: 20,
    sessions_per_week_default:    5,
    quality_categories_focus:     ['threshold', 'race_specific'],
    long_run_cap_minutes:         210,
    peak_includes_mp_long_runs:   true,
    mp_long_run_frequency_weeks:  2,
    taper_final_session:          'mp_long_run',
    free_tier_available:          false,
  },

  '50K': {
    min_weeks: 16, ideal_weeks: 18, max_weeks: 22,
    sessions_per_week_default:   5,
    quality_categories_focus:    ['threshold', 'ultra_specific'],
    long_run_cap_minutes:        300,
    back_to_back_from_phase:     'build',
    back_to_back_frequency_weeks: 3,
    fuelling_practice_from_week:  8,
    taper_final_session:         'ultra_race_sim',
    free_tier_available:         false,
  },

  '100K': {
    min_weeks: 20, ideal_weeks: 22, max_weeks: 26,
    sessions_per_week_default:    5,
    quality_categories_focus:     ['ultra_specific'],
    long_run_cap_minutes:         420,
    back_to_back_from_phase:      'build',
    back_to_back_frequency_weeks: 2,
    time_on_feet_sessions_in_peak: 2,
    night_run_optional:           true,
    taper_final_session:          'time_on_feet',
    free_tier_available:          false,
  },
} as const

export type PlanSignatureKey = keyof typeof PLAN_SIGNATURES
