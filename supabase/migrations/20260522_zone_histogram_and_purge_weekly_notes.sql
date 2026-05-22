-- Migration: full zone histogram on strava_activities + purge stale plan_weekly_notes
--
-- WHY (zone histogram):
-- Until now strava_activities.hr_in_zone_pct meant "% in Z2", regardless of
-- what zone the session prescribed. That made any tempo/intervals analysis
-- look like a Z2 failure even when the runner nailed Z3 or Z4-5. The schema
-- comment on run_analysis.hr_in_zone_pct already says "% in prescribed zone";
-- this migration brings the storage shape into line so /api/analyse-run can
-- finally honour that contract.
--
-- The histogram columns store the percentage of HR samples that landed in
-- each zone band. /api/analyse-run picks the column matching the matched
-- session's prescribed zone and writes that into run_analysis.hr_in_zone_pct.
-- Above/below figures on run_analysis become "above/below the prescribed
-- zone" (sum of bands above/below).
--
-- The existing hr_in_zone_pct / hr_above_ceiling_pct / hr_below_floor_pct
-- columns on strava_activities stay (still Z2-anchored) — they remain useful
-- for cohort comparisons in runHistory where prescription isn't known and a
-- consistent reference band is desirable.

ALTER TABLE strava_activities ADD COLUMN IF NOT EXISTS hr_pct_z1   NUMERIC(5,2);
ALTER TABLE strava_activities ADD COLUMN IF NOT EXISTS hr_pct_z2   NUMERIC(5,2);
ALTER TABLE strava_activities ADD COLUMN IF NOT EXISTS hr_pct_z3   NUMERIC(5,2);
ALTER TABLE strava_activities ADD COLUMN IF NOT EXISTS hr_pct_z4_5 NUMERIC(5,2);

-- WHY (purge):
-- app/api/plan-weekly-note/route.ts was looking up week.sessions['Mon'/'Tue'/…]
-- but the plan schema keys sessions with lowercase 3-letter day names
-- (mon/tue/…). Every cached row was generated against an empty sessions
-- block, so the AI produced "no running this week, let recovery do the work"
-- on weeks that actually had runs scheduled. Delete the bad cache; the
-- route's idempotency check will regenerate against the fixed code on next
-- view.

DELETE FROM plan_weekly_notes;
