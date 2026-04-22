-- Migration: plan_adjustments table
-- Stores every dynamic plan adjustment made by the coaching engine.
-- Before/after snapshots enable one-tap revert.

CREATE TABLE IF NOT EXISTS plan_adjustments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_n                INTEGER NOT NULL,         -- week the adjustment applies to

  trigger_type          TEXT NOT NULL CHECK (trigger_type IN (
    'acute_chronic_high',    -- ratio > 1.3
    'zone_drift',            -- easy sessions trending too hard
    'shadow_load',           -- actual load > 115% of plan for 2+ weeks
    'ef_decline',            -- aerobic efficiency dropping
    'manual'                 -- user-requested adjustment
  )),
  trigger_detail        JSONB,                    -- raw metrics that triggered this

  -- Deterministic adjustment description
  adjustment_type       TEXT NOT NULL CHECK (adjustment_type IN (
    'reduce_volume',
    'swap_session',
    'extend_recovery',
    'reorder_sessions',
    'flag_for_review'
  )),
  summary               TEXT NOT NULL,            -- one-line human-readable summary

  -- Snapshot for revert
  sessions_before       JSONB NOT NULL,           -- array of Session objects
  sessions_after        JSONB NOT NULL,

  -- State
  status                TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'reverted', 'auto_applied')),
  confirmed_at          TIMESTAMPTZ,
  reverted_at           TIMESTAMPTZ,

  rule_engine_version   TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE plan_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plan_adjustments"
  ON plan_adjustments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan_adjustments"
  ON plan_adjustments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan_adjustments"
  ON plan_adjustments FOR UPDATE
  USING (auth.uid() = user_id);

-- Also add strava_activities table for webhook persistence
CREATE TABLE IF NOT EXISTS strava_activities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strava_activity_id    BIGINT NOT NULL,
  activity_type         TEXT,
  sport_type            TEXT,
  name                  TEXT,
  start_date            TIMESTAMPTZ,
  distance_m            NUMERIC(10,2),
  moving_time_s         INTEGER,
  elapsed_time_s        INTEGER,
  elevation_gain        NUMERIC(8,2),
  avg_hr                INTEGER,
  max_hr                INTEGER,
  avg_speed             NUMERIC(8,4),            -- m/s
  suffer_score          INTEGER,

  -- HR stream summary (computed from streams API, raw discarded)
  hr_in_zone_pct        NUMERIC(5,2),
  hr_above_ceiling_pct  NUMERIC(5,2),
  hr_below_floor_pct    NUMERIC(5,2),

  raw_payload           JSONB,                   -- full Strava webhook payload
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, strava_activity_id)
);

ALTER TABLE strava_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own strava_activities"
  ON strava_activities FOR SELECT
  USING (auth.uid() = user_id);

-- Service role (webhook) inserts — no auth.uid() available in webhook context
-- This policy uses service_role key bypass (RLS bypassed for service_role)
-- No additional policy needed; service_role bypasses RLS by default.

CREATE INDEX IF NOT EXISTS strava_activities_user_date
  ON strava_activities(user_id, start_date DESC);

CREATE INDEX IF NOT EXISTS plan_adjustments_user_week
  ON plan_adjustments(user_id, week_n);
