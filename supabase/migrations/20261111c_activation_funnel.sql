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

-- 🔴 DROP FIRST, AND THIS IS THE SECOND TIME TODAY. `create or replace view` may only APPEND
-- columns at the end; renaming `plan_first_week` → `current_plan_first_week` and removing
-- `plan_starts_after_trial` is a column-set change, so a replace raises `42P16` and the WHOLE FILE
-- applies nothing — grants and comment included. `20260920` documents that error code verbatim and
-- `INTERNAL-ACCOUNTS-01`'s review caught two instances of it this morning. Nothing depends on this
-- view yet, so the drop is free.
drop view if exists public.v_activation_funnel;

create view public.v_activation_funnel as
with plan_versions as (
  -- Every plan a runner has had, with the window it was LIVE for. An archived row is the plan
  -- that was in force until it was archived, so the previous row's `archived_at` is this one's
  -- start and the first one starts when the `plans` row was created.
  --
  -- ⚠️ AND THIS HISTORY IS INCOMPLETE, DELIBERATELY STATED. The first version of this comment
  -- claimed `plan_archive` is "written before every `savePlanForUser`". **It is not**, and code
  -- review caught the claim: `lib/plan.ts` archives only when `isRaceIdentityChange` is true or
  -- `calendarChangedWeeks` is non-empty. A same-race, same-calendar edit — the deferred foundation
  -- compose prepending weeks is the known one — changes the plan and leaves no archive row, so
  -- that change is attributed to the neighbouring window.
  -- 📐 Measured 2026-11-11: **6 of 37 trialists** have a `plans` row updated after their trial
  -- began with no archive row covering it, so their reconstruction could be off by one edit.
  -- It is still strictly better than the `plans` snapshot, which is wrong for ALL of them, and
  -- the gap is the two cases the archive deliberately ignores.
  select pa.user_id,
         (select min((w.value->>'date')::date) from jsonb_array_elements(pa.plan_json->'weeks') w) as first_week,
         (select max((w.value->>'date')::date) + 6 from jsonb_array_elements(pa.plan_json->'weeks') w) as last_day,
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
         (select max((w.value->>'date')::date) + 6 from jsonb_array_elements(p.plan_json->'weeks') w),
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
  -- ⚠️ NULL, NOT FALSE, for a runner who never started a trial. `false` means "had no plan during
  -- their trial" and they had no trial; `where not trainable_week_in_trial` would otherwise sweep
  -- every non-trialist into the headline. The sibling `earliest_plan_start_in_trial` is already
  -- NULL for them, and three columns about one question must not disagree about absence.
  case when s.trial_started_at is null then null else
    exists (select 1 from plan_versions v
             where v.user_id = m.user_id
               and v.live_from <  s.trial_started_at + interval '14 days'
               and v.live_to   >  s.trial_started_at)
  end                                             as had_live_plan_in_trial,

  -- 🔑 THE DOMINANT CAUSE, AS A BOOLEAN, FROM HISTORY. True when some plan version that was live
  -- during the trial had already begun by the time the trial ended — i.e. there was a session to
  -- match a run against. False is the runner for whom a read was IMPOSSIBLE.
  -- ⚠️ THE PLAN MUST OVERLAP THE TRIAL, NOT MERELY HAVE STARTED BY THE END OF IT. The first cut
  -- tested `first_week <= trial_end` alone, so a plan that had already FINISHED before the trial
  -- opened scored true — and `trial_started_at` is stamped on first dashboard load, not at signup,
  -- so that ordering is reachable. Measured: it changes nothing today (13 either way) and it is
  -- wrong, which is the definition of latent.
  case when s.trial_started_at is null then null else
    exists (select 1 from plan_versions v
             where v.user_id = m.user_id
               and v.live_from <  s.trial_started_at + interval '14 days'
               and v.live_to   >  s.trial_started_at
               -- ⚠️ THE TWO WINDOWS MUST COINCIDE, not merely both be true. A version live only
               -- on trial days 1–3 whose weeks begin on day 10 passes "live during the trial" and
               -- "calendar overlaps the trial" independently while no session was ever matchable
               -- WHILE IT WAS LIVE. Intersect first: the plan must overlap
               -- [live_from, live_to) ∩ [trial_start, trial_end).
               and v.first_week <= least(v.live_to, s.trial_started_at + interval '14 days')::date
               and v.last_day   >= greatest(v.live_from, s.trial_started_at)::date)
  end                                             as trainable_week_in_trial,

  -- The earliest start any live-in-trial version offered, so the SIZE of the gap is readable.
  (select min(v.first_week) from plan_versions v
    where v.user_id = m.user_id and s.trial_started_at is not null
      and v.live_from <  s.trial_started_at + interval '14 days'
      and v.live_to   >  s.trial_started_at)      as earliest_plan_start_in_trial,

  (select min(a.start_date) from strava_activities a where a.user_id = m.user_id)
                                                  as first_activity_at,
  (select count(*) from strava_activities a where a.user_id = m.user_id)
                                                  as activities_total,
  -- ⚠️ NULL FOR A NON-TRIALIST, like the two booleans above. `0` reads as "had a trial and did
  -- nothing in it", so `count(*) filter (where reads_in_trial = 0)` — the view's headline — would
  -- carry every non-trialist in its numerator. Columns about one question must not disagree about
  -- absence; the first cut made the booleans NULL and left these two at 0, which is the same
  -- defect one line down from its own fix.
  case when s.trial_started_at is null then null else
    (select count(*) from strava_activities a
       where a.user_id = m.user_id
         and a.start_date >= s.trial_started_at
         and a.start_date <  s.trial_started_at + interval '14 days')
  end                                             as activities_in_trial,

  (select min(r.created_at) from run_analysis r
     where r.user_id = m.user_id and r.superseded_at is null)
                                                  as first_read_at,
  (select count(*) from run_analysis r
     where r.user_id = m.user_id and r.superseded_at is null)
                                                  as reads_total,
  case when s.trial_started_at is null then null else
    (select count(*) from run_analysis r
       where r.user_id = m.user_id and r.superseded_at is null
         and r.created_at >= s.trial_started_at
         and r.created_at <  s.trial_started_at + interval '14 days')
  end                                             as reads_in_trial,

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
