-- HOOK-01: daily morning training-day push
--
-- Adds three columns to user_settings:
--   daily_push_enabled       — user opt-out toggle (default true; cron filters on this).
--   timezone                 — IANA tz id used to compute the user's local 06:30 send window.
--   daily_push_last_sent_on  — date stamp the cron writes after a successful send. Idempotency
--                              backstop so a re-run inside the same local day cannot double-fire.
--   last_today_open_at       — timestamp the dashboard heartbeats when the Today screen mounts.
--                              Cron skips the push when this is within the last 30 minutes to
--                              avoid double-prompting a runner who already opened the app.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS daily_push_enabled      BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone                TEXT        NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS daily_push_last_sent_on DATE,
  ADD COLUMN IF NOT EXISTS last_today_open_at      TIMESTAMPTZ;
