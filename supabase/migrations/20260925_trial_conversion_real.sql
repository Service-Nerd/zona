-- OPS-TRIAL-CONV-01 (2026-09-25) — v_trial_conversion counted the founder's own
-- admin row as a paying conversion.
--
-- 🔴 THE DEFECT. This view is what the 1 January trial-to-paid gate (5%) reads.
-- The only `subscriptions` row in production belongs to `russell.j.shear@gmail.com`
-- — a hand-seeded `stripe` row from 2026-04-27 running to 2027-04-27, granting
-- the founder full access. It is not revenue. `admin_user_tiers` resolves that
-- user as `admin` and reports ZERO `premium` users, correctly. This view did not
-- look, so it reported 1 of 31 = 3.2% against a 5% threshold. The honest figure
-- is 0 of 28.
--
-- ⚠️ GTM-CHARITY-05 NAMED THIS EXACT FAILURE AND FIXED ONLY HALF OF IT. Its own
-- migration comment (20260920) reads: "`v_trial_conversion` (a LEFT JOIN on
-- anyone with a trial_started_at) counts them as UNCONVERTED TRIALS — which
-- would make trial→paid look worse than it is for a whole season." The fix
-- landed in `admin_user_tiers` and this view was never touched. The charity half
-- is still live here; the admin half biases the other way and nobody had
-- noticed it at all.
--
-- ⚠️ COLUMNS ARE APPENDED, NOT INSERTED. `CREATE OR REPLACE VIEW` cannot rename
-- or reorder an existing column — the first six must stay exactly as they were,
-- in order. A first attempt put the new columns before `days_trial_to_sub` and
-- failed with 42P16. Keep this order.
--
-- ⚠️ `converted` (RAW) IS KEPT DELIBERATELY. A view that silently changes the
-- meaning of an existing column is worse than one that is wrong in a way you can
-- see. `converted_real` is the number the gate reads; `converted` remains what it
-- always was, and a divergence of more than one between them means the
-- population of subscription-holders has changed.

CREATE OR REPLACE VIEW public.v_trial_conversion AS
SELECT
  -- ── the six existing columns, in their existing order ──────────────────────
  s.id                       AS user_id,
  s.trial_started_at,
  sub.created_at             AS subscribed_at,
  sub.status                 AS sub_status,
  (sub.user_id IS NOT NULL)  AS converted,
  CASE WHEN sub.created_at IS NOT NULL AND s.trial_started_at IS NOT NULL
    THEN round(extract(epoch FROM (sub.created_at - s.trial_started_at)) / 86400.0, 2)
  END                        AS days_trial_to_sub,
  -- ── appended ───────────────────────────────────────────────────────────────
  (sub.user_id IS NOT NULL
     AND NOT COALESCE(s.is_admin, false))              AS converted_real,
  COALESCE(s.is_admin, false)                          AS is_admin,
  (g.claimed_by IS NOT NULL)                           AS had_charity_grant,
  (u.email ILIKE '%test%' OR u.email ILIKE '%demo%')   AS looks_like_test
FROM public.user_settings s
JOIN auth.users u ON u.id = s.id
LEFT JOIN public.subscriptions sub ON sub.user_id = s.id
LEFT JOIN public.charity_codes  g  ON g.claimed_by = s.id
WHERE s.trial_started_at IS NOT NULL;

-- PII guard: the view joins auth.users. Keep it off the client.
REVOKE ALL ON public.v_trial_conversion FROM anon, authenticated;

-- THE BASELINE QUERY, so nobody has to reconstruct it:
--
--   SELECT count(*) FILTER (WHERE converted_real) AS converted,
--          count(*) FILTER (WHERE NOT is_admin AND NOT had_charity_grant
--                             AND NOT looks_like_test) AS eligible
--   FROM public.v_trial_conversion;
--
-- Applied and verified 2026-09-25: converted 0, eligible 28, 4 new columns
-- present, 0 grants to anon/authenticated.
