-- STRENGTH-PROGRESSION-01 (S14; Coaching Board + Design Board 2026-10-18) -- what the runner lifted, and how it felt.
--
-- One row per runner per date per exercise: a LIFT, not a set (Blagrove: once per lift per session). Only loaded main
-- lifts carry a weight; bodyweight lifts log the feel with load_kg null. `counts` is decided when the row is written:
-- false for a deload, taper, race-week or recovery-eased session, whose logs never move a suggestion (Hutchinson).
--
-- Security: cascade with the account (DB-USER-PURGE-01); RLS on, own-row policies; the API route writes with the
-- service role scoped to the verified user id; no anon access. Same shape as strength_completions.

create table if not exists strength_lift_logs (
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  exercise_id  text not null check (length(exercise_id) between 1 and 64),
  load_kg      numeric(6, 2) check (load_kg is null or (load_kg > 0 and load_kg <= 500)),
  feel         text not null check (feel in ('easy', 'right', 'hard')),
  counts       boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (user_id, session_date, exercise_id)
);

alter table strength_lift_logs enable row level security;
revoke all on strength_lift_logs from anon;

create policy "strength_lift_logs select own" on strength_lift_logs
  for select using (auth.uid() = user_id);
create policy "strength_lift_logs insert own" on strength_lift_logs
  for insert with check (auth.uid() = user_id);
create policy "strength_lift_logs update own" on strength_lift_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strength_lift_logs delete own" on strength_lift_logs
  for delete using (auth.uid() = user_id);
