-- Migration: admin_user_tiers view
-- A single at-a-glance roster of every user and their billing tier.
--
-- The `tier` column mirrors the resolution order in lib/trial.ts → getUserTier()
-- EXACTLY:  admin → active subscription → trial window → free.
-- One deliberate difference: the app collapses (admin, premium) into 'paid';
-- this view keeps them DISTINCT so we can see owner/comp accounts separately
-- from genuine paying customers. If you sum 'premium' you get real revenue;
-- 'admin' is us.
--
--   admin    → user_settings.is_admin = true            (owner/dev/support; us)
--   premium  → subscriptions.status IN ('trialing','active')
--                AND current_period_end > now()          (paying / RevenueCat trial)
--   trial    → trial_started_at within the reverse-trial window (everything, free)
--   free     → trial expired or never started            (downgraded)
--
-- NOTE — the 14 below mirrors TRIAL_DAYS in lib/trial.ts. SQL can't import the
-- constant; if TRIAL_DAYS ever changes, change it here too (grep TRIAL_DAYS).
--
-- 'trialing' appears in BOTH the premium branch (a RevenueCat-backed store trial,
-- which has a subscription row) and conceptually overlaps the reverse-trial. They
-- are different things: our 14-day reverse trial has NO subscription row — it is
-- driven purely by user_settings.trial_started_at. A store 'trialing' row means
-- StoreKit/RevenueCat granted entitlement, so it resolves as premium. Correct.
--
-- Read this from the Supabase SQL/Table editor (postgres / service-role only).
-- It exposes PII (email, name) and runs with owner privileges to read auth.users,
-- so SELECT is REVOKEd from anon + authenticated — never reachable from the client.

CREATE OR REPLACE VIEW public.admin_user_tiers AS
SELECT
  u.id,
  CASE
    WHEN COALESCE(s.is_admin, false) THEN 'admin'
    WHEN sub.status IN ('trialing', 'active')
         AND sub.current_period_end > now() THEN 'premium'
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
  -- whole days left in the reverse trial; NULL once expired / never started
  CASE
    WHEN s.trial_started_at > now() - interval '14 days'
      THEN ceil(extract(epoch FROM (s.trial_started_at + interval '14 days' - now())) / 86400)::int
    ELSE NULL
  END AS trial_days_left,
  sub.provider            AS sub_provider,   -- 'revenuecat' | 'stripe' | NULL
  sub.status              AS sub_status,     -- trialing|active|cancelled|expired|NULL
  sub.current_period_end  AS sub_renews,
  s.trial_started_at,
  s.is_admin,
  u.created_at            AS signed_up,
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.user_settings s   ON s.id = u.id
LEFT JOIN public.subscriptions sub ON sub.user_id = u.id
ORDER BY
  -- group by tier for the glance: admin, premium, trial, free
  CASE
    WHEN COALESCE(s.is_admin, false) THEN 0
    WHEN sub.status IN ('trialing', 'active') AND sub.current_period_end > now() THEN 1
    WHEN s.trial_started_at > now() - interval '14 days' THEN 2
    ELSE 3
  END,
  u.created_at DESC;

-- PII guard: keep this view off the client. Only postgres / service_role read it.
REVOKE ALL ON public.admin_user_tiers FROM anon, authenticated;
