-- Migration: race_readiness_notes table
-- Stores AI-generated pre-race readiness assessments. One per user per race date.
-- Generated once when CoachScreen detects daysToRace ∈ [0, 14].
-- Shown on the Coach screen from generation until race day.
-- Takes priority over phase_summaries (R28) when both conditions could theoretically apply.
-- Idempotent: re-opening Coach screen within the window never re-generates
-- (PK on user_id + race_date guarantees this).
-- New race date = new plan = new row generated fresh.

CREATE TABLE IF NOT EXISTS race_readiness_notes (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  race_date      DATE NOT NULL,              -- from plan.meta.race_date — PK key for idempotency
  content        TEXT NOT NULL,              -- 2–3 sentences of AI coaching in Zona voice
  days_to_race   INTEGER NOT NULL,           -- snapshot of daysToRace at generation time
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_model       TEXT,

  PRIMARY KEY (user_id, race_date)
);

ALTER TABLE race_readiness_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own race_readiness_notes"
  ON race_readiness_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own race_readiness_notes"
  ON race_readiness_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
