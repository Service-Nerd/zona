-- DS-02: Add calories_kcal to the activity log (strava_activities).
--
-- totalEnergyBurned is already read from HKWorkout.totalEnergyBurned on the
-- iOS sync side (lib/health/clientSync.ts) and included in HealthKitWorkoutPayload.
-- This column makes it persistent so the coaching engine can use caloric load
-- as a supplementary signal alongside distance and time.
--
-- Nullable: Strava activities don't currently populate this field (Strava provides
-- kilojoules; conversion and backfill are a separate task). HealthKit activities
-- will populate from next sync onwards.
--
-- NUMERIC(8,1): supports up to 9,999,999.9 kcal — well above any realistic run.

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS calories_kcal NUMERIC(8,1);
