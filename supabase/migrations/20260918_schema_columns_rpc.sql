-- OPS-DBCHECK-NOISE-01 — a read-only column introspection RPC.
--
-- WHY. `scripts/check-db-drift.ts` answers "which tables carry `week_n`?" by
-- ATTEMPTING A SELECT ON EACH AND SEEING WHETHER IT FAILS. Two costs:
--
--   1. NOISE. A healthy run writes 21 Postgres 42703 errors and 22 HTTP 400s
--      into the log view. A dashboard that shows 40+ red lines after every
--      clean check trains you to scroll past red.
--
--   2. THE ONE THAT MATTERS. Probing "each known table" means the candidate set
--      is three hand-written arrays in the repo. The script's own header says
--      "the authority has to be the SCHEMA" — because PLAN-WEEK-COLLISION-01
--      was caused by a list written from memory, and its first guard iterated
--      that same list. A NEW table carrying `week_n` that is in none of the
--      three arrays is invisible to a check written to find exactly that.
--
-- SECURITY. `security invoker` (the default), so the caller's own privileges
-- apply and `information_schema.columns` filters to what that role may already
-- see. Execute is granted to `service_role` only — the drift script holds the
-- service key and nothing else needs this. `anon` and `authenticated` are
-- revoked explicitly rather than left to default grants.

create or replace function public.schema_columns_named(col_names text[])
returns table (table_name text, column_name text)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select c.table_name::text, c.column_name::text
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.column_name = any(col_names)
$$;

revoke all on function public.schema_columns_named(text[]) from public;
revoke all on function public.schema_columns_named(text[]) from anon;
revoke all on function public.schema_columns_named(text[]) from authenticated;
grant execute on function public.schema_columns_named(text[]) to service_role;

comment on function public.schema_columns_named(text[]) is
  'OPS-DBCHECK-NOISE-01 — read-only public-schema column lookup for check-db-drift.ts. service_role only.';
