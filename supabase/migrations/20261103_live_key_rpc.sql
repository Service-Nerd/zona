-- CHECK-DB-LIVE-KEY-ARM-01 — read-only index introspection, so the live keys can be VERIFIED.
--
-- WHY THIS EXISTS, AND WHY A REPO-SIDE TEST IS NOT ENOUGH.
-- The five `%_live_key` PARTIAL unique indexes are the write side of
-- PLAN-WEEK-COLLISION-01: with them, a new plan's week-1 row inserts beside its superseded
-- history; without them — or with one rebuilt minus its `WHERE superseded_at IS NULL` — every
-- week-keyed write silently lands on a tombstone again. The write succeeds, every read
-- excludes the row, and nothing errors. That cost weeks of invisibility twice:
-- COMPLETION-TOMBSTONE-01 (2026-09-23) and WEEKLY-REPORT-SUPERSEDED-WRITE-01 (2026-11-02).
--
-- `lib/supabase/liveKeyCoverage.test.ts` now gates the REPO: a week-keyed table added without
-- a live key, or an index declared without its predicate, fails `npm run verify`. It reads
-- migrations, so it cannot see production. An index dropped by hand in the Supabase dashboard
-- leaves it green, and that is the half this RPC exists for.
--
-- ⚠️ WHY AN RPC AND NOT THE OBVIOUS ROUTE. `check-db-drift.ts` prints "No SQL RPC available"
-- because there is no `exec_sql`; `.env.local` carries PostgREST credentials only, there is no
-- DSN, and `pg` is not a dependency — so the script cannot read `pg_indexes` at all. The
-- Supabase MCP can, but only while an agent is driving it, which is the opposite of a check.
-- The repo's own answer to this is already written twice: `schema_columns_named` and
-- `user_fk_delete_rules`. This is the third, same shape.
--
-- THE AUTHORITY HAS TO BE THE SCHEMA (check-db-drift.ts's own header). This returns every
-- unique index and constraint on the public schema that is keyed on `week_n`, with its
-- predicate, so the caller can assert both halves — the partial index present AND the plain
-- constraint gone — without a list in the codebase to go stale.
--
-- SECURITY. `security invoker` so the caller's own privileges apply, execute granted to
-- service_role only, anon/authenticated revoked explicitly rather than left to default grants.

create or replace function public.week_key_uniqueness()
returns table (
  table_name  text,
  index_name  text,
  kind        text,   -- 'index' (a bare unique index) | 'constraint' (a table constraint)
  columns     text,
  predicate   text    -- the index's WHERE clause, or null when it has none
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    tbl.relname::text as table_name,
    idx.relname::text as index_name,
    case when con.oid is null then 'index' else 'constraint' end::text as kind,
    (
      select string_agg(a.attname, ',' order by k.ord)
      from unnest(ix.indkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = tbl.oid and a.attnum = k.attnum
    )::text as columns,
    pg_get_expr(ix.indpred, ix.indrelid)::text as predicate
  from pg_index ix
  join pg_class     idx on idx.oid = ix.indexrelid
  join pg_class     tbl on tbl.oid = ix.indrelid
  join pg_namespace ns  on ns.oid  = tbl.relnamespace
  -- A unique index may or may not be backed by a table constraint; both matter, and which
  -- one it is decides whether it BLOCKS a new plan's insert or merely scopes it.
  left join pg_constraint con
         on con.conindid = ix.indexrelid and con.contype = 'u'
  where ns.nspname = 'public'
    and ix.indisunique
    -- Keyed on week_n: the only indexes this question is about. Derived from the index's own
    -- columns, never from a table list.
    and exists (
      select 1
      from unnest(ix.indkey) as k(attnum)
      join pg_attribute a on a.attrelid = tbl.oid and a.attnum = k.attnum
      where a.attname = 'week_n'
    )
$$;

revoke all on function public.week_key_uniqueness() from public;
revoke all on function public.week_key_uniqueness() from anon;
revoke all on function public.week_key_uniqueness() from authenticated;
grant execute on function public.week_key_uniqueness() to service_role;

comment on function public.week_key_uniqueness() is
  'CHECK-DB-LIVE-KEY-ARM-01 — read-only lookup of every public-schema unique index/constraint keyed on week_n, with its partial predicate. Lets check-db-drift.ts verify the PLAN-WEEK-COLLISION-01 live keys exist AND that no plain unique survives. service_role only.';

-- ── VERIFICATION, to run after applying ────────────────────────────────────────────────
--   select table_name, index_name, kind, columns, predicate
--     from public.week_key_uniqueness() order by table_name;
--
--   EXPECT 5 rows, all kind='index', every predicate '(superseded_at IS NULL)':
--     session_completions_live_key       user_id,week_n,session_day
--     session_metric_overrides_live_key  user_id,week_n,session_key
--     session_overrides_live_key         user_id,week_n,original_day
--     session_reflections_live_key       user_id,week_n,session_day
--     weekly_reports_live_key            user_id,week_n
--
--   ANY row with kind='constraint', or any null predicate, is the defect: that key blocks a
--   new plan's insert and sends the write back onto the superseded row.
