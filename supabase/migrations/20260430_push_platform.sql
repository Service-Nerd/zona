-- Migration: add platform column to push_subscriptions
--
-- Web Push and Apple Push Notification service (APNs) use different
-- credential shapes:
--   web: endpoint URL + p256dh + auth secret
--   ios: device token (stored in `endpoint`)
--
-- Adding a `platform` column lets the cron sender pick the right
-- delivery path. p256dh / auth become nullable so the iOS rows don't
-- need to fake them.

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web'
  CHECK (platform IN ('web', 'ios'));

ALTER TABLE push_subscriptions
  ALTER COLUMN p256dh DROP NOT NULL;

ALTER TABLE push_subscriptions
  ALTER COLUMN auth DROP NOT NULL;
