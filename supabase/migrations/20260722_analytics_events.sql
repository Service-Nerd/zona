-- INSTRUMENT-01: owned analytics baseline (SLT portfolio review 2026-07-22).
--
-- Purpose: enough behavioural measurement to evaluate the numeric gates the
-- backlog already carries (CO-ONE, and — via the report views below — CA-07,
-- MON-TRIAL-01, HR-SYNC sizing). "Own it in Supabase" was chosen over a
-- third-party analytics SDK: no new vendor, no PII beyond the Supabase user id,
-- events are behavioural not content. See docs/contracts/api/analytics-events.md.
--
-- Doctrine notes:
--   * `event` has NO CHECK constraint — new event names ship without a migration.
--     The union is enforced in TypeScript (lib/analytics.ts → AnalyticsEvent),
--     exactly the pattern used by notifications.type (see 20260525_notifications.sql).
--   * `props` is the schema-ready hook for future events (incl. the deferred
--     ENGINE-03 cycle metric) so adding a field never needs a migration. Keep it
--     behavioural — never store PII or content here.
--   * Telemetry is fire-and-forget on the client (lib/analytics.ts): a dropped
--     event must never surface to the user. RLS below lets a client INSERT its
--     own rows but NEVER read them — all analysis runs owner/service-role only.

CREATE TABLE IF NOT EXISTS analytics_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event       TEXT        NOT NULL,                       -- behavioural event name; union in lib/analytics.ts
  props       JSONB       NOT NULL DEFAULT '{}'::jsonb,   -- behavioural metadata only — never PII/content
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Read pattern for the engagement view: a user's events of one type over a window.
CREATE INDEX IF NOT EXISTS analytics_events_user_event_created
  ON analytics_events (user_id, event, created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Clients (authenticated role, anon key + user JWT) may INSERT their own events.
-- There is deliberately NO SELECT / UPDATE / DELETE policy: a client can write
-- telemetry but cannot read any analytics rows. The report views run with owner
-- privileges and are REVOKEd from anon + authenticated (below), mirroring the
-- admin_user_tiers PII posture (20260529_admin_user_tiers.sql).
CREATE POLICY "Users can insert own analytics events"
  ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Report views. Owner/service-role read only — never reachable from the client.
-- Each answers one backlog gate. Three read entirely from pre-existing data
-- (the reframe finding of the 2026-07-22 audit: those gates need a query, not
-- instrumentation); only v_coach_engagement consumes the new events table.
-- ---------------------------------------------------------------------------

-- CA-07 gate ("50+ paying users"). Reuses admin_user_tiers, which resolves the
-- exact getUserTier() order and keeps 'premium' (real payers) distinct from
-- 'admin' (us). Summing 'premium' is real paying customers.
CREATE OR REPLACE VIEW public.v_paying_users AS
SELECT count(*)::int AS paying_users
FROM public.admin_user_tiers
WHERE tier = 'premium';

-- MON-TRIAL-01 baseline (reverse-trial-start -> paid). One row per user who
-- started the in-app 14-day reverse trial, with whether/when a subscription row
-- appeared. `subscribed_at` = subscriptions.created_at (when StoreKit/RevenueCat
-- first granted entitlement — the closest honest "converted" timestamp we hold).
-- Compute the baseline off this: conversion rate = converted / total; median lag
-- = median(days_trial_to_sub). No PII (no email/name) — owner-only regardless.
CREATE OR REPLACE VIEW public.v_trial_conversion AS
SELECT
  s.id                                   AS user_id,
  s.trial_started_at,
  sub.created_at                         AS subscribed_at,
  sub.status                             AS sub_status,
  (sub.user_id IS NOT NULL)              AS converted,
  CASE
    WHEN sub.created_at IS NOT NULL AND s.trial_started_at IS NOT NULL
      THEN round(extract(epoch FROM (sub.created_at - s.trial_started_at)) / 86400.0, 2)
  END                                    AS days_trial_to_sub
FROM public.user_settings s
LEFT JOIN public.subscriptions sub ON sub.user_id = s.id
WHERE s.trial_started_at IS NOT NULL;

-- HR-SYNC sizing ("% of runs with HR at first query"). Reads the columns shipped
-- by HR-SYNC-01 (20260624_hr_sync_instrumentation.sql). Rows predating that
-- migration carry NULL and are excluded from the denominator.
CREATE OR REPLACE VIEW public.v_hr_present_pct AS
SELECT
  count(*) FILTER (WHERE hr_present_at_first_query IS NOT NULL) AS instrumented_runs,
  count(*) FILTER (WHERE hr_present_at_first_query IS TRUE)     AS hr_present_runs,
  count(*) FILTER (WHERE hr_present_at_first_query IS FALSE)    AS hr_absent_runs,
  round(
    100.0 * count(*) FILTER (WHERE hr_present_at_first_query IS TRUE)
    / NULLIF(count(*) FILTER (WHERE hr_present_at_first_query IS NOT NULL), 0),
    1
  )                                                             AS hr_present_pct
FROM public.strava_activities;

-- CO-ONE gate: raw weekly engagement. One row per (user, ISO week) where the
-- user opened Coach, with the count of coach opens and the count of downstream
-- actions that same week. Downstream action = a session_completions write
-- (run logged / session marked done), bucketed on updated_at (the column the
-- completion write path provably sets; created_at is not asserted by the repo).
-- NOTE: this view is deliberately RAW — it applies NO threshold. The CO-ONE
-- "3+ opens with zero downstream action, across >=10% of paid users" logic lives
-- with the CO-ONE feature when it is built, NOT here (keeps coaching numerics out
-- of infra per INV-CFG-003).
CREATE OR REPLACE VIEW public.v_coach_engagement AS
WITH opens AS (
  SELECT user_id,
         date_trunc('week', created_at) AS week,
         count(*)                        AS coach_opens
  FROM public.analytics_events
  WHERE event = 'coach_open'
  GROUP BY user_id, date_trunc('week', created_at)
),
actions AS (
  SELECT user_id,
         date_trunc('week', updated_at) AS week,
         count(*)                        AS downstream_actions
  FROM public.session_completions
  GROUP BY user_id, date_trunc('week', updated_at)
)
SELECT
  o.user_id,
  o.week,
  o.coach_opens,
  COALESCE(a.downstream_actions, 0) AS downstream_actions
FROM opens o
LEFT JOIN actions a ON a.user_id = o.user_id AND a.week = o.week;

-- PII / exposure guard: keep all four views off the client. Only postgres /
-- service_role may read them (same lockdown as admin_user_tiers).
REVOKE ALL ON public.v_paying_users     FROM anon, authenticated;
REVOKE ALL ON public.v_trial_conversion FROM anon, authenticated;
REVOKE ALL ON public.v_hr_present_pct   FROM anon, authenticated;
REVOKE ALL ON public.v_coach_engagement FROM anon, authenticated;
