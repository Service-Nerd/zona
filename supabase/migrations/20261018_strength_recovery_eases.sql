-- STRENGTH-RECOVERY-01 (S13; Design Board 2026-10-18) -- the runner's answer to a recovery ease on strength.
--
-- Keyed by calendar date: { "2026-10-19": "eased" | "declined" }. "eased" means the runner tapped
-- "Ease the session"; the strength route then serves that day's session through easeForRecovery.
-- "declined" means they tapped "Lift as planned" / "Run it anyway", so the card is not offered again.
--
-- A COLUMN on strength_plans, not a table, deliberately: the strength plan is regenerated whenever the
-- run plan changes, and that upsert writes only plan_json / profile_json / run_context_sig /
-- generated_at, so an answer stored here survives a regeneration. It is user-scoped already
-- (strength_plans cascades with the account, DB-USER-PURGE-01) and inherits its RLS.
--
-- Additive: existing rows get '{}'. Reads tolerate the column being absent until this is applied.

alter table public.strength_plans
  add column if not exists recovery_eases jsonb not null default '{}'::jsonb;
