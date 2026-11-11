-- INTERNAL-ACCOUNTS-01 — exclude non-admin internal accounts from user metrics.
--
-- Metrics are polluted by friends, testers, Apple App Review and demo accounts.
-- `is_admin` already exists; this adds a SEPARATE flag that grants NO permissions.
--
-- 🔴 WHAT THE BRIEF ASSUMED AND WHAT IS ACTUALLY TRUE. It said "we already exclude
-- is_admin users" and asked for `is_internal` to be excluded "as they exclude
-- is_admin". Measured 2026-11-11 against production: of the four views named, only
-- `v_trial_conversion` references `is_admin` at all, and it does not FILTER on it.
-- Three different shapes were in use and there was nothing to mirror:
--
--   admin_user_tiers    a tier LADDER (`CASE WHEN is_admin THEN 'admin'`), so admins
--                       fall out of v_paying_users as a SIDE EFFECT of never being
--                       'premium', not by any filter.
--   v_trial_conversion  a `converted_real` BOOLEAN plus a `looks_like_test` email
--                       heuristic (`email ILIKE '%test%' OR '%demo%'`).
--   v_coach_engagement  NOTHING. It never joins user_settings.
--   v_partner_cohort    NOTHING.
--   v_hr_present_pct    NOTHING, and the brief does not name it.
--
-- So this establishes the one owner the brief's own pattern needs (`v_metric_users`)
-- rather than copying a clause that does not exist.
--
-- ⚠️ `looks_like_test` is the hack this replaces, and it was never sufficient: it
-- catches `test13@test.com` and misses `sheri.9j4u40i.paid@icloud.com` and both
-- `@privaterelay.appleid.com` App Review accounts.
--
-- 🔴 TEN DEFECTS WERE FOUND IN THE FIRST CUT OF THIS FILE BY CODE REVIEW, three of
-- them severe: two `CREATE OR REPLACE VIEW` column insertions that would have aborted
-- the whole transaction (42P16), and a column REVOKE that was completely inert. Each
-- is commented where it was fixed.

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
-- Make-A-Wish uses APPLE OFFER CODES, which land in `subscriptions` as `is_comped`.
-- Measured: 24 comped subscriptions exist overall and NONE belongs to these 18, so
-- the assertion is clear and is not an empty-population pass. Re-run here because the
-- set can change between writing and applying.
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
-- Reason derived from the EMAIL rather than a second hardcoded id list: the brief gave
-- five emails, all five exist, and all five are inside the 18 (verified). Two id lists
-- that must agree is the shape this repo keeps paying for.
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
-- Every user metric reads this instead of restating the predicate. The brief's pattern
-- ("all user metrics exclude is_admin and is_internal") is the RULE; this is the
-- mechanism, and `lib/ops/metricViewExclusion.test.ts` is the gate.
create or replace view public.v_metric_users as
  select s.id as user_id
  from public.user_settings s
  where not coalesce(s.is_admin, false)
    and not coalesce(s.is_internal, false);

comment on view public.v_metric_users is
  'INTERNAL-ACCOUNTS-01: the users that COUNT toward product metrics. Single owner of the '
  'exclusion. A new user metric joins this view; it does not restate is_admin/is_internal.';

-- 🔴 NOT GRANTED TO `authenticated`, AND THE FIRST CUT WAS. A view runs as its OWNER, so
-- RLS on user_settings does NOT apply to it: granting select here would have handed every
-- signed-in client the complete list of user UUIDs and the exact user count through
-- PostgREST. The sibling metric views are not client-readable either, and this one had
-- broken that convention. Found by code review.
revoke all on public.v_metric_users from anon, authenticated;
grant select on public.v_metric_users to service_role;

-- ── 5. The metric views ─────────────────────────────────────────────────────
--
-- 🔴 NEW COLUMNS GO AT THE END OF EVERY ONE OF THESE, and the first cut inserted them
-- mid-list in two views. `CREATE OR REPLACE VIEW` may only ADD columns to the end:
-- inserting reads as RENAMING whatever was in that position and fails with
-- `ERROR 42P16: cannot change name of view column`. The whole file is one transaction,
-- so it would have rolled back entirely and nothing would have applied.
-- ⚠️ `20260920_charity_tier_and_partner_cohort.sql` documents this verbatim, error code
-- included. The precedent was in this repo and I did not read it.

-- 5a. v_trial_conversion — keeps every row (it is row-per-trialling-user and an analyst
-- needs the internal rows in order to SEE the difference) and excludes internal inside
-- `converted_real`, which is how it already treats admin and comped.
--
-- ⚠️ SO THIS VIEW'S ROW COUNT DOES NOT CHANGE. `select count(*) from v_trial_conversion`
-- still returns 56. The honest denominator is `count(*) where not is_internal` = 38, and
-- the first write-up of this migration claimed the view itself went 56 → 38, which was
-- false. Corrected in the decision note and the runbook.
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
    (g.claimed_by is not null) as had_charity_grant,
    -- ⚠️ SUPERSEDED by `is_internal`, kept one release so the two can be compared.
    (((u.email)::text ilike '%test%') or ((u.email)::text ilike '%demo%')) as looks_like_test,
    coalesce(sub.is_comped, false) as is_comped,
    -- APPENDED AT THE END (42P16, see the §5 header).
    coalesce(s.is_internal, false) as is_internal,
    s.internal_reason
   from public.user_settings s
     join auth.users u on u.id = s.id
     left join public.subscriptions sub on sub.user_id = s.id
     left join public.charity_codes g on g.claimed_by = s.id
  where s.trial_started_at is not null;

-- 🔴 RE-STATED, AND THE FIRST CUT OMITTED IT FOR ALL SIX VIEWS. `CREATE OR REPLACE
-- VIEW` preserves ACLs so the database stays safe either way, but EVERY migration that
-- redefines one of these views re-states its revoke (20260528, 20260529, 20260722,
-- 20260920, 20260925) — it keeps the privilege greppable beside the definition, and
-- `adminViewTierParity.test.ts` asserts it for admin_user_tiers. Found by code review.
REVOKE ALL ON public.v_trial_conversion FROM anon, authenticated;

-- 5b. v_coach_engagement — had NO user_settings join at all, so the exclusion is a new
-- join rather than a new clause. Column list unchanged, so 42P16 does not arise.
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

REVOKE ALL ON public.v_coach_engagement FROM anon, authenticated;

-- 5c. v_hr_present_pct — NOT named in the brief, and it is a user metric with no user
-- dimension at all: a global percentage over every activity ever ingested, testers
-- included. Added because the brief's own pattern says ALL user metrics, and a pattern a
-- sibling view violates on day one is not a pattern. Column list unchanged.
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

REVOKE ALL ON public.v_hr_present_pct FROM anon, authenticated;

-- 5d. v_partner_cohort — SPLIT, deliberately, and the one judgement call here.
--
-- 🔴 GTM-CHARITY-07 IS RATIFIED AND SAYS A SEAT IS SPENT WHEN IT WAS CLAIMED (founder:
-- "if a user deletes their account, no, they don't get the seat back"). `codes_minted` /
-- `codes_redeemed` / `grants_active` are the BATCH's record of its own capacity, not user
-- metrics — filtering a tester out of them would make a partner's redeemed count disagree
-- with `charity_codes` and silently refill the batch, which that ruling exists to prevent.
-- Capacity stays unfiltered. The ENGAGEMENT columns are user metrics and are filtered.
--
-- ⚠️ LIVE, NOT HYPOTHETICAL: `test13@test.com` (adcf4e28) claimed code 37G94M6Y from
-- batch 7c2ae3a2 twenty minutes after signing up, 0 runs, 0 completions, one sign-in, and
-- is one of the 18. Proven read-only before/after: codes_redeemed 1 → 1,
-- runners_with_a_plan 1 → 0. Column list and order unchanged.
create or replace view public.v_partner_cohort as
 select b.id as batch_id,
    b.partner_name,
    b.cap,
    b.revoked_at,
    count(c.id) as codes_minted,
    count(c.claimed_at) as codes_redeemed,
    count(*) filter (where c.expires_at > now()) as grants_active,
    count(*) filter (where c.claimed_at is not null and c.claimed_by is null) as seats_claimed_user_deleted,
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

REVOKE ALL ON public.v_partner_cohort FROM anon, authenticated;

-- 5e. v_paying_users needs no change, and the reason is worth recording: it is
-- `count(*) from admin_user_tiers where tier = 'premium'`, so admins are excluded as a
-- SIDE EFFECT of the tier ladder (an admin is classified 'admin', never 'premium'). It
-- counts TIERS, not users, so a `where` clause here would be wrong rather than redundant.
-- Internal accounts keep their real tier (see 6b) and so DO still count here — which is
-- correct: a tester who genuinely holds a paid subscription is a paying user.

-- ── 6. Admin visibility ─────────────────────────────────────────────────────
-- 6a. admin_user_directory — show the flag and the reason. Appended at the end.
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
    -- INTERNAL-ACCOUNTS-01, appended at the end (42P16).
    coalesce(s.is_internal, false) as is_internal,
    s.internal_reason
   from auth.users u
     left join public.user_settings s on s.id = u.id
  order by u.created_at desc;

REVOKE ALL ON public.admin_user_directory FROM anon, authenticated;

-- 6b. admin_user_tiers — expose the flag WITHOUT changing the tier.
--
-- ⚠️ `is_internal` is deliberately NOT a tier value. An 'internal' rung would inherit the
-- exclusion everywhere for free, and would make this view LIE about what a tester can
-- access: the brief is explicit that the flag grants nothing and testers keep receiving
-- everything. The ladder is untouched; the flag rides alongside it.
--
-- ⚠️ UPPERCASE `VIEW` DELIBERATELY. `lib/charity/adminViewTierParity.test.ts` selects its
-- population with a case-SENSITIVE `includes('VIEW public.admin_user_tiers')`, so a
-- lowercase definition escapes that gate entirely and leaves it validating the superseded
-- 20260920 definition while staying green. The filter is also made case-insensitive in
-- this commit; this matches the existing convention either way. Found by code review.
-- ⚠️ WRITTEN IN THIS VIEW'S OWN HOUSE STYLE (uppercase keywords, as 20260920 and 20260529
-- wrote it) rather than in the lowercase style of the rest of this file.
-- `lib/charity/adminViewTierParity.test.ts` reads this definition and anchors its
-- arm-ordering slice on the uppercase form; a lowercase rewrite escaped the gate entirely
-- and left it validating the superseded 20260920 definition while staying green. The gate
-- is ALSO made case-insensitive and comment-stripping in this commit, but conforming here
-- is what keeps the two readable to each other. Found by code review.
CREATE OR REPLACE VIEW public.admin_user_tiers AS
SELECT
  u.id,
  CASE
    WHEN COALESCE(s.is_admin, false) THEN 'admin'
    WHEN sub.status IN ('trialing', 'active')
         AND sub.current_period_end > now() THEN 'premium'
    WHEN g.expires_at > now() THEN 'grant'
    WHEN s.trial_started_at > now() - interval '14 days' THEN 'trial'
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
    WHEN s.trial_started_at > now() - interval '14 days'
      THEN ceil(extract(epoch FROM (s.trial_started_at + interval '14 days' - now())) / 86400)::int
    ELSE NULL
  END AS trial_days_left,
  sub.provider            AS sub_provider,
  sub.status              AS sub_status,
  sub.current_period_end  AS sub_renews,
  s.trial_started_at,
  s.is_admin,
  u.created_at            AS signed_up,
  u.last_sign_in_at,
  g.expires_at            AS grant_expires,
  b.partner_name          AS grant_partner,
  -- INTERNAL-ACCOUNTS-01, APPENDED AT THE END and it must stay there: 42P16, exactly as
  -- the block 20260920 left here warns. `v_paying_users` depends on this view, so a DROP
  -- is not the alternative.
  --
  -- ⚠️ The flag is NOT a tier value. An 'internal' rung would inherit the metric exclusion
  -- everywhere for free, and would make this view LIE about what a tester can access: the
  -- brief is explicit that it grants nothing and testers keep receiving everything.
  COALESCE(s.is_internal, false) AS is_internal,
  s.internal_reason
FROM auth.users u
LEFT JOIN public.user_settings s   ON s.id = u.id
LEFT JOIN public.subscriptions sub ON sub.user_id = u.id
LEFT JOIN public.charity_codes g    ON g.claimed_by = u.id
LEFT JOIN public.charity_batches b  ON b.id = g.batch_id
ORDER BY
  CASE
    WHEN COALESCE(s.is_admin, false) THEN 0
    WHEN sub.status IN ('trialing', 'active') AND sub.current_period_end > now() THEN 1
    WHEN g.expires_at > now() THEN 2
    WHEN s.trial_started_at > now() - interval '14 days' THEN 3
    ELSE 4
  END,
  u.created_at DESC;

REVOKE ALL ON public.admin_user_tiers FROM anon, authenticated;

-- ── 7. 🔴 PRIVILEGES — THE FINDING, NOT THE TASK ────────────────────────────
--
-- The brief asked: "users must not be able to set is_internal on their own row. Confirm
-- the user_settings update policy blocks it; fix if not." IT DOES NOT, and the same hole
-- already applies to `is_admin`, which is worse.
--
-- Measured 2026-11-11:
--   · RLS IS enabled on user_settings, so writes are confined to the caller's own row;
--   · the UPDATE policy is `USING (auth.uid() = id)` with **with_check = NULL**, and
--     Postgres reuses USING as the check when WITH CHECK is absent;
--   · `pg_class.relacl` holds `authenticated=arwdDxtm/postgres` — a TABLE-level UPDATE
--     grant — and `pg_attribute.attacl` is NULL on every column;
--   · there are ZERO triggers on the table.
--
-- So any signed-in user could run
--     update user_settings set is_admin = true where id = auth.uid();
-- and `resolveTier` would return {tier:'paid', reason:'admin'} — paid features plus the
-- admin-only surfaces. PRE-EXISTING, not introduced here. `anon` cannot: the policy needs
-- `auth.uid() = id`.
--
-- 🔴 AND MY FIRST FIX WAS INERT. I wrote
--     revoke update (is_admin, is_internal, internal_reason) ... from anon, authenticated;
-- which does nothing. **Column privileges in Postgres are ADDITIVE, not subtractive**: a
-- column REVOKE removes a column-level grant, and there are none. Postgres checks the
-- table privilege first and never consults the column ACLs, so
-- `has_column_privilege('authenticated','user_settings','is_admin','UPDATE')` would still
-- return TRUE and the escalation would still work.
-- ⚠️ I ALSO MIS-READ MY OWN EVIDENCE: `information_schema.column_privileges` listing all
-- 45 columns is the EXPANSION of one table-level grant, not 45 column grants.
--
-- Two real options: (a) revoke table UPDATE and re-grant the other 43 columns — correct,
-- and brittle, because every future column then needs grant bookkeeping and forgetting one
-- silently breaks a write; or (b) a BEFORE UPDATE trigger that reverts the privileged
-- columns for anyone who is not the service role. (b) is chosen: self-maintaining, and the
-- repo already uses a trigger for `on_auth_user_deleted`.
--
-- It REVERTS rather than raising, so a client PATCHing a whole row still succeeds on the
-- columns it may change; the privileged ones simply do not move. Raising would turn an
-- ordinary profile save into an error.
-- 🔴 DELIBERATELY *NOT* `SECURITY DEFINER`, and my first cut of this trigger was.
-- Inside a SECURITY DEFINER function `current_user` is the function's OWNER (postgres),
-- not the caller — so the guard below would have evaluated `'postgres' not in
-- ('postgres',...)` = false on EVERY update and never fired once. An inert fix for an
-- inert fix. A trigger that only rewrites NEW needs no elevated rights, so INVOKER (the
-- default) is both correct and what makes `current_user` mean the caller.
create or replace function public.guard_privileged_user_settings()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  -- Under PostgREST the request role IS the current role: `authenticated` for a signed-in
  -- client, `service_role` for our server. With INVOKER security this is the caller.
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    new.is_admin        := old.is_admin;
    new.is_internal     := old.is_internal;
    new.internal_reason := old.internal_reason;
  end if;
  return new;
end
$fn$;

comment on function public.guard_privileged_user_settings() is
  'INTERNAL-ACCOUNTS-01: is_admin / is_internal / internal_reason are not client-writable. '
  'Column REVOKE cannot do this — column privileges are additive and do not subtract from a '
  'table grant — so the values are reverted here for any non-service role.';

drop trigger if exists guard_privileged_user_settings on public.user_settings;
create trigger guard_privileged_user_settings
  before update on public.user_settings
  for each row execute function public.guard_privileged_user_settings();

-- The policy's WITH CHECK is added so the ROW rule states its intent rather than relying
-- on Postgres reusing USING. It cannot see OLD, so it never guarded the columns; the
-- trigger above is what does.
--
-- ⚠️ VERIFIED BEFORE DROPPING: the live policy's `cmd` is `UPDATE` (read from
-- `pg_policies`, 2026-11-11), so narrowing to `FOR UPDATE` removes nothing. Had it been
-- `FOR ALL` this would have silently cut users' SELECT and INSERT path to their own row.
drop policy if exists "Users can update own settings" on public.user_settings;
create policy "Users can update own settings" on public.user_settings
  for update using (auth.uid() = id) with check (auth.uid() = id);

commit;

-- ── Verification, to run AFTER applying ─────────────────────────────────────
-- Full procedure, with the measured before-values: docs/runbooks/internal-accounts.md
--
--   select count(*) from user_settings where is_internal;                    -- 18
--   select count(*) from v_metric_users;                                     -- 37
--   select count(*) from v_trial_conversion;                                 -- 56 (UNCHANGED, by design)
--   select count(*) from v_trial_conversion where not is_internal;           -- 38 (the honest denominator)
--   select count(distinct user_id) from v_coach_engagement;                   -- 16 (was 21)
--   select hr_present_pct from v_hr_present_pct;                             -- 73.0 (was 74.0)
--
-- ⚠️ AND THE PRIVILEGE FIX MUST BE CHECKED AS A WRITE, not with
-- `has_column_privilege`: the table grant is deliberately untouched, so that function
-- still returns TRUE. The trigger is what blocks the change.
--
--   -- as an ordinary signed-in user, via PostgREST:
--   --   patch /rest/v1/user_settings?id=eq.<self>  {"is_admin": true}
--   -- then, as service_role:
--   select is_admin from user_settings where id = '<that user>';             -- still false
