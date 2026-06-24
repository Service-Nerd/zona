-- HR-SYNC-01: Instrumentation columns for HR-sync latency absorption.
--
-- Context (ADR-011 §5 + SLT 2026-06-24): Apple Watch HR samples land in HealthKit
-- on Apple's schedule, not ours — typical 5–30 min, long tail to 24–48h. The
-- HK-SOR doctrine commits us to absorbing this latency honestly. Two columns
-- track:
--
--   hr_present_at_first_query: did we have HR at the first ingest? Set on
--     INSERT; never overwritten on resync. Drives the pending-state UX and
--     the "% of runs with HR at first query" cohort metric (Fried/Traynor
--     non-negotiable instrumentation).
--
--   hr_arrived_late_at: timestamp when HR was patched onto a previously
--     HR-null row. NULL when HR was present at first ingest. Drives the
--     Hutchinson late-arrival coaching-correctness gate: when (now - workout_end)
--     > 24h, we patch HR for downstream use (zone ledger, weekly report) but
--     do NOT trigger a fresh post-run reframe — the coaching moment has passed.
--
-- Both columns are nullable + additive. No defaults backfilled — existing rows
-- carry NULL for both, which the code treats as "unknown / pre-instrumentation".

ALTER TABLE strava_activities
  ADD COLUMN IF NOT EXISTS hr_present_at_first_query BOOLEAN,
  ADD COLUMN IF NOT EXISTS hr_arrived_late_at        TIMESTAMPTZ;

-- Partial index on hr_arrived_late_at so the daily coach note (and any future
-- "HR arrived for yesterday's run" surfaces) can find recent late-arrivals
-- without scanning the full table. Recent-late-arrival is a narrow set.
CREATE INDEX IF NOT EXISTS idx_strava_activities_hr_arrived_late
  ON strava_activities (user_id, hr_arrived_late_at)
  WHERE hr_arrived_late_at IS NOT NULL;
