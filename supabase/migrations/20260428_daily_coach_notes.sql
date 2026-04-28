-- Migration: daily_coach_notes table
-- Stores AI-generated daily coaching notes. One per user per local date.
-- Surfaced as the Z coach card at the top of Today screen for paid/trial users.
-- Free users do not see this card.

CREATE TABLE IF NOT EXISTS daily_coach_notes (
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_date    DATE NOT NULL,                       -- user's local date the note is for
  content      TEXT NOT NULL,                       -- one-sentence coach note in Zona voice
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ai_model     TEXT,                                -- e.g. 'claude-haiku-4-5'

  PRIMARY KEY (user_id, note_date)
);

ALTER TABLE daily_coach_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily_coach_notes"
  ON daily_coach_notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_coach_notes"
  ON daily_coach_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily_coach_notes"
  ON daily_coach_notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS daily_coach_notes_user_date ON daily_coach_notes(user_id, note_date DESC);
