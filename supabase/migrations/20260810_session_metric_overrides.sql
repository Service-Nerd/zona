-- Migration: session_metric_overrides
--
-- Per-session distance⇄duration display override. Previously lived in the browser
-- only (localStorage key `rts_metric_${weekN}_${sessionKey}`), so it was
-- device-local and invisible to the server — the daily push and other
-- server-rendered surfaces could not honour it. Moving it to the database makes a
-- per-session toggle sync across devices AND readable by notifications (ADR-015).
--
-- Deliberately a NEW table, not a column on `session_overrides`: that table is a
-- day-MOVE record (original_day/new_day, both NOT NULL) — a different concern.
-- Conflating the two would violate one-owner-per-concern (D-08). Keyed to mirror
-- the resolveSessionMetric key shape: (week_n, session_key).

CREATE TABLE IF NOT EXISTS session_metric_overrides (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_n       INTEGER NOT NULL,                    -- canonical week.n key (ADR-013)
  session_key  TEXT NOT NULL,                       -- the session's day/id key (e.g. "mon", "w5-wed")
  metric       TEXT NOT NULL CHECK (metric IN ('distance', 'duration')),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_n, session_key)
);

ALTER TABLE session_metric_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own session_metric_overrides"
  ON session_metric_overrides FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own session_metric_overrides"
  ON session_metric_overrides FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own session_metric_overrides"
  ON session_metric_overrides FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own session_metric_overrides"
  ON session_metric_overrides FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS session_metric_overrides_user_idx
  ON session_metric_overrides (user_id);
