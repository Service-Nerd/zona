-- Migration: run_analysis manual source support
--
-- Adds a `source` discriminator column so manual (RPE-only) coaching rows
-- can coexist with Strava and HealthKit analysis rows without violating the
-- existing per-activity-ID unique constraints.
--
-- Changes:
--   1. Add `source` column ('strava' | 'apple_health' | 'manual'), default 'strava'.
--   2. Drop the existing CHECK that requires at least one activity ID — it fires
--      for manual rows where both IDs are intentionally null.
--   3. Replace with a new CHECK that allows both nulls only when source='manual'.
--   4. Partial unique index on (user_id, week_n, session_day) WHERE source='manual'
--      — prevents duplicate manual rows per session without conflicting with
--      the existing full unique constraints (user_strava_uniq, user_health_uniq).
--      Manual rows are written via DELETE + INSERT (not upsert), so Supabase's
--      partial-index upsert limitation doesn't apply here.

ALTER TABLE run_analysis
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'strava'
  CHECK (source IN ('strava', 'apple_health', 'manual'));

-- Drop the old CHECK that required at least one activity ID (manual rows
-- legitimately have both null).
ALTER TABLE run_analysis
  DROP CONSTRAINT IF EXISTS run_analysis_source_id_check;

-- New CHECK: manual rows may have null IDs; all other rows must have one.
ALTER TABLE run_analysis
  ADD CONSTRAINT run_analysis_source_id_check CHECK (
    source = 'manual'
    OR strava_activity_id IS NOT NULL
    OR apple_health_uuid  IS NOT NULL
  );

-- Partial unique index — one manual coaching row per user per session.
CREATE UNIQUE INDEX IF NOT EXISTS run_analysis_manual_uniq
  ON run_analysis (user_id, week_n, session_day)
  WHERE source = 'manual';
