-- SUBS-COMPED-CONVERSION-01 (2026-09-28) — a free offer-code entitlement must not
-- read as a paying conversion.
--
-- 🔴 THE DEFECT, FOUND BY THE SLT SITTING RATHER THAN BY A SYMPTOM.
-- `v_trial_conversion` defines converted_real as "has a subscriptions row and is not
-- an admin", and excludes charity runners from the denominator by joining
-- `charity_codes`. Both were correct while charity access was a Supabase grant, which
-- deliberately writes NO subscriptions row.
--
-- Apple offer codes change that. A redeemed code now lands a real `subscriptions` row
-- (status active, period_end a year out) via `/api/subscriptions/reconcile`, and the
-- runner has no `charity_codes` row at all. So:
--
--   converted_real     -> TRUE   (they have a subscriptions row)
--   had_charity_grant  -> FALSE  (no charity_codes row, so NOT excluded)
--
-- ⚠️ **500 FREE MAKE-A-WISH RUNNERS WOULD HAVE READ AS 500 PAYING CONVERSIONS**, and
-- the founder's 1 January trial-to-paid gate (5%) would have reported ~100%. Today's
-- two test redemptions are already in the view and are only excluded by accident,
-- because `looks_like_test` matches their `%test%` emails.
--
-- 📐 THE DISCRIMINATOR IS IN THE PAYLOAD AND WAS MEASURED, NOT ASSUMED. Both real
-- redemptions carry `price: { amount: 0 }` and `period_type: "trial"` in RevenueCat's
-- subscriber object, where a paying subscriber reads `normal`. So the writer can know.
--
-- ⚠️ WHY A COLUMN AND NOT A DERIVED RULE. The tempting version reads the ops trail:
-- every offer-code runner has a `revenuecat_reconciled` row. That is the POPULATION
-- failure this repo keeps paying for — a runner who redeems while ALREADY holding an
-- account arrives through the WEBHOOK, not through reconcile, and has no such row. The
-- flag therefore lives on the row itself and is written by both writers, which is why
-- it goes through `apply_subscription_event` rather than either route directly.

-- ── 1. the flag ──────────────────────────────────────────────────────────────
alter table public.subscriptions
  add column if not exists is_comped boolean not null default false;

comment on column public.subscriptions.is_comped is
  'TRUE when this entitlement was granted at no charge (an Apple offer code, or a '
  'promotional entitlement). Excluded from v_trial_conversion. Written only via '
  'apply_subscription_event.';

-- ── 2. the single writer gains the flag ──────────────────────────────────────
--
-- ⚠️ THE OLD 5-ARG SIGNATURE IS DROPPED ON PURPOSE. Adding a parameter creates a
-- SECOND function rather than replacing the first, and leaving both callable is an
-- overload-ambiguity trap. Because the new parameter has a DEFAULT, existing 5-argument
-- callers (the Stripe webhook, and any deploy still in flight) resolve to the new
-- function unchanged — so there is no window in which production calls a function that
-- does not exist.
drop function if exists public.apply_subscription_event(uuid, text, text, timestamptz, timestamptz);

create or replace function public.apply_subscription_event(
  p_user_id    uuid,
  p_provider   text,
  p_status     text,
  p_period_end timestamptz,
  p_event_at   timestamptz,
  p_is_comped  boolean default false
) returns boolean
language plpgsql
as $$
declare
  v_count integer;
begin
  insert into public.subscriptions as s
    (user_id, provider, status, current_period_end, last_event_at, is_comped, updated_at)
  values
    (p_user_id, p_provider, p_status, p_period_end, p_event_at, p_is_comped, now())
  on conflict (user_id) do update
    set provider           = excluded.provider,
        status             = excluded.status,
        current_period_end = excluded.current_period_end,
        last_event_at      = excluded.last_event_at,
        -- ⚠️ STICKY, AND THAT IS THE DECISION. Once an entitlement is known to be
        -- comped it stays comped unless a later event says otherwise, because the
        -- RENEWAL of a free offer carries no price and would otherwise silently
        -- promote a charity runner into the conversion numerator.
        is_comped          = excluded.is_comped or s.is_comped,
        updated_at         = now()
    where s.last_event_at is null
       or excluded.last_event_at is null
       or s.last_event_at <= excluded.last_event_at;

  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- ── 3. the gate stops counting gifts as sales ────────────────────────────────
--
-- `converted` (RAW) is still untouched, per the 2026-09-25 note: a view that silently
-- changes the meaning of an existing column is worse than one that is wrong visibly.
-- A divergence between `converted` and `converted_real` of more than one now means
-- either an admin or a comped runner, which is exactly what you want to be able to see.
create or replace view public.v_trial_conversion AS
SELECT
  s.id                       AS user_id,
  s.trial_started_at,
  sub.created_at             AS subscribed_at,
  sub.status                 AS sub_status,
  (sub.user_id IS NOT NULL)  AS converted,
  CASE WHEN sub.created_at IS NOT NULL AND s.trial_started_at IS NOT NULL
    THEN round(extract(epoch FROM (sub.created_at - s.trial_started_at)) / 86400.0, 2)
  END                        AS days_trial_to_sub,
  (sub.user_id IS NOT NULL
     AND NOT COALESCE(s.is_admin, false)
     AND NOT COALESCE(sub.is_comped, false))           AS converted_real,
  COALESCE(s.is_admin, false)                          AS is_admin,
  (g.claimed_by IS NOT NULL)                           AS had_charity_grant,
  (u.email ILIKE '%test%' OR u.email ILIKE '%demo%')   AS looks_like_test,
  -- appended, so nothing above it shifts
  COALESCE(sub.is_comped, false)                       AS is_comped
FROM public.user_settings s
JOIN auth.users u ON u.id = s.id
LEFT JOIN public.subscriptions sub ON sub.user_id = s.id
LEFT JOIN public.charity_codes  g  ON g.claimed_by = s.id
WHERE s.trial_started_at IS NOT NULL;

-- PII guard: the view joins auth.users. Keep it off the client.
REVOKE ALL ON public.v_trial_conversion FROM anon, authenticated;

-- THE BASELINE QUERY, UPDATED. `is_comped` joins the exclusion list, because a runner
-- given the app free is not an unconverted trialist any more than a comped one is a sale:
--
--   SELECT count(*) FILTER (WHERE converted_real) AS converted,
--          count(*) FILTER (WHERE NOT is_admin AND NOT had_charity_grant
--                             AND NOT looks_like_test AND NOT is_comped) AS eligible
--   FROM public.v_trial_conversion;
--
-- Expected immediately after applying: converted 0. The two 2026-09-28 test redemptions
-- carry is_comped = FALSE until the code half ships and they are backfilled, and are
-- excluded meanwhile by looks_like_test.
