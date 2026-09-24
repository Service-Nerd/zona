-- CHARITY-CLAIM-RELEASE-01 — a redeemed seat stays spent when the account is deleted.
--
-- FOUNDER DECISION, 2026-09-24: "if a user deletes their account, no, they don't
-- get the seat back."
--
-- ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
--
-- Two shipped decisions cancelled each other out, three days apart.
--
-- GTM-CHARITY-07 (2026-09-20) moved the redeem route's gate from `claimed_by` to
-- `claimed_at` SPECIFICALLY BECAUSE `claimed_at` survives account deletion —
-- closing the redeem -> delete -> re-redeem path. Its own words: "THE SEAT IS
-- SPENT WHEN IT WAS CLAIMED, NOT WHILE THE CLAIMANT STILL EXISTS... NO MIGRATION,
-- AND THAT IS THE POINT." It explicitly rejected a `released_at` column as a
-- second answer to a question the schema could already answer.
--
-- DB-USER-PURGE-01 (2026-09-23) then added `purge_user_side_channels()`, which
-- did `update charity_codes set claimed_at = null where claimed_by = old.id`,
-- arguing "the batch cap stays spent on a runner who is gone."
--
-- The later change silently reopened the exact path the earlier one closed.
-- NEITHER AUTHOR WAS WRONG in isolation — and nothing caught it, because no test
-- asserts the interaction and the two live in a route and a migration that never
-- reference each other.
--
-- Observed in production before this migration: two of three codes read
-- `claimed_by = NULL, claimed_at = NULL` with `expires_at` STILL POPULATED — a
-- half-cleared row, redeemable again, with an expiry belonging to a claim that no
-- longer existed. That is the "batch redemption count drifts DOWN over a season"
-- symptom GTM-CHARITY-07 named, observed.
--
-- ── WHY REMOVING A LINE FROM AN ERASURE PATH IS SAFE ─────────────────────────
--
-- This function is the GDPR Art.17 side-channel purge, so taking a line OUT of it
-- needs justifying rather than assuming.
--
-- After this change a deleted user's code row retains `claimed_at` and
-- `expires_at`, and BOTH ARE TIMESTAMPS. `claimed_by` is still set to NULL by the
-- foreign key, which is what carries the identity. So no personal identifier
-- survives: the row asserts "this seat was used on date X", which is the CHARITY
-- BATCH's own record of its own capacity, not the runner's personal data.
-- Art.17 governs personal data; a de-identified seat-consumption fact is not it.
--
-- `ai_rate_limits` and `waitlist` are unchanged — both are genuinely keyed to the
-- person (a uuid inside a text bucket key, and an email address), so both must
-- still be cleared.

create or replace function public.purge_user_side_channels()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- 'ai:<surface>:<uuid>' in a text column — nothing for an FK to hold onto, and
  -- the uuid IS the person, so it goes.
  delete from public.ai_rate_limits
   where bucket_key like '%:' || old.id::text;

  -- 🔴 `charity_codes.claimed_at` IS DELIBERATELY NOT CLEARED HERE.
  --
  -- It was, until 2026-09-24, and that reopened redeem -> delete -> re-redeem
  -- (CHARITY-CLAIM-RELEASE-01). A seat is spent when it was claimed, not while
  -- the claimant still exists. The FK nulls `claimed_by`, which removes the
  -- identity; `claimed_at` remains as the batch's own record that capacity was
  -- used, and the redeem route gates on it.
  --
  -- ⚠️ IF YOU ARE ADDING A CLEAR BACK HERE, you are reversing a founder decision
  -- and reopening a known abuse path. The cost of NOT clearing it — a charity's
  -- cap staying spent on a runner who is gone — was accepted explicitly, not
  -- overlooked.

  -- Email-keyed, so no FK reaches it. Deleting the account and then mailing the
  -- address about the launch is the failure this prevents.
  if old.email is not null then
    delete from public.waitlist where lower(email) = lower(old.email);
  end if;

  return old;
end;
$$;

revoke all on function public.purge_user_side_channels() from public;

comment on function public.purge_user_side_channels() is
  'DB-USER-PURGE-01, amended by CHARITY-CLAIM-RELEASE-01 (2026-09-24) — clears the user-scoped stores no FK to auth.users can reach: ai_rate_limits (uuid inside a text bucket key) and waitlist (email-keyed). charity_codes.claimed_at is deliberately NOT cleared: the FK removes the identity via claimed_by, and the timestamp remains as the batch''s record that a seat was spent (founder decision 2026-09-24).';
