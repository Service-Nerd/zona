-- INTERNAL-ACCOUNTS-01 (part 3, completion) — `v_paying_users` excludes `is_internal`.
--
-- 🔴 WHY THIS IS A SECOND MIGRATION AND NOT A CORRECTION OF THE FIRST.
-- `20261111_internal_accounts.sql` is applied. It filed `v_paying_users` in the
-- gate's NOT_A_USER_METRIC list with this reason:
--
--   "Counts TIERS, not users: `count(*) from admin_user_tiers where tier = premium`.
--    Admins and internal accounts are excluded as a side effect of the tier ladder,
--    so a where clause here would be wrong rather than redundant."
--
-- ⚠️ THAT REASON IS HALF TRUE AND THE FALSE HALF IS THE ONE THE BRIEF ASKED ABOUT.
-- An ADMIN is excluded BY CONSTRUCTION: `resolveTier`'s order puts admin first, so an
-- admin reads tier='admin' and can never read 'premium'. **An INTERNAL account is
-- excluded by nothing.** The flag grants and removes nothing (deliberately — testers
-- keep full access), so an internal account reads whatever its real tier is. Measured
-- in production 2026-11-11:
--
--   tier      n   internal  admin
--   admin     1   0         1
--   free     27   17        0
--   grant     1   1         0      <- test13@test.com, charity code 37G94M6Y
--   premium  23   0         0
--   trial     4   0         0
--
-- So `v_paying_users` = 23 is clean TODAY, and clean only because no internal account
-- happens to hold a subscription. One tester on a real subscription, or one comped
-- Apple offer code landing on an internal id, and the headline paying-user number is
-- wrong with nothing to say so. **The brief named this view explicitly.** A latent
-- defect with a documented reason for not fixing it is the shape this repo keeps
-- paying for, and the reason was wrong.
--
-- 📐 THIS CHANGES NOTHING TODAY: 23 before, 23 after. That is the point — it makes the
-- rule STRUCTURAL rather than true by accident, and the gate can then see it.
--
-- ⚠️ COLUMN LIST UNCHANGED, so `create or replace view` is legal here. `42P16` is
-- raised only when a replace reorders or inserts columns; this view has one column and
-- keeps it. (The first migration's review found two mid-list insertions that would have
-- aborted the whole file.)

create or replace view public.v_paying_users as
  select count(*)::integer as paying_users
  from public.admin_user_tiers
  where tier = 'premium'
    -- INTERNAL-ACCOUNTS-01: admin is already excluded by the tier ladder (an admin
    -- reads tier='admin'); is_internal is not, so it is excluded here.
    and not coalesce(is_internal, false);

-- The view reads `admin_user_tiers`, which exposes email and name. It has never been
-- client-readable and must stay that way; a replace preserves the ACL, and this is
-- belt-and-braces for the case where someone re-creates it by hand.
revoke all on public.v_paying_users from anon, authenticated;
grant select on public.v_paying_users to service_role;
