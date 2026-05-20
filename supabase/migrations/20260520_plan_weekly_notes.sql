-- Migration: plan_weekly_notes (PLAN-VOICE-AI)
-- AI-generated one-line headline + 1–2 items spoken about the current training
-- week. Rendered on the Plan screen voice card for paid/trial users. Cached per
-- (user_id, week_n) — idempotent endpoint regenerates only when no row exists.
--
-- Invalidation: rows are deleted en bloc whenever the user's plan changes
-- (see savePlanForUser in lib/plan.ts) so the next Plan-screen view regenerates
-- against the new session shape rather than narrating sessions that no longer
-- exist. Cost-bounded — Haiku call, cached for the rest of the week.

CREATE TABLE IF NOT EXISTS plan_weekly_notes (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_n       INTEGER NOT NULL,
  headline     TEXT NOT NULL,
  items        JSONB NOT NULL DEFAULT '[]'::jsonb,   -- string[]
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_model     TEXT,

  PRIMARY KEY (user_id, week_n)
);

ALTER TABLE plan_weekly_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own plan_weekly_notes"
  ON plan_weekly_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plan_weekly_notes"
  ON plan_weekly_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan_weekly_notes"
  ON plan_weekly_notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS plan_weekly_notes_user_week
  ON plan_weekly_notes(user_id, week_n);
