-- DB-USER-PURGE-01 — read-only FK introspection so the cascade can be VERIFIED.
--
-- WHY THIS EXISTS AND NOT A LIST IN THE REPO.
-- The cascade migration closes the hole. Nothing stops the NEXT table from
-- being created without the constraint, and the symptom of that is invisible:
-- rows quietly surviving a deletion that reported success. `check-db-drift.ts`
-- already answers "does the live schema still match what the repo believes",
-- and its own header states the rule this follows — THE AUTHORITY HAS TO BE THE
-- SCHEMA. `schema_columns_named` finds the user-scoped tables; this finds which
-- of them actually carry a delete rule to auth.users. Neither can be satisfied
-- by editing a list in the codebase, which is the whole point:
-- supersedeCoverage.test.ts was blind precisely because it iterated the array
-- it was guarding.
--
-- SECURITY. `security invoker` so the caller's own privileges apply, execute
-- granted to service_role only, anon/authenticated revoked explicitly rather
-- than left to default grants — same shape as schema_columns_named.

create or replace function public.user_fk_delete_rules()
returns table (table_name text, column_name text, delete_rule text)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select
    src.relname::text        as table_name,
    att.attname::text        as column_name,
    case con.confdeltype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'd' then 'SET DEFAULT'
      when 'r' then 'RESTRICT'
      when 'a' then 'NO ACTION'
    end::text                as delete_rule
  from pg_constraint con
  join pg_class     src on src.oid = con.conrelid
  join pg_namespace sn  on sn.oid  = src.relnamespace
  join pg_class     tgt on tgt.oid = con.confrelid
  join pg_namespace tn  on tn.oid  = tgt.relnamespace
  join lateral unnest(con.conkey) as k(attnum) on true
  join pg_attribute att on att.attrelid = src.oid and att.attnum = k.attnum
  where con.contype = 'f'
    and sn.nspname  = 'public'
    and tn.nspname  = 'auth'
    and tgt.relname = 'users'
$$;

revoke all on function public.user_fk_delete_rules() from public;
revoke all on function public.user_fk_delete_rules() from anon;
revoke all on function public.user_fk_delete_rules() from authenticated;
grant execute on function public.user_fk_delete_rules() to service_role;

comment on function public.user_fk_delete_rules() is
  'DB-USER-PURGE-01 — read-only lookup of public-schema foreign keys referencing auth.users, with their ON DELETE rule. For check-db-drift.ts. service_role only.';
