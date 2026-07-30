-- Migration: manual run entry source (DS-06)
--
-- Lets users with no device (no Strava, no HealthKit — web/Android, or an
-- iPhone-only runner) log a run's distance/duration/avg-HR by hand and have it
-- stored as a real row in the source-agnostic activity log (`strava_activities`).
--
-- `strava_activities` already carries source ∈ {strava, apple_health} with a
-- per-source natural key (strava_activity_id / apple_health_uuid) and two CHECKs:
--   * strava_activities_source_check     — value domain of `source`
--   * strava_activities_source_id_check  — the right ID is present for the source
--
-- A manual row has neither external ID, so this adds a client-generated
-- `manual_uuid` that plays the same dedupe role apple_health_uuid plays for HK
-- rows (Postgres NULLS-DISTINCT lets the three per-source unique constraints
-- coexist without collision). Both CHECKs are widened to admit 'manual'.
--
-- Doctrine: ADR-011 already documents `source` as {apple_health|strava|manual};
-- this migration realises the 'manual' arm. INV-DATA-008 — the only insert path
-- remains /api/health/ingest (manual branch); no new write surface is opened.

-- 1. Dedupe key for manual rows.
ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS manual_uuid TEXT;

-- 2. Widen the source value domain to include 'manual'.
--    (The original CHECK was created inline by `ADD COLUMN source ... CHECK (...)`
--     in 20260501, so it carries Postgres' generated name `<table>_<col>_check`.)
ALTER TABLE strava_activities
  DROP CONSTRAINT IF EXISTS strava_activities_source_check;
ALTER TABLE strava_activities
  ADD CONSTRAINT strava_activities_source_check
  CHECK (source IN ('strava', 'apple_health', 'manual'));

-- 3. Widen the source/id integrity CHECK so a manual row keys on manual_uuid.
ALTER TABLE strava_activities
  DROP CONSTRAINT IF EXISTS strava_activities_source_id_check;
ALTER TABLE strava_activities
  ADD CONSTRAINT strava_activities_source_id_check CHECK (
    (source = 'strava'       AND strava_activity_id IS NOT NULL) OR
    (source = 'apple_health' AND apple_health_uuid  IS NOT NULL) OR
    (source = 'manual'       AND manual_uuid        IS NOT NULL)
  );

-- 4. One manual row per (user, manual_uuid). NULLS DISTINCT (Postgres default)
--    means non-manual rows (manual_uuid NULL) never collide here.
ALTER TABLE strava_activities
  ADD CONSTRAINT strava_activities_user_manual_uniq
  UNIQUE (user_id, manual_uuid);
