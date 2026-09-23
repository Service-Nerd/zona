-- DB-USER-PURGE-01 — account deletion becomes complete by CONSTRUCTION.
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────────
-- `/api/delete-account` deleted THREE tables (session_completions,
-- subscriptions, user_settings) and then called auth.admin.deleteUser(). The
-- public schema carried exactly ONE foreign key of any kind
-- (charity_codes -> charity_batches) and NONE to auth.users, so there was no
-- cascade behind the route. Twenty-one further tables holding run history,
-- health samples, run analyses, plans, adjustments and notifications were left
-- keyed to a user id that no longer resolved: unreachable, unattributable, and
-- undeletable through any product surface.
--
-- Three places asserted the opposite, which is why it survived:
--   · supersedeCoverage.test.ts exempts the route because it "deletes every row
--     for the user regardless of plan"
--   · the Me screen promises "sessions, plan, and profile will be permanently
--     removed" (`plans` was not deleted)
--   · app/privacy/page.tsx promises deletion "removes all associated data",
--     which is a GDPR Art.17 / CCPA erasure claim, not a nicety.
--
-- Measured before this ran: 0 orphan rows across all 23 user-keyed tables. The
-- defect was LATENT — nobody had completed the flow carrying data. There is no
-- cleanup backlog, only a hole to close.
--
-- ── WHY FKs AND NOT A LONGER DELETE LIST ───────────────────────────────────
-- A 24-statement delete list in a route is correct on the day it is written and
-- wrong on the day someone adds table 25. This repo has recorded that class
-- enough times to name it: a rule that holds only while someone remembers is
-- not a rule. WEEK_KEYED_TABLES shipped WRONG ON ITS FIRST WRITE for exactly
-- this reason.
--
-- So the authority moves to the schema. With ON DELETE CASCADE in place,
-- `auth.admin.deleteUser(uid)` is complete BY CONSTRUCTION: the route cannot
-- forget a table, because the route no longer names any. A new table gets its
-- FK in its own CREATE TABLE, and `npm run check:db` fails the run if it
-- does not.
--
-- ── THE THREE CASES AN FK CANNOT EXPRESS ───────────────────────────────────
-- Handled by the BEFORE DELETE trigger below, because each is keyed on
-- something that is not a user_id column:
--   1. ai_rate_limits  — keyed 'ai:<surface>:<uuid>' in a TEXT column.
--   2. charity_codes   — the code belongs to the BATCH, not the runner. It is
--                        RELEASED back to the pool, never deleted. The FK nulls
--                        claimed_by; claimed_at has to go with it or the code
--                        reads as "claimed by nobody" and the cap stays spent.
--   3. waitlist        — keyed on email. Erasure means erasure.
--
-- ── THE ONE DELIBERATE NON-CASCADE ─────────────────────────────────────────
-- ops_events is SET NULL, not CASCADE. It carries the AI spend ledger that
-- GET /api/ops/ai-spend reads (OPS-AI-OWNER-01). Nulling user_id anonymises the
-- row, which satisfies erasure, while keeping the cost history that the account
-- genuinely incurred. Deleting it would silently rewrite what we spent.
-- Its user_id is already nullable, so this needs no column change.
--
-- ── BLAST RADIUS ───────────────────────────────────────────────────────────
-- An INSERT carrying a user_id that is not in auth.users now ERRORS where it
-- previously succeeded and orphaned. That is the intended behaviour change and
-- the reason the orphan count was measured first (it was 0, so nothing existing
-- violates the new constraints).

begin;

-- ── 1. CASCADE: every table whose rows exist only to serve one runner ───────
--
-- The array IS the list; a loop keeps it auditable in one place and makes the
-- migration idempotent. `check:db` verifies coverage against the LIVE schema
-- afterwards, so this array is the application, never the authority.
do $$
declare
  t text;
  cascade_tables text[] := array[
    'analytics_events', 'daily_coach_notes', 'free_insights',
    'health_daily_samples', 'notifications', 'phase_summaries',
    'plan_adjustments', 'plan_archive', 'plan_weekly_notes', 'plans',
    'post_race_reshapes', 'push_subscriptions', 'race_readiness_notes',
    'run_analysis', 'session_completions', 'session_metric_overrides',
    'session_overrides', 'session_reflections', 'strava_activities',
    'subscriptions', 'weekly_reports'
  ];
begin
  foreach t in array cascade_tables loop
    execute format(
      'alter table public.%I drop constraint if exists %I',
      t, t || '_user_id_fkey');
    execute format(
      'alter table public.%I add constraint %I
         foreign key (user_id) references auth.users(id) on delete cascade',
      t, t || '_user_id_fkey');
  end loop;
end $$;

-- user_settings is keyed on `id`, not `user_id` — it IS the profile row.
alter table public.user_settings
  drop constraint if exists user_settings_id_fkey;
alter table public.user_settings
  add constraint user_settings_id_fkey
  foreign key (id) references auth.users(id) on delete cascade;

-- ── 2. SET NULL: rows that outlive the account, anonymised ──────────────────
alter table public.ops_events
  drop constraint if exists ops_events_user_id_fkey;
alter table public.ops_events
  add constraint ops_events_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete set null;

alter table public.charity_codes
  drop constraint if exists charity_codes_claimed_by_fkey;
alter table public.charity_codes
  add constraint charity_codes_claimed_by_fkey
  foreign key (claimed_by) references auth.users(id) on delete set null;

-- ── 3. The side channels no FK can reach ────────────────────────────────────
--
-- SECURITY DEFINER because the trigger runs as supabase_auth_admin, which has
-- no rights on the public schema. search_path is pinned, so the function cannot
-- be redirected at a shadowing table.
create or replace function public.purge_user_side_channels()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- 'ai:<surface>:<uuid>' in a text column — nothing for an FK to hold onto.
  delete from public.ai_rate_limits
   where bucket_key like '%:' || old.id::text;

  -- Release the code, do not consume it. The FK nulls claimed_by on the delete
  -- that follows this trigger; claimed_at must be cleared here or the row reads
  -- as claimed by nobody and the batch cap stays spent on a runner who is gone.
  update public.charity_codes
     set claimed_at = null
   where claimed_by = old.id;

  -- Email-keyed, so no FK reaches it. Deleting the account and then mailing the
  -- address about the launch is the failure this prevents.
  if old.email is not null then
    delete from public.waitlist where lower(email) = lower(old.email);
  end if;

  return old;
end;
$$;

revoke all on function public.purge_user_side_channels() from public;

drop trigger if exists on_auth_user_deleted on auth.users;
create trigger on_auth_user_deleted
  before delete on auth.users
  for each row execute function public.purge_user_side_channels();

comment on function public.purge_user_side_channels() is
  'DB-USER-PURGE-01 — clears the three user-scoped stores no FK to auth.users can reach: ai_rate_limits (text bucket key), charity_codes.claimed_at (released, not deleted), waitlist (email-keyed).';

commit;
