-- Migration: notifications table (NOTIF-01)
-- Durable record of every push the app sends, keyed per-user (not per-device).
-- The bell reads these rows; each one mirrors the push payload it was sent with
-- (title / body / data.url). Inserts are service-role only (all sends are
-- server-side); reads + mark-read go through the browser client under RLS.
--
-- `type` is intentionally NOT a CHECK constraint — new notification types should
-- ship without a migration. The union is enforced in TypeScript
-- (lib/notifications.ts → NotificationType). See docs/contracts/api/notifications.md.

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,        -- daily_training | weekly_report | trial_insight | run_feedback | plan_adjustment
  title       TEXT NOT NULL,        -- bold line (mirrors push payload title)
  body        TEXT NOT NULL,        -- message (mirrors push payload body)
  url         TEXT,                 -- deep link (mirrors push payload data.url)
  read_at     TIMESTAMPTZ,          -- null = unread
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Only read pattern: a user's notifications, newest first.
CREATE INDEX IF NOT EXISTS notifications_user_created
  ON notifications (user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own inbox and mark their own rows read. No INSERT policy:
-- only the service-role client (used by every send site) can insert.
CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- One-time backfill: bring existing auto-applied plan adjustments into the inbox
-- so it isn't empty at launch and the (about-to-be-removed) "Recent tweaks" log
-- on MeScreen loses no history. Backfilled rows are marked READ (read_at = now())
-- so the bell doesn't light up with a large unread count for content the user has
-- effectively already seen. No brand name in the title — rename-safe.
INSERT INTO notifications (user_id, type, title, body, url, read_at, created_at)
SELECT
  user_id,
  'plan_adjustment',
  'Plan''s been shifted.',
  summary,
  '/dashboard?screen=plan',
  now(),
  created_at
FROM plan_adjustments
WHERE status = 'auto_applied'
  AND summary IS NOT NULL
  AND trigger_type <> 'manual';
