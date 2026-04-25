// FREE — infrastructure
// Universal run format. Every run prescribed by the engine has a structured
// warm-up / main set / cool-down. Quality sessions add strides. HM and Marathon
// peak-phase long runs add a race-pace segment.
//
// See docs/canonical/CoachingPrinciples.md §16 for the principle, and
// docs/canonical/coaching-rules.md §10 for the operational rules.

export const SESSION_FORMAT = {

  // ── Universal split ─────────────────────────────────────────────────────────
  // 10% warm-up, 80% main set, 10% cool-down — with minimums.
  UNIVERSAL: {
    warmup_pct:               10,
    main_pct:                 80,
    cooldown_pct:             10,
    warmup_min_duration_mins: 10,
    quality_warmup_min_mins:  15,
  },

  // ── Warm-up zone progression ────────────────────────────────────────────────
  // First third in Z1, middle third Z1→Z2, final third in Z2.
  // Quality sessions get 4×20s strides at the end of the warm-up.
  WARMUP: {
    first_third:                  'Z1',
    middle_third:                 'Z1_to_Z2',
    final_third:                  'Z2',
    strides_required_for_quality: true,
    strides_count:                4,
    strides_duration_seconds:     20,
  },

  // ── Cool-down ───────────────────────────────────────────────────────────────
  COOLDOWN: {
    intensity:                  'Z1',
    min_duration_mins:           5,
    include_walk_for_long_runs:  true,
  },

  // ── Long-run race-pace overlay (peak phase) ─────────────────────────────────
  // 15-minute warm-up, then 20% of session time at race pace, only for HM and
  // MARATHON. Bridge between aerobic long runs and the catalogue's mp_long_run /
  // hm_pace_intervals sessions.
  LONG_RUN_PEAK: {
    warmup_mins:           15,
    race_pace_segment_pct: 20,
    race_pace_distances:   ['HM', 'MARATHON'],
  },
} as const
