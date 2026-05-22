-- Migration: session_reflections table (POST-RUN-REFRAME-01)
-- Stores the user's qualitative post-run reflection and the AI reframe response.
-- Keyed by the same composite identity as session_completions: (user_id, week_n, session_day).
--
-- One row per session. Reflection text is mandatory at insert. Reframe fields
-- populate when the AI call completes (or `reframe_silenced` is set when the
-- risk-gate fires and the reframe is suppressed).
--
-- Mirrors the run_analysis pattern: user signal + AI output in one row, 1:1 lifecycle.

CREATE TABLE IF NOT EXISTS session_reflections (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_n                      INTEGER NOT NULL,
  session_day                 TEXT NOT NULL,           -- e.g. 'tuesday' (matches session_completions.session_day)

  -- User input
  note_text                   TEXT NOT NULL,           -- the user's words (text or transcribed voice)
  note_source                 TEXT NOT NULL            -- input modality
    CHECK (note_source IN ('text', 'voice')),
  voice_duration_s            INTEGER,                 -- only when note_source = 'voice'
  voice_transcript_confidence NUMERIC(3,2),            -- Whisper confidence 0.00-1.00, only for voice

  -- AI reframe output
  reframe_text                TEXT,                    -- 3-4 sentence reframe; NULL until generated
  reframe_data_tier           TEXT                     -- which evidence tier the reframe ran at
    CHECK (reframe_data_tier IN ('A', 'B', 'C')),
  reframe_model               TEXT,                    -- e.g. 'claude-sonnet-4-6'
  reframe_prompt_version      TEXT,                    -- builder version for regression tracking
  reframe_silenced            BOOLEAN NOT NULL DEFAULT FALSE,
  reframe_silenced_reason     TEXT,                    -- e.g. 'acute_chronic_overload', 'hr_drift_overload'
  reframe_generated_at        TIMESTAMPTZ,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, week_n, session_day)
);

ALTER TABLE session_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session_reflections"
  ON session_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session_reflections"
  ON session_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session_reflections"
  ON session_reflections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own session_reflections"
  ON session_reflections FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS session_reflections_user_week
  ON session_reflections(user_id, week_n);

CREATE INDEX IF NOT EXISTS session_reflections_user_created
  ON session_reflections(user_id, created_at DESC);
