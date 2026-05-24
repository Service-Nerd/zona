-- AI-DEPTH (ChatGPT-prompt inspired enrichment) — temperature ingest.
--
-- Strava exposes `average_temp` on its activity detail payload (degrees
-- Celsius, integer). A hot run reads completely differently from a cool one
-- — HR running 10bpm above zone in 28°C is execution noise, not an
-- execution failure — and the AI feedback prompts need that context to
-- avoid lecturing the runner about discipline they actually held.
--
-- Column is nullable: HealthKit-sourced rows and pre-migration Strava rows
-- have no temp data, the prompt simply omits the temp block in those cases.
-- No backfill — only forward capture.

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS avg_temp_c NUMERIC(5,2);

COMMENT ON COLUMN strava_activities.avg_temp_c IS
  'Strava average_temp (°C). Null for HealthKit-sourced rows and any Strava activity ingested before this migration.';
