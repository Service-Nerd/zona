-- Migration: trial email idempotency stamps
-- Prevents re-sending day-11 and day-14 trial emails across daily cron runs.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS trial_email_day11_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_email_day14_sent_at TIMESTAMPTZ;
