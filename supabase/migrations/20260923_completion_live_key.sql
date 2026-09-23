-- COMPLETION-TOMBSTONE-01 — a completion write landed on a superseded row and
-- inherited its tombstone.
--
-- ── THE DEFECT ─────────────────────────────────────────────────────────────
-- Three facts, each correct alone:
--
--   1. The unique key is `(user_id, week_n, session_day)` — NOT plan-scoped.
--   2. Every read filters `superseded_at IS NULL` (PLAN-WEEK-COLLISION-01).
--   3. All 8 writes upsert with `onConflict: 'user_id,week_n,session_day'`
--      and none of them clears `superseded_at`.
--
-- `week_n` is a WITHIN-PLAN coordinate (ADR-013). Start a new plan and the
-- numbering restarts at 1, so completing week 1 collides with the PREVIOUS
-- plan's week 1 row, updates it in place, and inherits the stamp. The write
-- succeeds, the read excludes it, nothing errors, nothing is logged.
--
-- 🔴 **PLAN-WEEK-COLLISION-01 FIXED THE READ SIDE AND LEFT THE WRITE SIDE
-- COLLIDING.** The stamp correctly hides the old plan's rows; nothing cleared
-- it when the NEW plan re-used the key. Same hazard, the other direction —
-- which is the "solved for one transition, named but not solved for its twin"
-- class this repo already records against ADR-013.
--
-- ── AND IT MERGED TWO PLANS' DATA ──────────────────────────────────────────
-- The skip write sets only `status`, `skip_reason`, `updated_at`. Everything
-- else is INHERITED. Measured on the founder's own row: a session skipped today
-- for `Injury / illness` carrying `rpe = 3` and `coaching_flag = 'ok'` from
-- April — a false signal into the §fatigue triggers and the reframe risk gate.
--
-- MEASURED BLAST RADIUS BEFORE THE FIX: 150 superseded rows, 1 user, 2 ghost
-- writes. Only one person has regenerated a plan since the stamp shipped on
-- 2026-09-17, so this was a LIVE LANDMINE rather than a live outage — it hits
-- every runner who uses "Start a new plan".
--
-- ── THE FIX: MAKE **LIVE** THE UNIQUE ONE ──────────────────────────────────
-- The constraint asserted "one completion per user/week/day, forever". The
-- truth is "at most one LIVE completion per user/week/day, and any number of
-- superseded ones". Encoding that makes the collision impossible rather than
-- recoverable: a new plan's write now INSERTS, history survives, and no field
-- can be inherited across plans because no row is shared across plans.
--
-- ⚠️ NOT "clear the stamp on write", which was the cheap fix. It would have
-- left the data merge intact AND overwritten the old plan's history — the very
-- thing superseding exists to keep.

begin;

-- 1. The new truth. Partial, so superseded rows are exempt and history stacks.
--    Created BEFORE the old constraint is dropped: the old one is strictly
--    stronger, so this cannot fail on existing data.
create unique index if not exists session_completions_live_key
  on public.session_completions (user_id, week_n, session_day)
  where superseded_at is null;

-- 2. The old, too-strong constraint. Dropping it is what allows a new plan to
--    insert its own week-1 row beside the superseded one.
alter table public.session_completions
  drop constraint if exists session_completions_user_id_week_n_session_day_key;

comment on index public.session_completions_live_key is
  'COMPLETION-TOMBSTONE-01 — at most one LIVE completion per (user, week, day). Superseded rows are exempt so a new plan inserts beside its history rather than overwriting it.';

-- 3. The write, atomically, against the partial index.
--
-- ⚠️ AN RPC IS REQUIRED, NOT PREFERRED. PostgREST's `.upsert()` emits
-- `ON CONFLICT (cols) DO UPDATE` with no predicate, and Postgres will not match
-- that to a PARTIAL index. The conflict target has to carry the index's own
-- `WHERE superseded_at IS NULL`, which only hand-written SQL can express.
--
-- ⚠️ `p ? 'key'` (KEY PRESENT) IS NOT `p->>'key' IS NOT NULL` (VALUE NON-NULL),
-- and the difference is load-bearing. `saveReflect` legitimately writes
-- `rpe: null` to CLEAR an RPE. A `coalesce(excluded.rpe, sc.rpe)` would keep the
-- old value and make clearing impossible — a new silent defect in the fix for a
-- silent defect. Key-present means "the caller addressed this column".
--
-- SECURITY INVOKER so RLS applies, and `user_id` comes from `auth.uid()` rather
-- than the payload, so a client cannot write another runner's row.
create or replace function public.upsert_session_completion(p jsonb)
returns public.session_completions
language plpgsql
security invoker
set search_path = pg_catalog, public
as $fn$
declare r public.session_completions;
begin
  if auth.uid() is null then
    raise exception 'upsert_session_completion requires an authenticated caller';
  end if;

  insert into public.session_completions as sc (
    user_id, week_n, session_day, status, skip_reason, rpe, fatigue_tag,
    coaching_flag, avg_hr, strava_activity_id, strava_activity_name,
    strava_activity_km, apple_health_uuid, updated_at
  ) values (
    auth.uid(),
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
    now()
  )
  on conflict (user_id, week_n, session_day) where superseded_at is null
  do update set
    status               = case when p ? 'status'               then excluded.status               else sc.status               end,
    skip_reason          = case when p ? 'skip_reason'          then excluded.skip_reason          else sc.skip_reason          end,
    rpe                  = case when p ? 'rpe'                  then excluded.rpe                  else sc.rpe                  end,
    fatigue_tag          = case when p ? 'fatigue_tag'          then excluded.fatigue_tag          else sc.fatigue_tag          end,
    coaching_flag        = case when p ? 'coaching_flag'        then excluded.coaching_flag        else sc.coaching_flag        end,
    avg_hr               = case when p ? 'avg_hr'               then excluded.avg_hr               else sc.avg_hr               end,
    strava_activity_id   = case when p ? 'strava_activity_id'   then excluded.strava_activity_id   else sc.strava_activity_id   end,
    strava_activity_name = case when p ? 'strava_activity_name' then excluded.strava_activity_name else sc.strava_activity_name end,
    strava_activity_km   = case when p ? 'strava_activity_km'   then excluded.strava_activity_km   else sc.strava_activity_km   end,
    apple_health_uuid    = case when p ? 'apple_health_uuid'    then excluded.apple_health_uuid    else sc.apple_health_uuid    end,
    updated_at           = now()
  returning * into r;

  return r;
end
$fn$;

comment on function public.upsert_session_completion(jsonb) is
  'COMPLETION-TOMBSTONE-01 — the single owner of writing a session completion. Targets the PARTIAL live index, which PostgREST cannot express, so a new plan inserts beside its superseded history instead of inheriting it.';

commit;
