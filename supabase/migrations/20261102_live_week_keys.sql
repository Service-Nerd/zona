-- WEEKLY-REPORT-SUPERSEDED-WRITE-01 — three more writes landed on a superseded row and
-- inherited its tombstone. COMPLETION-TOMBSTONE-01's twins, found by sweeping for the
-- SHAPE of that fix rather than for its symptom.
--
-- ── THE DEFECT, three facts each correct alone ─────────────────────────────────────
--   1. The unique key is `(user_id, week_n[, ...])` — NOT plan-scoped, NOT partial.
--   2. Every read filters `superseded_at IS NULL` (PLAN-WEEK-COLLISION-01).
--   3. The write is a PostgREST `.upsert()` on that same key and never avoids the stamp.
--
-- `week_n` is a WITHIN-PLAN coordinate (ADR-013). Start a new plan and the numbering
-- restarts at 1, so writing week 1 collides with the PREVIOUS plan's week-1 row, updates
-- it in place, and inherits `superseded_at`. The write succeeds, every read excludes it,
-- nothing errors and nothing is logged.
--
-- ⚠️ THE DAMAGE RUNS BOTH WAYS, which is why "clear the stamp on write" is not the fix:
-- the live row is MISSING (the runner's report is gone) and the archived plan's row is
-- OVERWRITTEN (its history is gone). Superseding exists to keep the second.
--
-- ── MEASURED IN PRODUCTION, 2026-11-02, before this migration ──────────────────────
--   weekly_reports           30 rows | 14 live | 16 superseded | 1 GHOST WRITE
--     └─ user 1afc17e4 week 1: superseded 2026-10-18, rewritten 2026-10-25. That
--        runner's live week-1 report does not exist, and the May plan's week-1
--        narrative was replaced by the new plan's ("Two done, one to go.").
--   session_reflections       8 rows |  0 live |  8 superseded | 0 — LATENT
--     └─ zero live rows, so the next reflection on a re-used (week, day) is the loss.
--   session_metric_overrides 23 rows | 10 live | 13 superseded | 0 — LATENT
--
-- ⚠️ COMPLETION-TOMBSTONE-01 FIXED THE FOURTH TABLE AND LEFT THESE THREE. That is the
-- most-recorded survival class in this repo — "the remedy was applied to ONE TWIN",
-- eight instances, three of them in a single day. The remedy there was a MECHANISM
-- (make LIVE the unique one), and a mechanism has to be swept for.
--
-- ── THE FIX: MAKE **LIVE** THE UNIQUE ONE ──────────────────────────────────────────
-- Each constraint asserted "one row per user/week/..., forever". The truth is "at most
-- one LIVE row per user/week/..., and any number of superseded ones". Encoding that
-- makes the collision impossible rather than recoverable: a new plan's write INSERTS,
-- history survives, and no field can be inherited across plans because no row is shared
-- across plans. Same shape as `session_completions_live_key` (20260923) and
-- `session_overrides_live_key` (20261018), so all five week-keyed tables now agree.
--
-- ⚠️ NO RPC HERE, and the difference from COMPLETION-TOMBSTONE-01 is deliberate. That
-- fix needed one because it had EIGHT call sites and a key-present/key-omitted merge
-- contract that only hand-written SQL could express. These three have single owners and
-- write whole rows, so `lib/supabase/liveRowWrite.ts` reads the live row's id and
-- UPDATEs by primary key — which cannot touch a tombstone by construction, and needs no
-- `ON CONFLICT` predicate at all. The partial indexes below are what stop a concurrent
-- double-insert.

begin;

-- 1. The new truth. Partial, so superseded rows are exempt and history stacks.
--    Created BEFORE the old constraints are dropped: each old one is strictly stronger,
--    so these cannot fail on existing data.
create unique index if not exists weekly_reports_live_key
  on public.weekly_reports (user_id, week_n)
  where superseded_at is null;

create unique index if not exists session_reflections_live_key
  on public.session_reflections (user_id, week_n, session_day)
  where superseded_at is null;

create unique index if not exists session_metric_overrides_live_key
  on public.session_metric_overrides (user_id, week_n, session_key)
  where superseded_at is null;

-- 2. The old, too-strong constraints. Dropping them is what allows a new plan to insert
--    its own week-1 row beside the superseded one. Names are Postgres's defaults for a
--    table-level UNIQUE(...), as created by 20260425_weekly_reports.sql,
--    20260522_session_reflections.sql and 20260810_session_metric_overrides.sql.
alter table public.weekly_reports
  drop constraint if exists weekly_reports_user_id_week_n_key;

alter table public.session_reflections
  drop constraint if exists session_reflections_user_id_week_n_session_day_key;

alter table public.session_metric_overrides
  drop constraint if exists session_metric_overrides_user_id_week_n_session_key_key;

comment on index public.weekly_reports_live_key is
  'WEEKLY-REPORT-SUPERSEDED-WRITE-01 — at most one LIVE weekly report per (user, week). Superseded rows are exempt so a new plan inserts beside its history rather than overwriting it.';
comment on index public.session_reflections_live_key is
  'WEEKLY-REPORT-SUPERSEDED-WRITE-01 — at most one LIVE reflection per (user, week, day). COMPLETION-TOMBSTONE-01''s twin.';
comment on index public.session_metric_overrides_live_key is
  'WEEKLY-REPORT-SUPERSEDED-WRITE-01 — at most one LIVE metric override per (user, week, session_key). COMPLETION-TOMBSTONE-01''s twin.';

commit;

-- ── VERIFICATION, to run after applying ────────────────────────────────────────────
-- Both halves matter: the new index present AND the old constraint gone. A predicate
-- that answers the same thing in both states is not a check (recorded 2026-09-24, when
-- one nearly caused a good migration to be reported as failed).
--
--   select indexname from pg_indexes
--    where schemaname = 'public' and indexname like '%_live_key' order by 1;
--   -- EXPECT 5 rows: session_completions, session_metric_overrides, session_overrides,
--   --               session_reflections, weekly_reports.
--   -- Before this migration: 2 (session_completions, session_overrides).
--
--   select conname from pg_constraint
--    where conrelid in ('public.weekly_reports'::regclass,
--                       'public.session_reflections'::regclass,
--                       'public.session_metric_overrides'::regclass)
--      and contype = 'u';
--   -- EXPECT 0 rows. Before this migration: 3.
