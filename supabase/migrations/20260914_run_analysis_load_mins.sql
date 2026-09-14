-- §66 Amendment 1 (Coaching Board 2026-09-14) — LR-SHORTFALL-DURATION-01.
--
-- run_analysis stored planned_load_km / actual_load_km and nothing else, so
-- every planned-vs-actual comparison in the product was a DISTANCE comparison.
-- A Zonna session is anchored EITHER by distance OR by duration (SESSION-KM-01),
-- and beginners get duration-anchored plans -- 95.8% of their sessions carry
-- `duration_mins` with `distance_km` null.
--
-- Consequences measured 2026-09-14:
--   * planned_load_km was written as `session.distance_km ?? null`, so it was
--     NULL on every duration-anchored analysis. The post-run card renders
--     "No distance data." whenever planned is null -- forever, for that runner.
--   * §66's long_run_shortfall trigger filters `plannedKm > 0`, so it is dead on
--     24.6% of generated plans (153 of 621 on the cohort grid).
--
-- §80 holds that a duration-anchored session's prescription IS its time on feet,
-- and explicitly expects walk breaks ("time on feet accumulates whether or not
-- every step is running"). So the comparison must switch axis rather than derive
-- kilometres from a pace band -- deriving km would tell a walk-breaking
-- first-timer they came up short against a number they were never given, which
-- is the exact failure §80 names.
--
-- These two columns are the time-axis siblings of the km pair. Both are written
-- on every analysis; the consumer picks the axis the SESSION is anchored on.
-- NOT backfilled: existing rows stay null (live-plan policy -- engine fixes are
-- not retro-applied), and every consumer must tolerate null on both axes.

ALTER TABLE run_analysis ADD COLUMN IF NOT EXISTS planned_load_mins NUMERIC(6,2);
ALTER TABLE run_analysis ADD COLUMN IF NOT EXISTS actual_load_mins  NUMERIC(6,2);

COMMENT ON COLUMN run_analysis.planned_load_mins IS
  'Prescribed duration in minutes (session.duration_mins). Sibling of planned_load_km; the consumer picks the axis the session is anchored on. §66 Amendment 1.';
COMMENT ON COLUMN run_analysis.actual_load_mins IS
  'Completed moving time in minutes (strava_activities.moving_time_s / 60). Moving time is correct here because walking registers as movement -- §80 expects walk breaks and they must not read as a shortfall.';
