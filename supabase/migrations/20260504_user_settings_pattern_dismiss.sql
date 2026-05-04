-- Migration: pattern dismiss timestamps on user_settings
--
-- R30 — zone_drift_dismissed_at: records when the user last dismissed the
-- zone drift pattern card. Card reappears after 14 days if the pattern persists.
--
-- R32 — benchmark_recal_dismissed_at: records when the user last dismissed
-- the benchmark recalibration nudge. Nudge reappears after 21 days if the
-- fitness improvement signal still holds.

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS zone_drift_dismissed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS benchmark_recal_dismissed_at TIMESTAMPTZ;
