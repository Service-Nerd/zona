-- AI-DEPTH (ChatGPT-prompt inspired enrichment) — pace-fade signal.
--
-- Strava's DetailedActivity response includes `splits_metric` — per-km splits
-- with moving_time, distance, average_speed, average_heartrate. This is the
-- raw material for pace-fade detection: comparing first-half vs back-half
-- average pace to identify late-run slowdown that aggregate avg pace hides.
--
-- Stored as JSONB rather than a derived summary column because (a) the source
-- shape is small (typically <10KB even for ultra-distance), (b) downstream
-- analytics may evolve to extract more than just fade (e.g. surge detection,
-- per-km HR drift), and (c) recomputation from source is far cheaper than
-- backfilling derived columns when the logic changes.
--
-- Null for HealthKit-sourced rows (HealthKit doesn't carry per-km splits in
-- its workout export), manual rows, and Strava activities ingested before
-- this migration. No backfill — only forward capture.

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS splits_metric JSONB;

COMMENT ON COLUMN strava_activities.splits_metric IS
  'Per-km splits as returned by Strava (array of {distance, moving_time, average_speed, average_heartrate, ...}). Null for HealthKit and pre-migration rows.';
