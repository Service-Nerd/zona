-- ACT-FUNNEL-01 — the ACTIVATION half of the funnel, which has never been observable.
--
-- 🔴 WHY. `OPS-FUNNEL-01` (2026-09-28) instrumented the CONVERSION half: `upgrade_view`,
-- `upgrade_purchase_attempt`, `upgrade_purchase_result`. Those are live and populated. The half
-- before them — signed up → HealthKit connected → first run imported → **first run read** — has
-- no events and no view, so a 0% trial-to-paid reading cannot distinguish "they never saw the
-- value" from "they saw it and declined".
--
-- 📐 MEASURED 2026-11-11. A read REQUIRES a matched plan session (`run_analysis` is keyed
-- `(user_id, week_n, session_day, …)`). Across the 37 trialists in the metric population:
--   · 10 had no plan live during their trial at all;
--   · of the 27 who did, **14 (51.9%) had EVERY live version starting after their trial ended**;
--   · so **24 of 37 (64.9%) had no trainable plan week inside their trial**, worst gap 242 days;
--   · and **exactly 1 of 37 has ever had a run read during their trial**.
--
-- 🔴 AND THE FIRST CUT OF THIS VIEW MEASURED THAT AGAINST THE WRONG TABLE. `plans` holds ONE row
-- per user, upserted — it is a snapshot, not a history. Reading it answers "where does this
-- runner's plan start TODAY", and the question is "where did it start DURING THEIR TRIAL". Two of
-- the four runners first reported as having a plan that began after their trial actually had a
-- plan running inside it, and had regenerated weeks later; the headline moved 65.5% → 51.9%.
-- Found by code review, not by me. **`plan_archive` is the history, and this view now reads it.**
--
-- ⚠️ POPULATION: `v_metric_users`, never a re-derived `is_admin`/`is_internal` pair
-- (INTERNAL-ACCOUNTS-01's pattern; `lib/ops/metricViewExclusion.test.ts` enforces it).
--
-- ⚠️ "RUN READ" HAS ONE DEFINITION AND THIS IS IT: a `run_analysis` row with `superseded_at IS
-- NULL`. `lib/ops/runRead.ts` carries the same definition for TypeScript callers, and
-- `activationFunnel.test.ts` fails if the two drift. A superseded row belongs to a plan week that
-- was replaced; counting it would report reads the runner can no longer open.

create or replace view public.v_activation_funnel as
with plan_versions as (
  -- Every plan a runner has had, with the window it was LIVE for.
  -- An archived row is the plan that was in force until it was archived; `plan_archive` is
  -- written before every `savePlanForUser`, so the previous row's `archived_at` is this one's
  -- start, and the first one starts when the `plans` row was created.
  select pa.user_id,
         (select min((w.value->>'date')::date) from jsonb_array_elements(pa.plan_json->'weeks') w) as first_week,
         coalesce(
           lag(pa.archived_at) over (partition by pa.user_id order by pa.archived_at),
           (select p.created_at from plans p where p.user_id = pa.user_id)
         )                                                           as live_from,
         pa.archived_at                                              as live_to
  from plan_archive pa
  union all
  -- …and the one in force now.
  select p.user_id,
         (select min((w.value->>'date')::date) from jsonb_array_elements(p.plan_json->'weeks') w),
         coalesce((select max(pa.archived_at) from plan_archive pa where pa.user_id = p.user_id), p.created_at),
         'infinity'::timestamptz
  from plans p
)
select
  m.user_id,
  au.created_at                                   as signed_up_at,
  s.trial_started_at,
  -- ⚠️ 14 is `lib/trial.ts → TRIAL_DAYS`. SQL cannot import it, so the duplication is knowingly
  -- kept and `activationFunnel.test.ts` asserts the two agree (the D-16 mitigation used for
  -- `admin_user_tiers` vs `resolveTier`).
  (s.trial_started_at + interval '14 days')       as trial_ends_at,
  s.healthkit_connected_at,

  -- The plan the runner has NOW. Named `current_` because it is a snapshot and says nothing
  -- about the trial; the two columns below are the ones that answer the trial question.
  (select min((w.value->>'date')::date)
     from plans p, jsonb_array_elements(p.plan_json->'weeks') w
    where p.user_id = m.user_id)                  as current_plan_first_week,
  (select max((w.value->>'date')::date) + 6
     from plans p, jsonb_array_elements(p.plan_json->'weeks') w
    where p.user_id = m.user_id)                  as current_plan_last_day,

  -- Did any plan at all exist during the trial?
  exists (select 1 from plan_versions v
           where v.user_id = m.user_id and s.trial_started_at is not null
             and v.live_from <  s.trial_started_at + interval '14 days'
             and v.live_to   >  s.trial_started_at)
                                                  as had_live_plan_in_trial,

  -- 🔑 THE DOMINANT CAUSE, AS A BOOLEAN, FROM HISTORY. True when some plan version that was live
  -- during the trial had already begun by the time the trial ended — i.e. there was a session to
  -- match a run against. False is the runner for whom a read was IMPOSSIBLE.
  exists (select 1 from plan_versions v
           where v.user_id = m.user_id and s.trial_started_at is not null
             and v.live_from <  s.trial_started_at + interval '14 days'
             and v.live_to   >  s.trial_started_at
             and v.first_week <= (s.trial_started_at + interval '14 days')::date)
                                                  as trainable_week_in_trial,

  -- The earliest start any live-in-trial version offered, so the SIZE of the gap is readable.
  (select min(v.first_week) from plan_versions v
    where v.user_id = m.user_id and s.trial_started_at is not null
      and v.live_from <  s.trial_started_at + interval '14 days'
      and v.live_to   >  s.trial_started_at)      as earliest_plan_start_in_trial,

  (select min(a.start_date) from strava_activities a where a.user_id = m.user_id)
                                                  as first_activity_at,
  (select count(*) from strava_activities a where a.user_id = m.user_id)
                                                  as activities_total,
  (select count(*) from strava_activities a
     where a.user_id = m.user_id and s.trial_started_at is not null
       and a.start_date >= s.trial_started_at
       and a.start_date <  s.trial_started_at + interval '14 days')
                                                  as activities_in_trial,

  (select min(r.created_at) from run_analysis r
     where r.user_id = m.user_id and r.superseded_at is null)
                                                  as first_read_at,
  (select count(*) from run_analysis r
     where r.user_id = m.user_id and r.superseded_at is null)
                                                  as reads_total,
  (select count(*) from run_analysis r
     where r.user_id = m.user_id and r.superseded_at is null and s.trial_started_at is not null
       and r.created_at >= s.trial_started_at
       and r.created_at <  s.trial_started_at + interval '14 days')
                                                  as reads_in_trial,

  (select min(e.created_at) from analytics_events e
     where e.user_id = m.user_id and e.event = 'upgrade_view')
                                                  as first_paywall_view_at,
  (select min(e.created_at) from analytics_events e
     where e.user_id = m.user_id and e.event = 'upgrade_purchase_attempt')
                                                  as first_purchase_attempt_at,

  -- ⚠️ COMPED IS SEPARATED HERE, not merged into "subscribed". A Make-A-Wish redemption is a real
  -- customer and not a conversion; `v_trial_conversion.converted_real` already draws that line and
  -- this view must not blur it back. Measured 2026-11-11: 23 comped, 0 paid.
  (select min(b.created_at) from subscriptions b
     where b.user_id = m.user_id and not coalesce(b.is_comped, false))
                                                  as subscribed_at,
  exists (select 1 from subscriptions b
     where b.user_id = m.user_id and coalesce(b.is_comped, false))
                                                  as is_comped
from public.v_metric_users m
join public.user_settings s on s.id = m.user_id
join auth.users au          on au.id = m.user_id;

comment on view public.v_activation_funnel is
  'ACT-FUNNEL-01 — one row per metric user with each activation milestone. "Run read" = a '
  'run_analysis row with superseded_at IS NULL (see lib/ops/runRead.ts). trainable_week_in_trial '
  'is computed from PLAN HISTORY (plan_archive + plans), not the current plans row, because that '
  'table is a snapshot and the question is historical.';

-- It exposes user ids and nothing else identifying, but it is an ops surface and never client-read.
revoke all on public.v_activation_funnel from anon, authenticated;
grant select on public.v_activation_funnel to service_role;
