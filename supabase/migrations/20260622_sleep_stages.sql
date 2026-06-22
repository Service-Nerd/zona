-- Migration: DS-05 — sleep stage breakdown on health_daily_samples.
--
-- Today the ingest pipeline reads HealthKit sleep samples (which carry a
-- sleepState: deep/rem/light/awake/asleep) but discards the breakdown, keeping
-- only total active-sleep duration in sleep_hours. This adds a JSONB column to
-- persist the per-stage minutes so the readiness signal can weigh sleep QUALITY
-- (deep-sleep proportion), not just duration.
--
-- Shape: { "deep": <mins>, "rem": <mins>, "light": <mins>, "awake": <mins> }
-- NULL when the source provided no staged data (e.g. a third-party tracker that
-- only reports undifferentiated "asleep"). sleep_hours is unaffected — it keeps
-- counting all active sleep regardless of whether stages are present.

ALTER TABLE health_daily_samples
  ADD COLUMN IF NOT EXISTS sleep_stages JSONB;
