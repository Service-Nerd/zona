-- EMAIL-WAVE-3 — the one-shot guard for the First-read email.
--
-- `isFirstAnalysis` is computed from `count === 0` BEFORE the upsert, so a
-- retried or re-scored analysis of the same run can present as "first" more than
-- once. The stamp is what makes it once, and it is written only on a real send.

alter table public.user_settings
  add column if not exists first_read_email_sent_at timestamptz;

comment on column public.user_settings.first_read_email_sent_at is
  'EMAIL-WAVE-3. Set only when the First-read email is actually SENT, never on a suppressed or failed send — a suppressed runner who resubscribes must still receive their first read.';
