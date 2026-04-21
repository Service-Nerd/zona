-- Migration: add trial_started_at to user_settings
-- Set once on first app load; never updated.
-- Determines whether a user is within the 14-day full-access trial window.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
