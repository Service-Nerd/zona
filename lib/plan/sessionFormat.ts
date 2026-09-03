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

/**
 * The full warm-up / main / cool-down split of a QUALITY session, in minutes —
 * the single formula behind `mainSetMinutes` and (Phase 3, Coaching Board
 * 2026-09-03) `sessionComposer.ts`'s quality branch. Before this, the two
 * disagreed: `sessionComposer.ts` independently re-derived warm-up/cool-down
 * and added its own extra 5-minute cool-down floor this formula never had —
 * for a 25-minute session, `mainSetMinutes(25)` gave 7.5 min main while
 * `sessionComposer.ts` gave 5. Neither floor was named in a principle
 * (INV-CFG-002), so the drift was undocumented duplication, not two
 * deliberate designs — a defect (D-08/INV-CFG-001), not a coaching question.
 *
 * The warm-up floor (`quality_warmup_min_mins`) means the carve-out is NOT a
 * fixed fraction: on a short taper session the floor consumes most of the
 * session, which is how a 29-minute session came to hold 11 minutes of work.
 */
export function sessionSplit(durationMins: number): { warmup: number; main: number; cooldown: number } {
  const u = SESSION_FORMAT.UNIVERSAL
  const warmup = Math.max(u.quality_warmup_min_mins, durationMins * u.warmup_pct / 100)
  const cooldown = durationMins * u.cooldown_pct / 100
  return { warmup, cooldown, main: Math.max(0, durationMins - warmup - cooldown) }
}

/**
 * The MAIN SET of a quality session, in minutes — the coaching-meaningful
 * quantity, and the one nothing in the engine governed directly until SC-10.
 * A thin wrapper over `sessionSplit`; kept as its own export because most
 * callers (the invariant layer, the sizing inverse below) only need this one
 * number, not the full breakdown.
 *
 * Exported so the invariant layer and any analysis derive it from ONE place.
 * SC-10 needed this number in three (config reasoning, invariant, tracer), and
 * three copies of a formula is how they stop agreeing.
 */
export function mainSetMinutes(durationMins: number): number {
  return sessionSplit(durationMins).main
}

/**
 * The inverse of `mainSetMinutes` — the total session duration that yields a given
 * main set. SC-10 needs it to turn the VO2max main-set ceiling into a distance cap
 * at sizing time. Lives here so the carve-out and its inverse cannot drift.
 *
 * Two branches, matching `mainSetMinutes`. The warm-up FLOOR
 * (`quality_warmup_min_mins`) binds until the session is long enough that 10% of it
 * exceeds the floor (~150 min — every real session), so the floored branch is the
 * operative one:
 *   main = total − quality_warmup_min_mins − total·cooldown_pct/100
 */
export function durationForMainSet(mainSetMins: number): number {
  const u = SESSION_FORMAT.UNIVERSAL
  const flooredTotal = (mainSetMins + u.quality_warmup_min_mins) / (1 - u.cooldown_pct / 100)
  // If the percentage warm-up would exceed the floor, the floor doesn't bind and
  // the split is purely proportional.
  if (flooredTotal * u.warmup_pct / 100 > u.quality_warmup_min_mins) {
    return mainSetMins / (1 - (u.warmup_pct + u.cooldown_pct) / 100)
  }
  return flooredTotal
}
