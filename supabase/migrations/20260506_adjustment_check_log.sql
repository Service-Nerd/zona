-- Migration: record the last time the plan-adjustment engine ran for the user,
-- and whether it found a change. Powers the "Last checked …" line on the
-- Me → Plan adjustments section so the feature is visible even when it has
-- nothing to suggest.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS last_adjustment_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_adjustment_check_found_change boolean;
