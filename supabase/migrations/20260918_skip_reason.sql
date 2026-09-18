-- FIRSTRUN-MISSED-01 — give the missed-session reason its own column.
--
-- `session_completions.fatigue_tag` was carrying TWO vocabularies: the post-run
-- fatigue scale (Fresh/Fine/Heavy/Wrecked) and the missed-session reason
-- (Injury / illness | Too tired | Life got busy | Bad weather). They are
-- disjoint, so no fatigue consumer could ever match a reason -- and worse, the
-- fatigue TREND in DashboardClient pushes any truthy fatigue_tag into a
-- five-entry window whose last three drive `heavyFatigue`. A stored reason
-- therefore DISPLACES real fatigue data and dilutes the trigger.
--
-- NOTE the reason itself was never lost to the coaching layer: the client also
-- POSTs it to /api/adjust-plan, which is what drives §21's content filter and
-- the injury volume reduction. This migration fixes the STORAGE, not the signal.

ALTER TABLE session_completions
  ADD COLUMN IF NOT EXISTS skip_reason TEXT;

COMMENT ON COLUMN session_completions.skip_reason IS
  'Missed-session reason (FIRSTRUN-MISSED-01). Vocabulary owned by lib/coaching/completionVocab.ts -> SKIP_REASONS. Never a fatigue level; fatigue_tag owns those.';

-- Backfill: MOVE the four known reasons out of fatigue_tag. Idempotent, and
-- lossless -- the value is copied before it is cleared, in one statement, so a
-- partial run cannot drop it. Only these exact four strings are touched; any
-- other value (including the legacy 'Cooked') is left alone.
UPDATE session_completions
   SET skip_reason = fatigue_tag,
       fatigue_tag = NULL
 WHERE skip_reason IS NULL
   AND fatigue_tag IN ('Injury / illness', 'Too tired', 'Life got busy', 'Bad weather');

-- Partial index: the only queries that will read this are "why did this runner
-- skip", which are always filtered to rows that HAVE a reason.
CREATE INDEX IF NOT EXISTS session_completions_skip_reason_idx
  ON session_completions (user_id, skip_reason)
  WHERE skip_reason IS NOT NULL;
