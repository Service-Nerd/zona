-- Migration: add ENGINE-01 + ENGINE-02 trigger types to plan_adjustments.
--
-- The latest trigger_type CHECK (20260501_healthkit_primary.sql) never picked up
-- the two engine triggers shipped in code:
--   * fitness_signal     (ENGINE-01) — quality sessions faster than band, HR controlled
--   * long_run_shortfall (ENGINE-02) — consecutive long runs significantly under plan
-- Both builders emit these trigger_type values, so without this constraint the
-- INSERT into plan_adjustments fails the CHECK and the adjustment is lost.
-- This closes that gap for both (ENGINE-01 was marked shipped but could not persist).
--
-- Idempotent: drop-if-exists then re-add the full, current 11-type taxonomy.
-- Source of truth for the list: TriggerType in lib/coaching/planAdjustment.ts.

ALTER TABLE plan_adjustments
  DROP CONSTRAINT IF EXISTS plan_adjustments_trigger_type_check;

ALTER TABLE plan_adjustments
  ADD CONSTRAINT plan_adjustments_trigger_type_check
  CHECK (trigger_type IN (
    'acute_chronic_high',
    'zone_drift',
    'shadow_load',
    'ef_decline',
    'fatigue_accumulation',
    'skip_with_reason',
    'session_reorder',
    'readiness_signal',
    'manual',
    'fitness_signal',
    'long_run_shortfall'
  ));
