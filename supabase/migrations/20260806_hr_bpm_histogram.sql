-- N7 (2026-08-06 plan-defect incident) — make HealthKit runs re-bucketable.
--
-- /api/recalibrate-hr can re-bucket Strava runs by re-fetching the raw HR stream
-- from Strava's API. HealthKit runs could not be: the device sends raw samples
-- to /api/health/ingest, the server buckets them against the user's zones, and
-- then discards them. So correcting a user's HR zones left every HealthKit-
-- sourced run carrying hr_pct_z* computed against the OLD zones, permanently —
-- and HealthKit is the system of record for run data (ADR-011).
--
-- Storing a bpm -> sample-count histogram is lossless for this purpose: zone
-- bucketing depends only on how many samples fall in each band, never on their
-- order. ~1 KB per run versus thousands of raw values.
--
-- Nullable and backfill-free by design. Rows ingested before this migration have
-- no histogram and simply remain un-re-bucketable, exactly as they are today;
-- they are not made worse. New rows are correctable for good.

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS hr_bpm_histogram JSONB;

COMMENT ON COLUMN strava_activities.hr_bpm_histogram IS
  'bpm -> sample count. Lossless input for zone re-bucketing (lib/strava.ts bucketHRHistogram). Populated at ingest for HealthKit runs; null for rows predating 2026-08-06 and for sources with no HR stream.';
