-- PUSH-ONBOARD: tri-state flag that gates the push-permission ceremony screen.
-- Mirrors connect_runs_seen: NULL = never shown, FALSE = skipped/denied, TRUE = enabled.
-- Web users keep NULL (the screen is iOS-only); pre-migration users get NULL and will
-- see the ceremony on next native open if they haven't already granted push.
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS push_permission_seen BOOLEAN;
