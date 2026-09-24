-- COMPLETION-CLAIM-NOLOG-01 — the auto-link claim logged a caught 23505.
--
-- ── THE NOISE ──────────────────────────────────────────────────────────────
-- `claimAutoLink` (lib/coaching/autoAnalyse.ts) claims a linked run ATOMICALLY:
-- it INSERTs a completion row and lets the unique index elect exactly one
-- winner across the concurrent ingests that fire on app-open (foreground sync
-- + HealthKit observer + boot/resume). The loser caught Postgres error 23505
-- and branched to "attach onto the existing stub".
--
-- That catch is correct, but Postgres logs EVERY unique violation at ERROR
-- level in the database log even when the client swallows it. So every routine
-- auto-link left a `duplicate key value violates unique constraint
-- session_completions_live_key` line — a benign error that reads exactly like a
-- real one and gets re-questioned each time it appears. COMPLETION-TOMBSTONE-01
-- (2026-09-23) renamed the arbiter, which is why 7 weeks of the same benign
-- noise looked like a fresh regression.
--
-- ── THE FIX: DON'T RAISE THE VIOLATION AT ALL ──────────────────────────────
-- `ON CONFLICT ... DO NOTHING` is just as atomic as the bare INSERT — exactly
-- one concurrent caller inserts, the rest insert nothing — but it resolves the
-- conflict instead of raising it, so nothing reaches the log. The caller learns
-- who won from whether a row came back, not from an error code.
--
-- ⚠️ AN RPC IS REQUIRED, NOT PREFERRED — the same reason
-- `upsert_session_completion` is an RPC. PostgREST's `.upsert(..., {
-- ignoreDuplicates: true })` emits `ON CONFLICT (cols) DO NOTHING` with no
-- predicate, and Postgres will not match that to the PARTIAL live index. Only
-- hand-written SQL can carry the index's `WHERE superseded_at IS NULL`.
--
-- ⚠️ NOT the same RPC as `upsert_session_completion`. That one does DO UPDATE
-- (this must NOT clobber an existing row) and derives `user_id` from
-- `auth.uid()`. This path is the Strava-webhook / HealthKit-ingest server call
-- running as SERVICE ROLE, where `auth.uid()` is null and `user_id` is a
-- trusted value from the matched activity. So `user_id` comes from the payload
-- and EXECUTE is locked to service_role — a client cannot reach this function
-- and therefore cannot write another runner's row through it.

begin;

create or replace function public.claim_session_completion(p jsonb)
returns boolean               -- true = this call inserted the live row ('won'); false = a live row already existed (caller runs the attach branch)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $fn$
declare inserted_id bigint;
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
  'COMPLETION-CLAIM-NOLOG-01 — atomic auto-link claim against the partial live index via ON CONFLICT DO NOTHING, so a losing concurrent ingest resolves instead of raising a logged 23505. Returns true iff this call inserted. Service-role only.';

-- Server-side ingest paths only. A client must never call this — it trusts the
-- payload's user_id.
revoke execute on function public.claim_session_completion(jsonb) from public;
revoke execute on function public.claim_session_completion(jsonb) from anon;
revoke execute on function public.claim_session_completion(jsonb) from authenticated;
grant execute on function public.claim_session_completion(jsonb) to service_role;

commit;
