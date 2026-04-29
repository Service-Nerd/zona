-- Migration: add skip_with_reason and session_reorder to plan_adjustments trigger_type
-- Trigger 2 (skip with reason) and Trigger 1 (session move rebalance).

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
    'manual'
  ));
