-- OPS-PAYING-COMPED-01 — `v_paying_users` reports 23 and nobody is paying.
--
-- 📐 MEASURED IN PRODUCTION 2026-11-11, and this is the whole finding:
--   · `select paying_users from v_paying_users` → **23**
--   · subscriptions that are ACTIVE and NOT comped, fleet-wide → **0**
--   · total subscriptions → **24, every one of them comped**
--
-- The tier ladder in `admin_user_tiers` resolves a runner to `premium` on an ACTIVE
-- SUBSCRIPTION and never asks who paid for it. Every subscription in this system today is a
-- Make-A-Wish offer-code redemption, so the headline paying-user number is 23 against a true
-- zero — on the one figure that would be read as revenue traction.
--
-- ⚠️ `v_trial_conversion.converted_real` ALREADY DRAWS THIS LINE (`not coalesce(sub.is_comped,
-- false)`), and `20260928_comped_entitlement_not_a_conversion.sql` exists for exactly this
-- reason. The rule was applied to the conversion metric and not to the count of customers.
--
-- 🔑 THE COMPED COUNT IS EXPOSED, NOT DISCARDED. A charity cohort of 24 is a real and wanted
-- fact; what is wrong is calling it revenue. Two columns, so a reader cannot get the answer by
-- accident, and `GTM-CHARITY-07`'s position — a seat is spent when it was claimed — stays
-- readable beside it.
--
-- ⚠️ DROP FIRST: this adds a column, and `create or replace view` may only APPEND at the end.
-- Appending would work here, but the next edit that reorders would raise `42P16` and apply
-- NOTHING, as INTERNAL-ACCOUNTS-01's review found twice in one morning. Nothing reads this view
-- from the client (it has never been granted to `anon`/`authenticated`), so the drop is free.

drop view if exists public.v_paying_users;

create view public.v_paying_users as
  select
    count(*) filter (
      where t.tier = 'premium'
        and not coalesce(t.is_internal, false)
        -- The runner pays only if some ACTIVE subscription of theirs is not comped.
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

comment on view public.v_paying_users is
  'OPS-PAYING-COMPED-01 — paying_users counts runners with an ACTIVE, NON-COMPED subscription. '
  'comped_users counts the Make-A-Wish / charity cohort separately: real customers, not revenue. '
  'Measured 2026-11-11: 0 paying, 23 comped, where this view used to report 23 paying.';

revoke all on public.v_paying_users from anon, authenticated;
grant select on public.v_paying_users to service_role;
