-- HOOK-02: day-3-of-trial "Kit noticed" push (Cialdini reciprocity nudge).
--
-- Single column — the timestamp the cron stamps after firing the one-shot
-- trial-window push. NULL means "not yet sent". Once set, the cron skips
-- this user forever (one-shot by design).

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS trial_insight_push_sent_at TIMESTAMPTZ;
