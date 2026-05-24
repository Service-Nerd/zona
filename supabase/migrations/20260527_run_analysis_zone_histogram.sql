-- ZoneRings (Pattern 22) — per-zone weekly aggregates need the zone histogram
-- on the same table the Coach screen already reads. Today run_analysis has
-- only the prescribed-zone figures (hr_in_zone_pct + above/below); the full
-- four-bucket histogram (Z1/Z2/Z3/Z4-5) lives on strava_activities. The
-- Coach aggregation walks run_analysis week-by-session_day; joining against
-- strava_activities at query time would double the round-trips. Copy the
-- columns onto run_analysis instead so the existing aggregation can read them
-- in the same select that already pulls actual_load_km for load-weighting.
--
-- analyse-run is updated in the same change to persist these on every new
-- analysis, so the table starts populating from this migration forward.
--
-- Backfill: UPDATE … FROM strava_activities lines up rows by strava_activity_id
-- OR apple_health_uuid (the two source paths). Existing analyses gain the
-- histogram immediately; the Coach ZoneRings work for users on day zero of
-- the feature, not "after your next run."

ALTER TABLE run_analysis ADD COLUMN IF NOT EXISTS hr_pct_z1   NUMERIC(5,2);
ALTER TABLE run_analysis ADD COLUMN IF NOT EXISTS hr_pct_z2   NUMERIC(5,2);
ALTER TABLE run_analysis ADD COLUMN IF NOT EXISTS hr_pct_z3   NUMERIC(5,2);
ALTER TABLE run_analysis ADD COLUMN IF NOT EXISTS hr_pct_z4_5 NUMERIC(5,2);

-- Backfill from strava_activities — Strava-sourced runs.
UPDATE run_analysis AS ra
SET
  hr_pct_z1   = sa.hr_pct_z1,
  hr_pct_z2   = sa.hr_pct_z2,
  hr_pct_z3   = sa.hr_pct_z3,
  hr_pct_z4_5 = sa.hr_pct_z4_5
FROM strava_activities AS sa
WHERE ra.strava_activity_id = sa.strava_activity_id
  AND ra.user_id = sa.user_id
  AND ra.hr_pct_z1 IS NULL
  AND sa.hr_pct_z1 IS NOT NULL;

-- Backfill from strava_activities — HealthKit-sourced runs (uuid path).
UPDATE run_analysis AS ra
SET
  hr_pct_z1   = sa.hr_pct_z1,
  hr_pct_z2   = sa.hr_pct_z2,
  hr_pct_z3   = sa.hr_pct_z3,
  hr_pct_z4_5 = sa.hr_pct_z4_5
FROM strava_activities AS sa
WHERE ra.apple_health_uuid = sa.apple_health_uuid
  AND ra.user_id = sa.user_id
  AND ra.hr_pct_z1 IS NULL
  AND sa.hr_pct_z1 IS NOT NULL;

COMMENT ON COLUMN run_analysis.hr_pct_z1   IS 'Time in Z1 (recovery) as % of session. Mirrors strava_activities.hr_pct_z1 — copied at analyse-run write time. Used by Coach ZoneRings.';
COMMENT ON COLUMN run_analysis.hr_pct_z2   IS 'Time in Z2 (aerobic) as % of session.';
COMMENT ON COLUMN run_analysis.hr_pct_z3   IS 'Time in Z3 (tempo) as % of session.';
COMMENT ON COLUMN run_analysis.hr_pct_z4_5 IS 'Time in Z4-5 (threshold/VO2) as % of session.';
