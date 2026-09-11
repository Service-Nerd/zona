-- Restores 20260428_daily_coach_notes.sql, which was committed AND recorded in
-- .claude/state/applied-migrations.txt but never landed in this project.
--
-- Consequence while missing: the daily-coach-note cache read errored on every
-- request and both call sites discarded the error, so the route regenerated the
-- note via Anthropic on every app open instead of once per user per day. No
-- symptom other than the bill and the latency.
--
-- The ledger records an INTENTION, not an outcome. `npm run check:db` now
-- verifies every table a migration creates actually exists.
--
-- Applied to production 2026-09-11. Idempotent.

CREATE TABLE IF NOT EXISTS daily_coach_notes (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date    DATE NOT NULL,
  content      TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_model     TEXT,
  PRIMARY KEY (user_id, note_date)
);

ALTER TABLE daily_coach_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can read own daily_coach_notes"
    ON daily_coach_notes FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own daily_coach_notes"
    ON daily_coach_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own daily_coach_notes"
    ON daily_coach_notes FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS daily_coach_notes_user_date
  ON daily_coach_notes(user_id, note_date DESC);
