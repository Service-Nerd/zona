-- GTM-CHARITY-05 + GTM-CHARITY-06 (2026-09-20)
--
-- ── 05: admin_user_tiers did not know charity grants exist ─────────────────
--
-- `lib/trial.ts → resolveTier` is documented as THE SINGLE OWNER of the order
--   admin → active subscription → charity grant → trial → free
-- and its header comment exists precisely because that order once lived in
-- three places and drifted (TIER-OWNER-01). This view was a FOURTH copy, and
-- its CASE stopped at admin → subscription → trial → free. It never read
-- charity_codes at all.
--
-- Consequence at 500 comped runners: every one of them reads 'free' or 'trial'
-- in every admin and reporting surface, and `v_trial_conversion` (a LEFT JOIN
-- on anyone with a trial_started_at) counts them as UNCONVERTED TRIALS — which
-- would make trial→paid look worse than it is for a whole season.
--
-- ⚠️ D-16 (no parallel semantics) — WHY A VIEW IS ALLOWED TO RESTATE THE RULE.
-- It is not, strictly. SQL cannot import `resolveTier`, so this is a knowing
-- duplicate that must be kept in step by hand. The mitigation is that the
-- duplicate is now NAMED: `tierResolutionParity.test.ts` reads this file and
-- fails if the arms here drift from `lib/trial.ts`. A comment asking the next
-- person to remember was the previous mitigation, and it is what produced this
-- defect.
--
-- ⚠️ The grant arm sits BETWEEN subscription and trial, matching resolveTier
-- exactly: a runner who later pays is resolved by their subscription, not by a
-- grant they still hold.

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
  -- GTM-CHARITY-05: the grant, so a comped runner is legible as comped rather
  -- than as a lapsed trial. `reason` in resolveTier exists for the same reason.
  g.expires_at            AS grant_expires,
  b.partner_name          AS grant_partner,
  s.trial_started_at,
  s.is_admin,
  u.created_at            AS signed_up,
  u.last_sign_in_at
FROM auth.users u
LEFT JOIN public.user_settings s   ON s.id = u.id
LEFT JOIN public.subscriptions sub ON sub.user_id = u.id
-- One grant per user is enforced by a unique index on claimed_by, so this
-- cannot fan out.
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

-- ── 06: per-partner reporting ──────────────────────────────────────────────
--
-- The partnership will ask "how did it go" and nothing could answer it. All
-- six metrics were already derivable; none of the six admin views joined
-- charity_batches.
--
-- ⚠️ TWO CAVEATS SHIP IN THE VIEW ITSELF, as column names, not in a covering
-- note somebody forgets to read. Reporting either number to a partner without
-- its caveat is the overclaim class this repo keeps catching.
--
--   `signed_in_last_7d` is a SIGN-IN, not an app open. `auth.users.last_sign_in_at`
--   is the only signal that exists — there is no app-open event to count
--   (lib/analytics.ts declares exactly one event name, `coach_open`). A runner
--   who uses the app daily on a live session increments nothing here.
--
--   `healthkit_accepted_upper_bound` records that the permission SHEET was
--   accepted. iOS does not let the app distinguish that from a silent denial,
--   so it is an UPPER BOUND on connected runners and must never be reported as
--   "connected".

CREATE OR REPLACE VIEW public.v_partner_cohort AS
SELECT
  b.id                                   AS batch_id,
  b.partner_name,
  b.cap,
  b.revoked_at,
  count(c.id)                            AS codes_minted,
  count(c.claimed_at)                    AS codes_redeemed,
  -- Claimed seats whose grant has not yet lapsed.
  count(*) FILTER (WHERE c.expires_at > now())            AS grants_active,
  -- A claimed seat whose user row is gone. GTM-CHARITY-07: the seat stays
  -- spent, so redeemed and active can legitimately differ by these.
  count(*) FILTER (WHERE c.claimed_at IS NOT NULL
                     AND c.claimed_by IS NULL)            AS seats_claimed_user_deleted,
  count(DISTINCT p.user_id)                               AS runners_with_a_plan,
  count(DISTINCT sc.user_id)                              AS runners_logging_sessions,
  count(DISTINCT us.id) FILTER (WHERE us.healthkit_connected_at IS NOT NULL)
                                                          AS healthkit_accepted_upper_bound,
  count(DISTINCT au.id) FILTER (WHERE au.last_sign_in_at > now() - interval '7 days')
                                                          AS signed_in_last_7d
FROM public.charity_batches b
LEFT JOIN public.charity_codes   c  ON c.batch_id = b.id
LEFT JOIN auth.users             au ON au.id = c.claimed_by
LEFT JOIN public.user_settings   us ON us.id = c.claimed_by
LEFT JOIN public.plans           p  ON p.user_id = c.claimed_by
LEFT JOIN public.session_completions sc ON sc.user_id = c.claimed_by
GROUP BY b.id, b.partner_name, b.cap, b.revoked_at
ORDER BY b.created_at DESC;

REVOKE ALL ON public.v_partner_cohort FROM anon, authenticated;
