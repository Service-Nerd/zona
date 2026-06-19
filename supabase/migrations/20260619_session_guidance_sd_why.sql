-- SD-WHY — session_guidance audit + extension.
--
-- The "WHY THIS SESSION" block on Session Detail (DashboardClient.tsx:3997)
-- reads from session_guidance rows keyed by session.type. Three issues
-- surfaced 2026-06-19:
--
--   1. The long-run row is keyed on session_type='run'. The plan engine
--      uses session.type='long', so the lookup misses — long-run sessions
--      currently show no 'why' block unless coach_notes were generated.
--      Free users with rule-engine plans see nothing on long-run days.
--
--   2. Four session types have no guidance at all: recovery, intervals,
--      tempo, cross-train. recovery is the brand-essential one (CLAUDE.md
--      Reframe Voice; the SLT specifically named it as the "Recovery,
--      not light training" line).
--
--   3. Two existing rows (run/long, race) had voice drift toward
--      grandiose. Tightening in this same migration.
--
-- No code changes. Render pipeline (DashboardClient.tsx → CoachNoteBlock
-- variant="why") already handles all session types via guidanceMap lookup.

BEGIN;

-- 1. Rename the long-run row from 'run' → 'long'.
--    The plan engine's session.type is 'long'; the lookup at
--    DashboardClient.tsx:1823 (guidanceMap.get(activeSessionData?.type))
--    was never finding this row.
UPDATE session_guidance
SET session_type = 'long',
    why = 'The most important session of the week. It teaches the body to keep going past the easy-out point — and the mind too.'
WHERE session_type = 'run'
  AND phase IS NULL;

-- 2. Tighten the race-day 'why' — cut the portentous opener.
UPDATE session_guidance
SET why = 'Nothing you do today makes you fitter. The job is to execute the plan and finish well — that''s it.'
WHERE session_type = 'race'
  AND phase IS NULL;

-- 3. Insert missing types: recovery, intervals, tempo, cross-train.
--    ON CONFLICT DO UPDATE so the migration is idempotent across re-runs
--    and safe if a row already exists for a given (session_type, phase).
--    All keyed phase=NULL — phase-specific variants can be added later
--    without colliding with these baseline rows.
INSERT INTO session_guidance (session_type, phase, title, why, what, how)
VALUES
  (
    'recovery',
    NULL,
    'Recovery run',
    'Recovery, not light training. Going hard here steals the next quality day. The clue''s in the name.',
    'Very easy. HR well below {{zone2_ceiling}}. {{session_duration|20–40}} minutes. Lower than your usual easy effort.',
    'If your easy run feels like recovery, you''re running easy too hard. Walk breaks are fine. The goal is to leave more recovered than you started.'
  ),
  (
    'intervals',
    NULL,
    'Interval session',
    'VO2-max work. The intensity is the point — but so is the recovery between reps. Both halves matter.',
    'Repeated efforts at HR {{session_hr|near max}}. Recovery long enough to do the next rep cleanly. 15 min easy warm-up, 10 min easy cool-down.',
    'First rep at planned effort, not "just see how I feel". If you can''t hit the target on rep 3, end the session — quality is the work, junk reps aren''t.'
  ),
  (
    'tempo',
    NULL,
    'Tempo run',
    'Threshold work. Comfortably hard, sustained. The discipline is holding the line, not chasing it harder.',
    'Sustained effort at HR {{session_hr|in your tempo band}}. Sayable in a phrase, not a sentence. 15 min easy warm-up, 10 min easy cool-down.',
    'Lock into the effort early; don''t accelerate halfway through. If you can talk in full sentences you''re going too easy. Racing the watch is going too hard.'
  ),
  (
    'cross-train',
    NULL,
    'Cross-training',
    'Aerobic stimulus without the running impact. Same heart-rate target, different sport. It still counts as work.',
    'Bike, swim, row, or elliptical — your call. Time in Zone 2 (HR {{zone2_ceiling}} or below), {{session_duration|45–60}} min.',
    'Effort, not session. Cross-train at the same heart rate target as an easy run. Treat it as a real session, not a cool-down.'
  )
ON CONFLICT (session_type, phase) DO UPDATE
SET title = EXCLUDED.title,
    why   = EXCLUDED.why,
    what  = EXCLUDED.what,
    how   = EXCLUDED.how;

COMMIT;
