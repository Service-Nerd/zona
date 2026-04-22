-- Migration: run_analysis table
-- Stores deterministic per-session coaching analysis.
-- Written when a Strava activity is linked to a planned session.

CREATE TABLE IF NOT EXISTS run_analysis (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_n                INTEGER NOT NULL,
  session_day           TEXT NOT NULL,           -- e.g. 'week_3_tuesday'
  strava_activity_id    BIGINT NOT NULL,

  -- Execution scoring (0–100 each)
  hr_discipline_score   INTEGER,                 -- % time in target HR band (0–100)
  distance_score        INTEGER,                 -- actual vs planned distance (0–100)
  pace_score            INTEGER,                 -- actual vs target pace (0–100)
  ef_score              INTEGER,                 -- aerobic efficiency vs 4-week avg (0–100)
  total_score           INTEGER,                 -- weighted composite
  verdict               TEXT CHECK (verdict IN ('nailed', 'close', 'off_target', 'concerning')),

  -- HR stream summary (raw discarded after compute)
  hr_in_zone_pct        NUMERIC(5,2),            -- % time in prescribed zone
  hr_above_ceiling_pct  NUMERIC(5,2),            -- % time above zone ceiling
  hr_below_floor_pct    NUMERIC(5,2),            -- % time below zone floor

  -- Aerobic efficiency
  ef_value              NUMERIC(6,4),            -- pace_m_per_s / avg_hr
  ef_baseline           NUMERIC(6,4),            -- 4-week rolling avg for session type
  ef_trend_pct          NUMERIC(6,2),            -- % change vs baseline

  -- Load
  planned_load_km       NUMERIC(6,2),
  actual_load_km        NUMERIC(6,2),

  rule_engine_version   TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, strava_activity_id)
);

ALTER TABLE run_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own run_analysis"
  ON run_analysis FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own run_analysis"
  ON run_analysis FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own run_analysis"
  ON run_analysis FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS run_analysis_user_week ON run_analysis(user_id, week_n);
