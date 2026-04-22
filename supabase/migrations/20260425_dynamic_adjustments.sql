-- Migration: dynamic_adjustments_enabled on user_settings
-- Feature 3 opt-in toggle. Default true for paid/trial users.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS dynamic_adjustments_enabled BOOLEAN NOT NULL DEFAULT true;
