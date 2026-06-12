-- Replace exact date_of_birth with year_of_birth — App Store Guideline 5.1.1
-- data minimisation. The engine only needs an integer age for the Tanaka max-HR
-- fallback (208 − 0.7 × age) and the masters threshold (age ≥ 45). Day/month
-- were never read by any consumer. Apple rejection note (v1.7): "An alternate
-- age identifier would be appropriate."
--
-- Backfills birth_year from any existing date_of_birth so users don't have to
-- re-enter. date_of_birth column is retained for one release as a safety net
-- and dropped in a follow-up migration once we're confident nothing reads it.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS birth_year INTEGER;

UPDATE user_settings
SET    birth_year = EXTRACT(YEAR FROM date_of_birth)::INTEGER
WHERE  date_of_birth IS NOT NULL
  AND  birth_year IS NULL;

ALTER TABLE user_settings
  DROP CONSTRAINT IF EXISTS user_settings_birth_year_range;

ALTER TABLE user_settings
  ADD CONSTRAINT user_settings_birth_year_range
  CHECK (birth_year IS NULL OR (birth_year >= 1900 AND birth_year <= 2100));
