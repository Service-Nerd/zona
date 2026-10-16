-- STRENGTH-ENGINE-01 (ADR-024 §7) -- the strength engine's own store.
--
-- Its OWN table, not a slot inside the run plan: a strength plan inside plan_json
-- is one the standalone app cannot own (supersedes "Supplementary session slots").
-- One row per runner; regenerating replaces it.
--
-- Security:
--   * ON DELETE CASCADE to auth.users -- account deletion IS the deletion (DB-USER-PURGE-01).
--   * RLS on, own-row policies only. The API route writes with the service role,
--     scoped by the verified JWT's user id; the policies are defence in depth for
--     any future client-side read.
--   * No anon access.
--
-- run_context_sig is a sha256 of the RunContext the plan was placed around, so the
-- app can tell when the run plan (or a move/swap) has changed under it.
-- strength_completions (per-set logs) lands with Phase 2, when something writes it.

create table if not exists strength_plans (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  plan_json       jsonb not null,
  profile_json    jsonb not null,
  run_context_sig text,
  generated_at    timestamptz not null default now()
);

alter table strength_plans enable row level security;
revoke all on strength_plans from anon;

create policy "strength_plans select own" on strength_plans
  for select using (auth.uid() = user_id);
create policy "strength_plans insert own" on strength_plans
  for insert with check (auth.uid() = user_id);
create policy "strength_plans update own" on strength_plans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strength_plans delete own" on strength_plans
  for delete using (auth.uid() = user_id);
