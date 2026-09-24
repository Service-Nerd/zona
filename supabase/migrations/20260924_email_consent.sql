-- EMAIL-WAVE-0 — consent, suppression and an unsubscribe path.
--
-- 🔴 WHY THIS IS TRANCHE 0 AND BLOCKS EVERYTHING ELSE (SLT, 2026-09-24).
-- Zonna has sent 35 emails with NO unsubscribe link, no `List-Unsubscribe`
-- header, and no consent record anywhere in the schema. The trial notices are
-- defensible as contractual; the Pattern email in the approved programme is
-- unambiguously marketing and is not. No further email ships before this.
--
-- ── WHY A TOKEN COLUMN AND NOT A SIGNED USER ID ──────────────────────────────
-- An unsubscribe link carrying a user id is enumerable: anyone can unsubscribe
-- anyone. Signing it would need a new server secret, which is a second thing to
-- configure and forget. A random per-user token is unguessable, needs no secret,
-- and is the standard shape.
--
-- ── ONE UNSUBSCRIBE STOPS EVERYTHING, DELIBERATELY ───────────────────────────
-- The law would let us keep sending service messages about their own account.
-- We are not going to. A runner who asks us to stop and then receives "your
-- coaching pauses today" has been told their preference is negotiable. Trial
-- state stays visible IN THE APP, which is where it belongs anyway.

alter table public.user_settings
  -- Set the moment they unsubscribe. NULL means subscribed. A timestamp rather
  -- than a boolean because "when did they opt out" is the question anyone
  -- debugging a complaint actually asks.
  add column if not exists email_unsubscribed_at timestamptz,

  -- Random, unguessable, stable for the life of the account. Generated for every
  -- existing row by the DEFAULT, so no backfill step and no rows without one.
  add column if not exists email_unsubscribe_token uuid not null default gen_random_uuid();

-- The unsubscribe route looks a user up BY TOKEN and nothing else, so this index
-- is the whole access path, not an optimisation.
create unique index if not exists user_settings_email_unsubscribe_token_idx
  on public.user_settings (email_unsubscribe_token);

comment on column public.user_settings.email_unsubscribed_at is
  'EMAIL-WAVE-0. Non-null = send nothing, including trial notices. One unsubscribe stops everything (SLT 2026-09-24).';
comment on column public.user_settings.email_unsubscribe_token is
  'EMAIL-WAVE-0. Unguessable per-user token carried in the unsubscribe link. Never the user id: that link is enumerable.';
