-- Migration: HealthKit primary data source
--
-- Apple Health becomes the primary v1 activity source. Strava remains
-- a working secondary source. Both write to `strava_activities` (kept
-- the table name — internal label, not a public surface).
--
-- Schema mutations on strava_activities:
--   1. Add `source` column ('strava' | 'apple_health'), default 'strava'.
--   2. Add `apple_health_uuid` column (HKWorkout UUID for HealthKit rows).
--   3. Make `strava_activity_id` nullable (HealthKit rows have no Strava ID).
--   4. Replace the (user_id, strava_activity_id) unique constraint with two
--      full UNIQUE constraints — one per source's natural key. Postgres'
--      default NULLS DISTINCT semantics let multiple NULLs coexist, so
--      Strava rows (with NULL apple_health_uuid) and HealthKit rows (with
--      NULL strava_activity_id) don't collide.
--   5. CHECK constraint enforces source/id integrity.
--
-- Why not partial unique indexes (the original backlog proposal):
-- Supabase JS `upsert({ onConflict: 'user_id,strava_activity_id' })`
-- emits bare `ON CONFLICT (cols)` — Postgres can't infer a partial index
-- from that (the WHERE clause is required). Full unique constraints with
-- NULLs-distinct give identical protection without touching the existing
-- Strava webhook upsert call.
--
-- Plus:
--   - `health_daily_samples` table for rolling RHR/HRV/sleep/VO2-max
--     (feeds the readiness baseline + race-times VO2 cross-check).
--   - `user_settings.healthkit_connected_at` for connection state.

-- ── strava_activities mutations ─────────────────────────────────────────

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'strava'
  CHECK (source IN ('strava', 'apple_health'));

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS apple_health_uuid TEXT;

ALTER TABLE strava_activities
  ALTER COLUMN strava_activity_id DROP NOT NULL;

-- Drop the original auto-named unique constraint, replace with named ones.
ALTER TABLE strava_activities
  DROP CONSTRAINT IF EXISTS strava_activities_user_id_strava_activity_id_key;

ALTER TABLE strava_activities
  ADD CONSTRAINT strava_activities_user_strava_uniq
  UNIQUE (user_id, strava_activity_id);

ALTER TABLE strava_activities
  ADD CONSTRAINT strava_activities_user_health_uniq
  UNIQUE (user_id, apple_health_uuid);

ALTER TABLE strava_activities
  ADD CONSTRAINT strava_activities_source_id_check CHECK (
    (source = 'strava'       AND strava_activity_id IS NOT NULL) OR
    (source = 'apple_health' AND apple_health_uuid  IS NOT NULL)
  );

-- ── health_daily_samples ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS health_daily_samples (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sample_date  DATE NOT NULL,
  rhr_bpm      INTEGER,
  hrv_ms       NUMERIC(6,2),
  sleep_hours  NUMERIC(4,2),
  vo2_max      NUMERIC(5,2),
  source       TEXT NOT NULL DEFAULT 'apple_health',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sample_date)
);

ALTER TABLE health_daily_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own health_daily_samples"
  ON health_daily_samples FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (ingest route) bypasses RLS by default; no insert policy needed.

CREATE INDEX IF NOT EXISTS health_daily_samples_user_date
  ON health_daily_samples(user_id, sample_date DESC);

-- ── user_settings.healthkit_connected_at ────────────────────────────────

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS healthkit_connected_at TIMESTAMPTZ;

-- ── session_completions.apple_health_uuid ───────────────────────────────
-- Sibling to strava_activity_id so an auto-matched session knows which
-- HealthKit workout completed it. analyseRun and the auto-match flow
-- read whichever of the two is non-null.

ALTER TABLE session_completions
  ADD COLUMN IF NOT EXISTS apple_health_uuid TEXT;

-- ── plan_adjustments.trigger_type — add readiness_signal ────────────────
-- Pre-session readiness adjustment (CoachingPrinciples §59). Composite of
-- RHR/HRV/sleep deviations from 14-day baseline. Soften — never auto-skip.

ALTER TABLE plan_adjustments
  DROP CONSTRAINT IF EXISTS plan_adjustments_trigger_type_check;

ALTER TABLE plan_adjustments
  ADD CONSTRAINT plan_adjustments_trigger_type_check
  CHECK (trigger_type IN (
    'acute_chronic_high',
    'zone_drift',
    'shadow_load',
    'ef_decline',
    'fatigue_accumulation',
    'skip_with_reason',
    'session_reorder',
    'readiness_signal',
    'manual'
  ));

-- ── run_analysis: source-agnostic IDs ───────────────────────────────────
-- Same pattern as strava_activities: keep strava_activity_id, add
-- apple_health_uuid sibling, replace the unique constraint with one per
-- ID type, CHECK that at least one is set.

ALTER TABLE run_analysis
  ADD COLUMN IF NOT EXISTS apple_health_uuid TEXT;

ALTER TABLE run_analysis
  ALTER COLUMN strava_activity_id DROP NOT NULL;

ALTER TABLE run_analysis
  DROP CONSTRAINT IF EXISTS run_analysis_user_id_strava_activity_id_key;

ALTER TABLE run_analysis
  ADD CONSTRAINT run_analysis_user_strava_uniq
  UNIQUE (user_id, strava_activity_id);

ALTER TABLE run_analysis
  ADD CONSTRAINT run_analysis_user_health_uniq
  UNIQUE (user_id, apple_health_uuid);

ALTER TABLE run_analysis
  ADD CONSTRAINT run_analysis_source_id_check CHECK (
    strava_activity_id IS NOT NULL OR apple_health_uuid IS NOT NULL
  );
