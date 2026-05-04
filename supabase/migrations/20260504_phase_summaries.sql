-- Migration: phase_summaries table
-- Stores AI-generated end-of-phase summaries. One per user per phase transition.
-- Generated once when CoachScreen detects the plan has entered a new phase.
-- Shown on the Coach screen for 7 days after generation, then disappears.
-- Suppressed entirely when race readiness (R29) is active (daysToRace ≤ 14).

CREATE TABLE IF NOT EXISTS phase_summaries (
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase_ended        TEXT NOT NULL,               -- phase that just finished: 'base'|'build'|'peak'|'foundation'
  transition_week_n  INTEGER NOT NULL,            -- plan week number when the new phase started
  content            TEXT NOT NULL,               -- 2–3 sentences of AI coaching in Zona voice
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_model           TEXT,

  PRIMARY KEY (user_id, phase_ended, transition_week_n)
);

ALTER TABLE phase_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own phase_summaries"
  ON phase_summaries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own phase_summaries"
  ON phase_summaries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS phase_summaries_user_generated
  ON phase_summaries(user_id, generated_at DESC);
