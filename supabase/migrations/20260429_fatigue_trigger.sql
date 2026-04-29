-- Migration: add fatigue_accumulation to plan_adjustments trigger_type
-- Trigger 4: detects 3 consecutive Heavy/Wrecked/Cooked fatigue logs and proposes softening.

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
    'manual'
  ));
