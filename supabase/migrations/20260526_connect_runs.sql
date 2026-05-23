-- CONNECT-01: Connect-Your-Runs ceremonial onboarding screen
--
-- Two new columns on user_settings:
--   connect_runs_seen                 — tri-state BOOLEAN with NULL semantics:
--                                       NULL  = never shown the ConnectRuns screen (default)
--                                       FALSE = shown the screen, user skipped
--                                       TRUE  = shown the screen, user connected at least one source
--   connect_runs_banner_dismissed_at  — timestamp the one-shot "still need your runs"
--                                       reminder banner was dismissed (or tapped) on Today.
--                                       Banner appears for skipped users until this is set.
--
-- Default NULL on connect_runs_seen is intentional — existing users at migration
-- time will see the screen once on next session-day open, per spec.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS connect_runs_seen                BOOLEAN,
  ADD COLUMN IF NOT EXISTS connect_runs_banner_dismissed_at TIMESTAMPTZ;
