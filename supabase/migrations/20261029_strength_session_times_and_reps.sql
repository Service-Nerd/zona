-- STRENGTH-GUIDED-SESSION-01 + STRENGTH-LOG-REPS-01 (Design Board 2026-10-28 F; Coaching Board S14 Am.1).
--
-- 1. A guided session stores when it started and ended (Design Board F: "stored: session times and the existing lift
--    logs"). Null on a session marked complete without starting, and on every row written before this.
-- 2. A lift log stores the reps the plan prescribed that lift on its date, written by the route from the stored plan,
--    never from the request. S14 Am.1 reads it to bring the load down when a block's reps rise; before this the reps
--    were re-derived from the CURRENT plan by date, which a rebuild with a new start date can move. Null on old rows:
--    the reader falls back to the plan, as it did.
--
-- No new table, so no grant (MIGRATION-GRANTS-01 covers new tables). Both tables already cascade with the account
-- (DB-USER-PURGE-01) and keep their own-row RLS policies, which cover new columns.

alter table strength_completions
  add column if not exists started_at timestamptz,
  add column if not exists ended_at   timestamptz;

alter table strength_completions drop constraint if exists strength_completions_times_check;
alter table strength_completions add constraint strength_completions_times_check
  check ((started_at is null) = (ended_at is null) and (ended_at is null or ended_at >= started_at));

alter table strength_lift_logs
  add column if not exists reps smallint check (reps is null or (reps between 1 and 50));
