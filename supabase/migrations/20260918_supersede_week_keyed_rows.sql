-- PLAN-WEEK-COLLISION-01 — week_n is a WITHIN-PLAN coordinate, not a cross-plan key.
--
-- THE DEFECT. `session_completions`, `run_analysis`, `session_overrides`,
-- `session_metric_overrides` and `session_reflections` are all keyed
-- (user_id, week_n[, session_day]) with NO plan identity. A new race plan
-- restarts `week.n` at 1, so it lands exactly on the rows of the plan it
-- replaced. Measured on the founder's account 2026-09-18: a fresh 12-week 10K
-- plan arrived with 44 of 47 sessions (94%) already marked complete or skipped
-- and 5 linked to runs from the previous April.
--
-- WHY `week.n` CANNOT SIMPLY BE RENUMBERED. It carries meaning: foundation
-- weeks are numbered `i - weekCount` (negative, foundationBlock.ts:367) and the
-- engine uses `w.n > 0` as its "is this a main-plan week" guard in the taper and
-- peak passes (ruleEngine.ts:3989, :4000). Offsetting every week to continue the
-- sequence would push foundation weeks positive and corrupt the taper curve.
--
-- WHY NOT DELETE. Nothing displays per-week completions for an archived plan
-- (Plan History reads `plan_archive` only), but the time-windowed readers — the
-- aerobic trend card, discipline ledger, reframe cohorts, `v_coach_engagement` —
-- all aggregate across plans. Deleting on every new race would silently destroy
-- a runner's training history to fix a display bug.
--
-- THE FIX. Mark, do not move and do not delete. `savePlanForUser` already
-- archives the prior plan and already deletes `plan_weekly_notes` on a
-- RACE-IDENTITY change, with the comment "a cached note narrating sessions that
-- no longer exist is brand-destroying". That is the same argument these rows
-- needed and did not get. The stamp goes in at that exact point.
--
-- NULL means "belongs to the live plan". Week-keyed reads filter on it;
-- time-windowed aggregate reads deliberately do NOT, so history survives.

ALTER TABLE session_completions       ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
ALTER TABLE run_analysis              ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
ALTER TABLE session_overrides         ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
ALTER TABLE session_metric_overrides  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;
ALTER TABLE session_reflections       ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

-- Partial indexes on the LIVE rows. Every week-keyed read adds
-- `superseded_at IS NULL`, and the live set stays small while the superseded
-- set grows without bound across a runner's career.
CREATE INDEX IF NOT EXISTS session_completions_live_idx
  ON session_completions (user_id, week_n, session_day) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS run_analysis_live_idx
  ON run_analysis (user_id, week_n) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS session_overrides_live_idx
  ON session_overrides (user_id, week_n) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS session_metric_overrides_live_idx
  ON session_metric_overrides (user_id, week_n) WHERE superseded_at IS NULL;
CREATE INDEX IF NOT EXISTS session_reflections_live_idx
  ON session_reflections (user_id, week_n) WHERE superseded_at IS NULL;

COMMENT ON COLUMN session_completions.superseded_at IS
  'PLAN-WEEK-COLLISION-01. Non-null when this row belongs to a plan that has been replaced by a new RACE IDENTITY. week_n is a within-plan coordinate, so without this a new plan inherits the old plan''s rows. NULL = live plan. Stamped by lib/plan/supersede.ts, called from savePlanForUser.';
