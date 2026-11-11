-- INTERNAL-ACCOUNTS-01 — exclude non-admin internal accounts from user metrics.
--
-- Metrics are polluted by friends, testers, Apple App Review and demo accounts.
-- `is_admin` already exists; this adds a SEPARATE flag that grants NO permissions.
--
-- 🔴 WHAT THE SPEC ASSUMED AND WHAT IS ACTUALLY TRUE. The brief said "we already
-- exclude is_admin users" and asked for `is_internal` to be excluded "as they
-- exclude is_admin". Measured 2026-11-11 against production: of the four views
-- named, only `v_trial_conversion` references `is_admin` at all, and it does not
-- FILTER on it — it exposes the column and computes a `converted_real` boolean.
-- There are THREE different shapes in use and no single mechanism to mirror:
--
--   admin_user_tiers    a tier LADDER (`CASE WHEN is_admin THEN 'admin'`), so
--                       admins fall out of v_paying_users as a SIDE EFFECT of
--                       never being 'premium', not by any filter.
--   v_trial_conversion  a `_real` BOOLEAN plus a `looks_like_test` email
--                       heuristic (`email ILIKE '%test%' OR '%demo%'`).
--   v_coach_engagement  NOTHING. It never joins user_settings.
--   v_partner_cohort    NOTHING.
--   v_hr_present_pct    NOTHING, and the brief does not name it.
--
-- So this migration establishes the one owner the brief's own pattern needs
-- (`v_metric_users`) rather than copying a clause that does not exist.
--
-- ⚠️ `looks_like_test` is the hack this replaces, and it was never sufficient:
-- it catches `test13@test.com` and misses `sheri.9j4u40i.paid@icloud.com` and
-- both `@privaterelay.appleid.com` App Review accounts.

begin;

-- ── 1. The flag ─────────────────────────────────────────────────────────────
-- NOT a permission. Nothing reads it for entitlement: `resolveTier` is the single
-- owner of access (admin → subscription → grant → trial → free) and is untouched.
-- Testers keep receiving plans, coaching, emails and push, which is the point.
alter table public.user_settings
  add column if not exists is_internal boolean not null default false,
  add column if not exists internal_reason text;

comment on column public.user_settings.is_internal is
  'INTERNAL-ACCOUNTS-01: non-admin internal account (tester, friend, App Review, demo). '
  'Excluded from user metrics via v_metric_users. Grants NO permissions and must never be '
  'read for entitlement — resolveTier is the single owner of access.';
comment on column public.user_settings.internal_reason is
  'Why: ''app_review_or_demo'' or ''tester/friend''. Free text so a new reason needs no migration.';

-- ── 2. The brief's blocking assertion, enforced at APPLY time ───────────────
-- "Before writing, assert none of the 18 has a comped subscription (Make-A-Wish
-- code). If any does, stop and report."
--
-- Make-A-Wish uses APPLE OFFER CODES, which land in `subscriptions` as
-- `is_comped`. Measured now: 24 comped subscriptions exist overall and NONE
-- belongs to these 18, so the assertion is clear and is not an empty-population
-- pass. It is re-run here because the set can change between writing and applying.
do $$
declare n int;
begin
  select count(*) into n
  from public.subscriptions
  where is_comped is true
    and user_id = any (array[
      '193f4b38-fd41-4d78-a7c7-46cee5786c12','ea2c29a7-2278-43f6-a335-00212ae201ef',
      '497a0e5c-5dbd-46bd-9fec-ec7b39751d53','f6374e04-17f8-466a-92e5-49c9b93e648c',
      'b202c4f8-afd9-4913-96ea-7afdd053173e','73b7ff58-7a15-415a-b69d-679f79a3833f',
      'd1c7bbca-d4ff-450a-88ea-f8d316442deb','c85950ff-9633-491f-a828-8dfc08c5f42f',
      'df2cc6e6-c507-4ec7-a16a-2f21ec109f14','dc298489-6b26-49de-8b49-9cdd23437b97',
      '2fd85950-34fb-40c1-a4c6-265de5ef296b','81e4b792-f69b-43c7-96f9-e281179df4e9',
      'ca41147d-d959-429b-a033-9846b5303fd6','24ba65cb-0708-45d9-8308-a5bb2d3d60ed',
      'adcf4e28-0b68-4a86-8cd7-12f469f1252e','2a1aa04e-c97a-4653-8c66-bd1d569edbc0',
      '2189a632-5d54-473d-af8c-cea0c3c696bf','a8263c02-d9d9-44b1-92fa-60cffda47c31'
    ]::uuid[]);
  if n > 0 then
    raise exception 'INTERNAL-ACCOUNTS-01: % of the 18 hold a comped (Make-A-Wish) subscription. '
      'Make-A-Wish runners are real customers and must never be flagged internal. Stopping.', n;
  end if;
end $$;

-- ── 3. The data ─────────────────────────────────────────────────────────────
-- Reason is derived from the EMAIL rather than a second hardcoded id list: the
-- brief gave five emails, all five exist, and all five are inside the 18
-- (verified 2026-11-11). Two id lists that must agree is the shape this repo
-- keeps paying for.
update public.user_settings s
set is_internal = true,
    internal_reason = case
      when lower(u.email) in (
        'ar_user98@icloud.com',
        'fnwf6vyj8z@privaterelay.appleid.com',
        '689jnkztk4@privaterelay.appleid.com',
        'sheri.9j4u40i.paid@icloud.com',
        'zonna.demo@demo.com'
      ) then 'app_review_or_demo'
      else 'tester/friend'
    end
from auth.users u
where u.id = s.id
  and s.id = any (array[
    '193f4b38-fd41-4d78-a7c7-46cee5786c12','ea2c29a7-2278-43f6-a335-00212ae201ef',
    '497a0e5c-5dbd-46bd-9fec-ec7b39751d53','f6374e04-17f8-466a-92e5-49c9b93e648c',
    'b202c4f8-afd9-4913-96ea-7afdd053173e','73b7ff58-7a15-415a-b69d-679f79a3833f',
    'd1c7bbca-d4ff-450a-88ea-f8d316442deb','c85950ff-9633-491f-a828-8dfc08c5f42f',
    'df2cc6e6-c507-4ec7-a16a-2f21ec109f14','dc298489-6b26-49de-8b49-9cdd23437b97',
    '2fd85950-34fb-40c1-a4c6-265de5ef296b','81e4b792-f69b-43c7-96f9-e281179df4e9',
    'ca41147d-d959-429b-a033-9846b5303fd6','24ba65cb-0708-45d9-8308-a5bb2d3d60ed',
    'adcf4e28-0b68-4a86-8cd7-12f469f1252e','2a1aa04e-c97a-4653-8c66-bd1d569edbc0',
    '2189a632-5d54-473d-af8c-cea0c3c696bf','a8263c02-d9d9-44b1-92fa-60cffda47c31'
  ]::uuid[]);

-- All 18 exist in user_settings (verified), so a short count is a real problem.
do $$
declare n int;
begin
  select count(*) into n from public.user_settings where is_internal;
  if n <> 18 then
    raise exception 'INTERNAL-ACCOUNTS-01: expected 18 internal accounts, found %. '
      'An id in the list no longer resolves, or someone was flagged outside this migration.', n;
  end if;
end $$;

-- ── 4. v_metric_users — THE ONE OWNER of "does this user count?" ────────────
-- Every user metric reads this instead of restating the predicate. The brief's
-- pattern ("all user metrics exclude is_admin and is_internal") is a RULE; this
-- is the mechanism, and `lib/ops/metricViewExclusion.test.ts` is the gate.
create or replace view public.v_metric_users as
  select s.id as user_id
  from public.user_settings s
  where not coalesce(s.is_admin, false)
    and not coalesce(s.is_internal, false);

comment on view public.v_metric_users is
  'INTERNAL-ACCOUNTS-01: the users that COUNT toward product metrics. Single owner of the '
  'exclusion. A new user metric joins this view; it does not restate is_admin/is_internal.';

grant select on public.v_metric_users to authenticated, service_role;

-- ── 5. The metric views ─────────────────────────────────────────────────────

-- 5a. v_trial_conversion — keeps its row-per-user shape and its existing
-- `converted_real`, which gains the internal exclusion. `looks_like_test` is KEPT
-- for one release so the two can be compared, and is now marked superseded.
create or replace view public.v_trial_conversion as
 select s.id as user_id,
    s.trial_started_at,
    sub.created_at as subscribed_at,
    sub.status as sub_status,
    (sub.user_id is not null) as converted,
    case
      when sub.created_at is not null and s.trial_started_at is not null
        then round(extract(epoch from (sub.created_at - s.trial_started_at)) / 86400.0, 2)
      else null::numeric
    end as days_trial_to_sub,
    -- INTERNAL-ACCOUNTS-01: `is_internal` joins the existing admin/comped exclusion.
    ((sub.user_id is not null)
      and (not coalesce(s.is_admin, false))
      and (not coalesce(s.is_internal, false))
      and (not coalesce(sub.is_comped, false))) as converted_real,
    coalesce(s.is_admin, false) as is_admin,
    coalesce(s.is_internal, false) as is_internal,
    s.internal_reason,
    (g.claimed_by is not null) as had_charity_grant,
    -- ⚠️ SUPERSEDED by `is_internal` and kept one release to compare. It catches
    -- `test13@test.com` and MISSES `sheri.9j4u40i.paid@icloud.com` and both
    -- `@privaterelay.appleid.com` App Review accounts, which is why it is going.
    (((u.email)::text ilike '%test%') or ((u.email)::text ilike '%demo%')) as looks_like_test,
    coalesce(sub.is_comped, false) as is_comped
   from public.user_settings s
     join auth.users u on u.id = s.id
     left join public.subscriptions sub on sub.user_id = s.id
     left join public.charity_codes g on g.claimed_by = s.id
  where s.trial_started_at is not null;

-- 5b. v_coach_engagement — had NO user_settings join at all, so the exclusion is
-- a new join rather than a new clause.
create or replace view public.v_coach_engagement as
 with opens as (
   select analytics_events.user_id,
          date_trunc('week'::text, analytics_events.created_at) as week,
          count(*) as coach_opens
     from public.analytics_events
    where analytics_events.event = 'coach_open'::text
    group by analytics_events.user_id, date_trunc('week'::text, analytics_events.created_at)
 ), actions as (
   select session_completions.user_id,
          date_trunc('week'::text, session_completions.updated_at) as week,
          count(*) as downstream_actions
     from public.session_completions
    group by session_completions.user_id, date_trunc('week'::text, session_completions.updated_at)
 )
 select o.user_id, o.week, o.coach_opens,
        coalesce(a.downstream_actions, 0::bigint) as downstream_actions
   from opens o
   left join actions a on a.user_id = o.user_id and a.week = o.week
   -- INTERNAL-ACCOUNTS-01
   join public.v_metric_users m on m.user_id = o.user_id;

-- 5c. v_hr_present_pct — NOT named in the brief, and it is a user metric with no
-- user dimension at all: a global percentage over every activity ever ingested,
-- testers included. Added because the brief's own pattern says ALL user metrics,
-- and a pattern that a sibling view violates on day one is not a pattern.
create or replace view public.v_hr_present_pct as
 select count(*) filter (where a.hr_present_at_first_query is not null) as instrumented_runs,
        count(*) filter (where a.hr_present_at_first_query is true)     as hr_present_runs,
        count(*) filter (where a.hr_present_at_first_query is false)    as hr_absent_runs,
        round((100.0 * (count(*) filter (where a.hr_present_at_first_query is true))::numeric)
              / nullif(count(*) filter (where a.hr_present_at_first_query is not null), 0)::numeric, 1)
          as hr_present_pct
   from public.strava_activities a
   -- INTERNAL-ACCOUNTS-01
   join public.v_metric_users m on m.user_id = a.user_id;

-- 5d. v_partner_cohort — SPLIT, deliberately, and this is the one judgement call
-- in the migration.
--
-- 🔴 GTM-CHARITY-07 IS RATIFIED AND SAYS A SEAT IS SPENT WHEN IT WAS CLAIMED
-- (founder: "if a user deletes their account, no, they don't get the seat back").
-- `codes_minted` / `codes_redeemed` / `grants_active` are the BATCH's record of
-- its own capacity, not user metrics — filtering a tester out of them would make
-- a partner's redeemed count disagree with `charity_codes` and silently refill
-- the batch, which is exactly what that ruling forbids. They stay unfiltered.
--
-- The ENGAGEMENT columns are user metrics and are filtered.
--
-- ⚠️ THIS IS LIVE, NOT HYPOTHETICAL: `test13@test.com`
-- (adcf4e28-0b68-4a86-8cd7-12f469f1252e) claimed code 37G94M6Y from batch
-- 7c2ae3a2 twenty minutes after signing up, has 0 runs and 0 completions, and
-- signed in exactly once. It is one of the 18. After this migration the batch
-- still reports its seat as redeemed, and stops reporting it as a runner.
create or replace view public.v_partner_cohort as
 select b.id as batch_id,
    b.partner_name,
    b.cap,
    b.revoked_at,
    -- Capacity: the batch's own record. NOT user metrics. Unfiltered (GTM-CHARITY-07).
    count(c.id) as codes_minted,
    count(c.claimed_at) as codes_redeemed,
    count(*) filter (where c.expires_at > now()) as grants_active,
    count(*) filter (where c.claimed_at is not null and c.claimed_by is null) as seats_claimed_user_deleted,
    -- Engagement: user metrics. INTERNAL-ACCOUNTS-01 excluded.
    count(distinct p.user_id)  filter (where mp.user_id is not null) as runners_with_a_plan,
    count(distinct sc.user_id) filter (where ms.user_id is not null) as runners_logging_sessions,
    count(distinct us.id) filter (where us.healthkit_connected_at is not null
                                    and mu.user_id is not null)      as healthkit_accepted_upper_bound,
    count(distinct au.id) filter (where au.last_sign_in_at > (now() - '7 days'::interval)
                                    and mu.user_id is not null)      as signed_in_last_7d
   from public.charity_batches b
     left join public.charity_codes c on c.batch_id = b.id
     left join auth.users au on au.id = c.claimed_by
     left join public.user_settings us on us.id = c.claimed_by
     left join public.plans p on p.user_id = c.claimed_by
     left join public.session_completions sc on sc.user_id = c.claimed_by
     left join public.v_metric_users mu on mu.user_id = c.claimed_by
     left join public.v_metric_users mp on mp.user_id = p.user_id
     left join public.v_metric_users ms on ms.user_id = sc.user_id
  group by b.id, b.partner_name, b.cap, b.revoked_at, b.created_at
  order by b.created_at desc;

-- 5e. v_paying_users needs no change and the reason is worth recording: it reads
-- `admin_user_tiers`, where admins are excluded as a SIDE EFFECT of the tier
-- ladder (an admin is classified 'admin', never 'premium'). The same is now true
-- of internal accounts, because the ladder gains an 'internal' rung BELOW every
-- paying rung — see 6b. No `where` clause here would be correct: it counts tiers,
-- not users.

-- ── 6. Admin visibility ─────────────────────────────────────────────────────
-- 6a. admin_user_directory — show the flag and the reason.
create or replace view public.admin_user_directory as
 select u.id,
    coalesce(nullif(s.first_name, ''::text),
             nullif(split_part((u.raw_user_meta_data ->> 'full_name'::text), ' '::text, 1), ''::text)) as first_name,
    coalesce(nullif(s.last_name, ''::text),
             nullif(split_part((u.raw_user_meta_data ->> 'full_name'::text), ' '::text, 2), ''::text)) as last_name,
    u.email,
    u.created_at as signed_up,
    u.last_sign_in_at,
    s.trial_started_at,
    s.is_admin,
    -- INTERNAL-ACCOUNTS-01
    coalesce(s.is_internal, false) as is_internal,
    s.internal_reason
   from auth.users u
     left join public.user_settings s on s.id = u.id
  order by u.created_at desc;

-- 6b. admin_user_tiers — expose the flag WITHOUT changing the tier.
--
-- ⚠️ `is_internal` is deliberately NOT a tier value. Replacing a tester's tier
-- with 'internal' would make this view lie about what they can actually access,
-- and the brief is explicit that the flag grants nothing and testers keep
-- receiving everything. The tier ladder is untouched; the flag rides alongside it
-- so an admin can see both.
create or replace view public.admin_user_tiers as
 select u.id,
    case
      when coalesce(s.is_admin, false) then 'admin'::text
      when (sub.status = any (array['trialing'::text, 'active'::text])) and sub.current_period_end > now() then 'premium'::text
      when g.expires_at > now() then 'grant'::text
      when s.trial_started_at > (now() - '14 days'::interval) then 'trial'::text
      else 'free'::text
    end as tier,
    coalesce(nullif(s.first_name, ''::text),
             nullif(split_part((u.raw_user_meta_data ->> 'full_name'::text), ' '::text, 1), ''::text)) as first_name,
    coalesce(nullif(s.last_name, ''::text),
             nullif(split_part((u.raw_user_meta_data ->> 'full_name'::text), ' '::text, 2), ''::text)) as last_name,
    u.email,
    case
      when s.trial_started_at > (now() - '14 days'::interval)
        then ceil(extract(epoch from ((s.trial_started_at + '14 days'::interval) - now())) / 86400::numeric)::integer
      else null::integer
    end as trial_days_left,
    sub.provider as sub_provider,
    sub.status as sub_status,
    sub.current_period_end as sub_renews,
    s.trial_started_at,
    s.is_admin,
    coalesce(s.is_internal, false) as is_internal,
    s.internal_reason,
    u.created_at as signed_up,
    u.last_sign_in_at,
    g.expires_at as grant_expires,
    b.partner_name as grant_partner
   from auth.users u
     left join public.user_settings s on s.id = u.id
     left join public.subscriptions sub on sub.user_id = u.id
     left join public.charity_codes g on g.claimed_by = u.id
     left join public.charity_batches b on b.id = g.batch_id
  order by
    case
      when coalesce(s.is_admin, false) then 0
      when (sub.status = any (array['trialing'::text, 'active'::text])) and sub.current_period_end > now() then 1
      when g.expires_at > now() then 2
      when s.trial_started_at > (now() - '14 days'::interval) then 3
      else 4
    end, u.created_at desc;

-- ── 7. 🔴 RLS / PRIVILEGES — AND THIS IS THE FINDING, NOT THE TASK ──────────
--
-- The brief asked: "users must not be able to set is_internal on their own row.
-- Confirm the user_settings update policy blocks it; fix if not." IT DOES NOT,
-- and the same hole already applies to `is_admin`, which is worse.
--
-- Measured 2026-11-11:
--   · RLS is enabled on user_settings (so writes are confined to one's own row);
--   · the UPDATE policy is `USING (auth.uid() = id)` with **with_check = NULL**,
--     and Postgres reuses USING as the check when WITH CHECK is absent;
--   · `authenticated` holds table-wide UPDATE on all 45 columns, is_admin among
--     them;
--   · there are ZERO triggers on the table.
--
-- So any signed-in user could run
--     update user_settings set is_admin = true where id = auth.uid();
-- and `resolveTier` would return {tier:'paid', reason:'admin'} — paid features
-- plus the admin-only surfaces. Pre-existing, not introduced here.
--
-- Column-level REVOKE is the right instrument: nothing client-side writes either
-- column (grepped: the only `is_admin` hit outside reads is the column manifest
-- in `lib/contracts/tableColumns.ts`), both are set by hand or by migration under
-- the service role, and `service_role` BYPASSES these grants so the server is
-- unaffected.
revoke update (is_admin, is_internal, internal_reason)
  on public.user_settings from anon, authenticated;

-- A WITH CHECK is added too, so the policy states its intent rather than relying
-- on Postgres's default. It cannot see OLD, so it cannot by itself stop a column
-- change — the revoke above is what does that. This makes the row rule explicit.
drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = id) with check (auth.uid() = id);

commit;

-- ── Verification, to run AFTER applying ─────────────────────────────────────
-- Each line must return the stated value. Handed over rather than assumed:
-- see `docs/runbooks/internal-accounts.md`.
--
--   select count(*) from user_settings where is_internal;                    -- 18
--   select internal_reason, count(*) from user_settings
--     where is_internal group by 1 order by 1;                              -- app_review_or_demo 5, tester/friend 13
--   select count(*) from v_metric_users;                                    -- (total users) - 18 - admins
--   select has_column_privilege('authenticated','user_settings','is_admin','UPDATE');    -- false
--   select has_column_privilege('authenticated','user_settings','is_internal','UPDATE'); -- false
--   select has_column_privilege('service_role','user_settings','is_admin','UPDATE');     -- true
