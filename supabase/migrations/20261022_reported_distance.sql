-- UNMEASURED-DISTANCE-01 (architecture + Coaching Board + Design Board 6t-i, 2026-10-22).
--
-- A run whose device wrote no distance (Peloton, some Garmin Connect and WHOOP syncs: 47 of 354 Apple Health runs on
-- 2026-10-22) can be given one by the runner. It is stored BESIDE the measured value, never in it: `distance_m` stays the
-- device's (ADR-011: HealthKit is the system of record), and these two columns hold what the runner typed.
--
-- Written only by `/api/health/ingest` (source: 'report_distance'), fill-only: refused when `distance_m` > 0.
-- Read only through `lib/health/runDistance.ts`. It counts for volume, load and display (labelled); it never feeds a
-- fitness estimate (VDOT, race times, the wizard benchmark), per the Coaching Board.

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS reported_distance_m NUMERIC
    CHECK (reported_distance_m IS NULL OR (reported_distance_m > 0 AND reported_distance_m <= 200000)),
  ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ;
