-- Migration: coaching signal fields on session_completions
-- Run this in Supabase SQL editor before deploying the coaching signal build.
--
-- Adds:
--   avg_hr        INTEGER  — average heart rate from the linked Strava activity
--   coaching_flag TEXT     — computed quality-of-execution signal ('ok' | 'watch' | 'flag')
--
-- Both columns are nullable. Existing rows are unaffected.

ALTER TABLE session_completions
  ADD COLUMN IF NOT EXISTS avg_hr        INTEGER,
  ADD COLUMN IF NOT EXISTS coaching_flag TEXT
    CHECK (coaching_flag IN ('ok', 'watch', 'flag'));
