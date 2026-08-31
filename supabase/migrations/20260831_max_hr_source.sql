-- Migration: max HR provenance (HR-MAX-01)
--
-- CoachingPrinciples §50 asymmetry — a max HR below the age estimate is a device
-- *floor* (the highest the watch happened to record), not a maximum. The engine
-- now rejects a device-observed or unattributed sub-estimate max in favour of the
-- Tanaka estimate, and trusts a below-estimate value only when the runner has
-- explicitly confirmed it.
--
-- That distinction needs provenance on the stored max. This column records where
-- user_settings.max_hr came from:
--   * 'observed'       — written from HealthKit history (a floor)
--   * 'user_confirmed' — typed by the runner in Profile → Save
--   * NULL             — unattributed (legacy rows; treated as a floor on the low
--                        side, self-healing to 'user_confirmed' on the next save)
--
-- Nullable, no backfill: existing rows stay NULL and are guarded as unattributed.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS max_hr_source TEXT
  CHECK (max_hr_source IN ('observed', 'user_confirmed'));
