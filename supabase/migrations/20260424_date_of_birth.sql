-- Add date_of_birth to user_settings
-- Replaces age (calculated annually) with DOB (calculated once, enables birthday messaging)
-- Date stored as YYYY-MM-DD; age is derived at generation time

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS date_of_birth DATE;
