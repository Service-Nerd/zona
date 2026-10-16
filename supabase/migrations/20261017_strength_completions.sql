-- STRENGTH-ENGINE-01 Phase 2 (Design Board STRENGTH-APP-01) -- did the runner do it?
--
-- Done or skipped ONLY. The board ruled out RPE and per-set logging until Phase 4
-- reads them: a question nothing reads is decorative. One row per runner per
-- calendar date (one strength session a day, S3). Deleting the row is "undo".
--
-- Security: cascade with the account; RLS on, own-row policies; the API route
-- writes with the service role scoped to the verified user id; no anon access.

create table if not exists strength_completions (
  user_id      uuid not null references auth.users(id) on delete cascade,
  session_date date not null,
  status       text not null check (status in ('done', 'skipped')),
  updated_at   timestamptz not null default now(),
  primary key (user_id, session_date)
);

alter table strength_completions enable row level security;
revoke all on strength_completions from anon;

create policy "strength_completions select own" on strength_completions
  for select using (auth.uid() = user_id);
create policy "strength_completions insert own" on strength_completions
  for insert with check (auth.uid() = user_id);
create policy "strength_completions update own" on strength_completions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strength_completions delete own" on strength_completions
  for delete using (auth.uid() = user_id);
