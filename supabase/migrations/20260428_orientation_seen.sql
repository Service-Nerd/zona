-- B-002: orientation_seen flag
-- Tracks whether a user has seen the post-generation orientation screen.
-- Only set to true once the user dismisses orientation.
-- Prevents orientation re-firing on plan replacements.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS orientation_seen boolean DEFAULT false;
