-- COMPLETION-CLAIM-UUID-01 (2026-10-07) — the auto-link claim could never succeed.
--
-- 🔴 `20260924_claim_completion_no_log.sql` declared `inserted_id bigint` and ended
-- `returning id into inserted_id`. `session_completions.id` is a **uuid**. So the
-- INSERT succeeded, the assignment into a bigint threw, and the whole function
-- aborted — rolling the insert back. The function could never return true.
--
-- MEASURED FROM PRODUCTION LOGS, 2026-10-07:
--   [auto-analyse] claimAutoLink claim failed
--   invalid input syntax for type bigint: "18e6676a-cb23-47c9-ade3-4819a08bb24a"
-- Twenty occurrences in two minutes, each uuid different because each is the
-- `gen_random_uuid()` id of the row it had just created and was about to discard.
--
-- ⚠️ CONSEQUENCE: NO AUTO-LINK WROTE A COMPLETION FOR ANY USER FROM 2026-09-24
-- UNTIL THIS FIX. Every completion created in that window carries a runner-entered
-- RPE or says "Manual log" — they all came from the picker, which writes directly
-- and never touches this function.
--
-- ⚠️ WHY IT HID FOR TWO WEEKS. `20260924`'s own comment says it replaced a working
-- `.insert()` + catch-23505 **because that logged an ERROR on every routine
-- auto-link**. The replacement ALSO logs on every auto-link, so the new symptom was
-- indistinguishable from the noise it was built to remove. And `claimAutoLink`
-- converts the failure to `'exists'` — "someone already linked it" — which is the
-- one return value that makes doing nothing look correct.
--
-- ⚠️ IT WAS ONLY FOUND BECAUSE A DIFFERENT FIX LANDED. Until
-- `AUTOLINK-OVERRIDE-BLIND-01` taught the matcher to respect a moved session,
-- `bestDay` was null for the founder and the function was never reached.
--
-- The ONLY change below is `bigint` → `uuid`. Everything else is `20260924` verbatim.
-- Gate: `lib/contracts/migrationPlpgsqlTypes.test.ts`.

create or replace function public.claim_session_completion(p jsonb)
returns boolean               -- true = this call inserted the live row ('won'); false = a live row already existed (caller runs the attach branch)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $fn$
declare inserted_id uuid;     -- 🔴 was `bigint`; session_completions.id is uuid
begin
  insert into public.session_completions as sc (
    user_id, week_n, session_day, status, skip_reason, rpe, fatigue_tag,
    coaching_flag, avg_hr, strava_activity_id, strava_activity_name,
    strava_activity_km, apple_health_uuid, updated_at
  ) values (
    (p->>'user_id')::uuid,
    (p->>'week_n')::int,
    p->>'session_day',
    p->>'status',
    p->>'skip_reason',
    (p->>'rpe')::int,
    p->>'fatigue_tag',
    p->>'coaching_flag',
    (p->>'avg_hr')::int,
    (p->>'strava_activity_id')::bigint,
    p->>'strava_activity_name',
    (p->>'strava_activity_km')::numeric,
    p->>'apple_health_uuid',
    coalesce((p->>'updated_at')::timestamptz, now())
  )
  on conflict (user_id, week_n, session_day) where superseded_at is null
  do nothing
  returning id into inserted_id;

  return inserted_id is not null;
end
$fn$;

comment on function public.claim_session_completion(jsonb) is
  'Atomic auto-link claim. Returns true when THIS call inserted the live completion row. COMPLETION-CLAIM-UUID-01: inserted_id is uuid, matching session_completions.id — it was bigint and the function could never succeed.';

revoke execute on function public.claim_session_completion(jsonb) from public;
