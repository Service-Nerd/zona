-- Migration: weekly_reports table
-- Stores AI-generated weekly coaching reports. One per user per week.
-- Generated Sundays; surfaced in Coach tab.

CREATE TABLE IF NOT EXISTS weekly_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_n                INTEGER NOT NULL,

  -- Computed inputs (deterministic, stored for auditability)
  sessions_completed    INTEGER NOT NULL DEFAULT 0,
  sessions_planned      INTEGER NOT NULL DEFAULT 0,
  total_km_actual       NUMERIC(6,2),
  total_km_planned      NUMERIC(6,2),
  acute_chronic_ratio   NUMERIC(5,3),            -- this week load / 4-week rolling avg
  zone_discipline_score INTEGER,                 -- 0–100, weighted avg HR-in-zone
  avg_rpe               NUMERIC(4,2),
  dominant_flag         TEXT CHECK (dominant_flag IN ('ok', 'watch', 'flag')),

  -- AI-generated content
  headline              TEXT,                    -- one punchy line (Zona voice)
  body                  TEXT,                    -- 2–3 sentences, coaching insight
  cta                   TEXT,                    -- one actionable sentence

  -- Delivery tracking
  generated_at          TIMESTAMPTZ,
  opened_at             TIMESTAMPTZ,
  ai_model              TEXT,
  rule_engine_version   TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, week_n)
);

ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own weekly_reports"
  ON weekly_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly_reports"
  ON weekly_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly_reports"
  ON weekly_reports FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS weekly_reports_user_week ON weekly_reports(user_id, week_n);
