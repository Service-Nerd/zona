-- OPS-TRIAL-SQL-CLOCK-01 — the admin SQL counts the trial from SIGN-UP, and has been wrong
-- since the first-read clock went live.
--
-- 📐 MEASURED IN PRODUCTION, AND MY FIRST MEASUREMENT WAS WRONG — the correction is the
-- justification, so it is recorded here rather than quietly fixed.
--
-- I first wrote that the app puts 6 non-internal users on trial while this view puts 4, and
-- that "the two it loses are reported as free". FALSE. That comparison excluded admins and
-- internal accounts and skipped the premium and grant rungs, which sit ABOVE trial in the
-- ladder. Evaluated as the view actually evaluates it, those two users are `premium`/`grant`
-- — correctly — and the ladder's output is IDENTICAL before and after this migration:
--   tier changes today ................ 0   (admin 1 · premium 23 · grant 1 · trial 4 · free 27)
--
-- What genuinely moves:
--   admin_user_tiers.trial_days_left .. 6 users change; 2 of them go from NO number to a
--                                       number, because the signup window had expired for them
--                                       while the real one had not.
--   v_activation_funnel ............... all seven in-trial windows, and the programme's own
--                                       headline with them: trainable_week_in_trial is
--                                       13 of 37 on the signup window and 15 of 37 on the real
--                                       one. The recorded finding "24 of 37 trialists had no
--                                       trainable plan week inside their trial" is 22 of 37.
--
-- 🔑 THAT LAST LINE IS WHY THIS IS WORTH APPLYING. The funnel is the activation programme's
-- measurement surface, and it was measuring the window the product stopped using on 2026-11-12.
-- A view that reports the wrong TIER would be louder; a view that quietly reports the wrong
-- DENOMINATOR is what this repo keeps paying for.
--
-- ⚠️ 0 extensions have been accepted, so the extension branch is inert today and is mirrored
-- from `resolveTrialWindow` rather than from any observed behaviour.
--
-- 🔴 WHY SQL MIRRORS THE POLICY AT ALL, WHEN D-16 FORBIDS PARALLEL SEMANTICS.
-- The item that raised this proposed three options and called a PL/pgSQL twin "D-16 one layer
-- down". That is right about the risk and wrong that there is no precedent: this repo already
-- mirrors `trialFunnel.ts` in the ops-digest SQL and gates it with `digestTrialSqlMirror.test.ts`,
-- and `v_activation_funnel` already carried a hand-written 14 with `activationFunnel.test.ts`
-- asserting it matched `TRIAL_DAYS`. D-16's concern is drift NOBODY SEES. A gate is the answer
-- to that, and the duplication is reduced from EIGHT hand-written windows (one in
-- `admin_user_tiers`, seven in `v_activation_funnel`) to ONE function.
--
-- ⚠️ The alternative — persisting the resolved window so SQL reads a value rather than a rule —
-- needs a write on the ingest path to stay correct, because the window moves when a run is first
-- read. That is real machinery for two hand-read admin views with ZERO code consumers (measured:
-- every reference outside these migrations is documentation). Not taken; recorded here so the
-- next reader knows it was considered.

-- ── 1. THE ONE SQL OWNER OF THE WINDOW ──────────────────────────────────────────────────────
--
-- Mirrors `lib/trial.ts → resolveTrialWindow` with `TRIAL_STARTS_AT_FIRST_READ` on.
-- `lib/ops/trialWindowSqlMirror.test.ts` fails if the constants here and in `lib/trial.ts`
-- disagree, or if this function stops being the only place SQL computes the window.
--
-- ⚠️ THE EXTENSION IS `max(ends, extended) + 7`, NOT `ends + 7`. Accepting on day 23 under the
-- naive form granted NOTHING while the page said "7 more days." — the defect `resolveTrialWindow`
-- records in its own comment. A mirror written from the column name rather than from the function
-- would have reproduced it.
-- ⚠️ `greatest(first_read, started)` is the clamp: an unclamped `min` would hand out a trial that
-- ended before it began.
create or replace function public.trial_window_ends(
  started    timestamptz,
  first_read timestamptz,
  extended   timestamptz
) returns timestamptz
language sql
immutable
as $fn$
  select case
    when started is null then null
    else (
      select case
               when extended is null then base
               else greatest(base, extended) + interval '7 days'   -- TRIAL_EXTENSION_DAYS
             end
      from (
        select case
                 when first_read is null
                   then started + interval '21 days'               -- TRIAL_MAX_DAYS_FROM_START
                 else least(greatest(first_read, started) + interval '14 days',  -- TRIAL_DAYS
                            started + interval '21 days')          -- TRIAL_MAX_DAYS_FROM_START
               end as base
      ) b
    )
  end
$fn$;

comment on function public.trial_window_ends(timestamptz, timestamptz, timestamptz) is
  'OPS-TRIAL-SQL-CLOCK-01 — the single SQL mirror of lib/trial.ts resolveTrialWindow. Do not '
  'compute a trial window anywhere else in SQL; lib/ops/trialWindowSqlMirror.test.ts enforces it.';

revoke all on function public.trial_window_ends(timestamptz, timestamptz, timestamptz) from anon, authenticated;
grant execute on function public.trial_window_ends(timestamptz, timestamptz, timestamptz) to service_role;

-- ── 2. admin_user_tiers ─────────────────────────────────────────────────────────────────────
--
-- 🔴 DROP AND RECREATE, NOT `CREATE OR REPLACE`. The tier CASE and `trial_days_left` both change
-- shape, and `CREATE OR REPLACE VIEW` may only APPEND columns (42P16) — recorded three times in
-- this repo, twice as a migration that would have applied NOTHING. `v_paying_users` depends on
-- this view, so it is dropped first and restored verbatim below.
-- ⚠️ `v_paying_users` reads only `tier = 'premium'` and `is_internal`, neither of which moves
-- here; it is recreated unchanged so the drop is reversible in one file.
drop view if exists public.v_paying_users;
drop view if exists public.admin_user_tiers;

CREATE VIEW public.admin_user_tiers AS
SELECT
  u.id,
  CASE
    WHEN COALESCE(s.is_admin, false) THEN 'admin'
    WHEN sub.status IN ('trialing', 'active')
         AND sub.current_period_end > now() THEN 'premium'
    WHEN g.expires_at > now() THEN 'grant'
    -- OPS-TRIAL-SQL-CLOCK-01 — the real window, not `trial_started_at + 14 days`.
    WHEN now() < public.trial_window_ends(s.trial_started_at, tw.first_read, s.trial_extended_at)
      THEN 'trial'
    ELSE 'free'
  END AS tier,
  COALESCE(
    NULLIF(s.first_name, ''),
    NULLIF(split_part(u.raw_user_meta_data->>'full_name', ' ', 1), '')
  ) AS first_name,
  COALESCE(
    NULLIF(s.last_name, ''),
    NULLIF(split_part(u.raw_user_meta_data->>'full_name', ' ', 2), '')
  ) AS last_name,
  u.email,
  CASE
    WHEN now() < public.trial_window_ends(s.trial_started_at, tw.first_read, s.trial_extended_at)
      THEN ceil(extract(epoch FROM (
             public.trial_window_ends(s.trial_started_at, tw.first_read, s.trial_extended_at) - now()
           )) / 86400)::int
    ELSE NULL
  END AS trial_days_left,
  sub.provider            AS sub_provider,
  sub.status              AS sub_status,
  sub.current_period_end  AS sub_renews,
  s.trial_started_at,
  -- The INPUTS the window is resolved from, so an admin reading this in the SQL editor can see
  -- why a runner has the days they have without re-deriving the policy.
  tw.first_read           AS trial_clock_started_at,
  s.trial_extended_at,
  s.is_admin,
  u.created_at            AS signed_up,
  u.last_sign_in_at,
  g.expires_at            AS grant_expires,
  b.partner_name          AS grant_partner,
  COALESCE(s.is_internal, false) AS is_internal,
  s.internal_reason
FROM auth.users u
LEFT JOIN public.user_settings s   ON s.id = u.id
LEFT JOIN public.subscriptions sub ON sub.user_id = u.id
LEFT JOIN public.charity_codes g    ON g.claimed_by = u.id
LEFT JOIN public.charity_batches b  ON b.id = g.batch_id
CROSS JOIN LATERAL (
  SELECT (SELECT min(r.created_at) FROM public.run_analysis r
           WHERE r.user_id = u.id AND r.superseded_at IS NULL) AS first_read
) tw
ORDER BY
  CASE
    WHEN COALESCE(s.is_admin, false) THEN 0
    WHEN sub.status IN ('trialing', 'active') AND sub.current_period_end > now() THEN 1
    WHEN g.expires_at > now() THEN 2
    WHEN now() < public.trial_window_ends(s.trial_started_at, tw.first_read, s.trial_extended_at) THEN 3
    ELSE 4
  END,
  u.created_at DESC;

comment on view public.admin_user_tiers is
  'Tier per user, mirroring lib/trial.ts resolveTier. The trial rung reads '
  'public.trial_window_ends, the single SQL mirror of resolveTrialWindow -- NOT trial_started_at '
  '+ 14 days, which stopped being the trial when TRIAL_STARTS_AT_FIRST_READ went live.';

REVOKE ALL ON public.admin_user_tiers FROM anon, authenticated;
grant select on public.admin_user_tiers to service_role;

-- `v_paying_users`, restored verbatim from 20261111d (it was dropped only for the cascade).
create view public.v_paying_users as
  select
    count(*) filter (
      where t.tier = 'premium'
        and not coalesce(t.is_internal, false)
        and exists (
          select 1 from public.subscriptions b
           where b.user_id = t.id
             and b.status in ('active', 'trialing')
             and not coalesce(b.is_comped, false)
        )
    )::integer                                   as paying_users,
    count(*) filter (
      where t.tier = 'premium'
        and not coalesce(t.is_internal, false)
        and exists (
          select 1 from public.subscriptions b
           where b.user_id = t.id and coalesce(b.is_comped, false)
        )
    )::integer                                   as comped_users
  from public.admin_user_tiers t;

revoke all on public.v_paying_users from anon, authenticated;
grant select on public.v_paying_users to service_role;

-- ── 3. v_activation_funnel ──────────────────────────────────────────────────────────────────
--
-- Seven hand-written windows became one lateral reading the owner. Dropped and recreated for the
-- same 42P16 reason: `trial_ends_at` changes meaning and several columns change with it.
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
  -- ⚠️ The window is `lib/trial.ts → resolveTrialWindow`, mirrored ONCE in
  -- `public.trial_window_ends` and gated by `lib/ops/trialWindowSqlMirror.test.ts`. This column
  -- was `trial_started_at + 14 days`, which stopped being the trial on 2026-11-12.
  tw.ends_at                                      as trial_ends_at,
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
  -- every non-trialist into the headline. The sibling `earliest_live_plan_first_week` is already
  -- NULL for them, and three columns about one question must not disagree about absence.
  case when s.trial_started_at is null then null else
    exists (select 1 from plan_versions v
             where v.user_id = m.user_id
               and v.live_from <  tw.ends_at
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
               and v.live_from <  tw.ends_at
               and v.live_to   >  s.trial_started_at
               -- ⚠️ THE TWO WINDOWS MUST COINCIDE, not merely both be true. A version live only
               -- on trial days 1–3 whose weeks begin on day 10 passes "live during the trial" and
               -- "calendar overlaps the trial" independently while no session was ever matchable
               -- WHILE IT WAS LIVE. Intersect first: the plan must overlap
               -- [live_from, live_to) ∩ [trial_start, trial_end).
               and v.first_week <= least(v.live_to, tw.ends_at)::date
               and v.last_day   >= greatest(v.live_from, s.trial_started_at)::date)
  end                                             as trainable_week_in_trial,

  -- The earliest start any live-in-trial version offered, so the SIZE of the gap is readable.
  -- ⚠️ RENAMED, because the name made it contradict the column above. As
  -- `earliest_plan_start_in_trial` it read as "the start that made the trial trainable", and after
  -- the intersection tightening a runner could score `trainable_week_in_trial = false` while this
  -- showed a date INSIDE the trial — the day-10 case, where the version holding that start was no
  -- longer live by the time it arrived. It measures something narrower and useful: the earliest
  -- calendar start ON OFFER from any version that was live at some point during the trial,
  -- **whether or not that start was reachable while it was live**. That is what sizes the gap
  -- (242 days for the worst case), and it is deliberately NOT conditioned on trainability.
  (select min(v.first_week) from plan_versions v
    where v.user_id = m.user_id and s.trial_started_at is not null
      and v.live_from <  tw.ends_at
      and v.live_to   >  s.trial_started_at)      as earliest_live_plan_first_week,

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
         and a.start_date <  tw.ends_at)
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
         and r.created_at <  tw.ends_at)
  end                                             as reads_in_trial,

  -- ACT-RUNREAD-REACH-01 — WHY a run produced no read, per runner. `run_unmatched` is recorded
  -- at each of the five walls (four inside `autoMatchAndAnalyse`, plus the caller's tier gate),
  -- so the funnel can show the DROP and the REASON on the same row instead of leaving the second
  -- half to be reconstructed. Empty until the instrumentation has run; `reads_total = 0` with no
  -- reason means nothing has been ingested since it shipped, which is a different fact from "we
  -- do not know why".
  -- ⚠️ DISTINCT, because `run_unmatched` is recorded per ingest ATTEMPT. `clientSync` re-posts
  -- recent workouts on every sweep, so `count(*)` would report sweeps rather than runs. The
  -- event carries `activity_id` for exactly this.
  (select count(distinct o.detail->>'activity_id') from ops_events o
     where o.user_id = m.user_id and o.kind = 'run_unmatched')
                                                  as unmatched_runs,
  (select o.detail->>'reason' from ops_events o
     where o.user_id = m.user_id and o.kind = 'run_unmatched'
     order by o.created_at desc limit 1)          as last_unmatched_reason,

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
join auth.users au          on au.id = m.user_id
-- OPS-TRIAL-SQL-CLOCK-01 — the window is resolved ONCE per row, by the one SQL owner, instead
-- of the seven hand-written 14-day intervals this view used to carry. Every site above reads
-- the lateral, so a policy change lands in `trial_window_ends` and reaches all seven.
cross join lateral (
  select public.trial_window_ends(
           s.trial_started_at,
           (select min(r.created_at) from public.run_analysis r
             where r.user_id = m.user_id and r.superseded_at is null),
           s.trial_extended_at
         ) as ends_at
) tw;
comment on view public.v_activation_funnel is
  'ACT-FUNNEL-01 -- one row per metric user with each activation milestone. "Run read" = a '
  'run_analysis row with superseded_at IS NULL (see lib/ops/runRead.ts). trainable_week_in_trial '
  'is computed from PLAN HISTORY (plan_archive + plans), not the current plans row, because that '
  'table is a snapshot and the question is historical. OPS-TRIAL-SQL-CLOCK-01: every in-trial '
  'window comes from public.trial_window_ends, not from trial_started_at + 14 days.';

revoke all on public.v_activation_funnel from anon, authenticated;
grant select on public.v_activation_funnel to service_role;
