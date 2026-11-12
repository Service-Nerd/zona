-- ACT-EMAIL-DAY14-01 + ACT-EMAIL-POSTTRIAL-01 — Release 2 of the activation brief.
--
-- 📐 WHY. `ops_events.email_sent`, by subject: **"Fourteen days, no runs read." went out 13
-- times of 16**. The last thing most trial runners heard from Zonna was a count of zero, in a
-- mail asking them to pay for reads. And nothing at all is sent after day 14.
--
-- Three columns, one per fact we currently cannot answer:
--   · `trial_extended_at`      — they took the extra seven days offered at day 14 (once, ever)
--   · `trial_email_day17_sent_at`
--   · `trial_email_day30_sent_at`
--
-- ⚠️ STAMPS, NOT BOOLEANS, like the two that already exist. A timestamp answers "did we send
-- it" and "when", and the second question is the one you want three months later when somebody
-- asks why a runner got two of something.
--
-- ⚠️ NO GRANT BLOCK: `user_settings` is a pre-2026-10-30 table and keeps its existing Data API
-- access (MIGRATION-GRANTS-01 covers tables CREATED from that date). The new columns inherit
-- the table's privileges, and the `guard_privileged_user_settings` trigger from
-- INTERNAL-ACCOUNTS-01 deliberately does NOT cover them: a runner extending their own trial is
-- the feature, where setting their own `is_admin` was the escalation.

alter table public.user_settings
  add column if not exists trial_extended_at          timestamptz,
  add column if not exists trial_email_day17_sent_at  timestamptz,
  add column if not exists trial_email_day30_sent_at  timestamptz;

comment on column public.user_settings.trial_extended_at is
  'ACT-EMAIL-DAY14-01 — the runner accepted the seven extra days offered at day 14. One-time: '
  'the route refuses a second extension. Read by resolveTrialWindow().';
comment on column public.user_settings.trial_email_day17_sent_at is
  'ACT-EMAIL-POSTTRIAL-01 — day-17 post-trial email (extend or summarise).';
comment on column public.user_settings.trial_email_day30_sent_at is
  'ACT-EMAIL-POSTTRIAL-01 — day-30 email: one question, no follow-up.';
