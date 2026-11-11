# Runbook — apply `INTERNAL-ACCOUNTS-01` (internal-account flag)

**Migration:** `supabase/migrations/20261111_internal_accounts.sql`
**Status: ✅ APPLIED 2026-11-11** by the founder, and verified from here (reads). Everything below is handed over because **a production
WRITE and DDL are refused from the assistant's sandbox** — PostgREST cannot run DDL and the CLI is
not linked. Reads were used throughout to verify.

## 1. Apply

Paste the migration into the **Supabase SQL editor** (project `wkppmpsvqkaxbekdgzdm`) and run it.
It is wrapped in `begin; … commit;` and is idempotent on the DDL (`add column if not exists`).

It carries **two assertions that abort the transaction**, so a wrong state cannot half-apply:

- **the brief's own gate** — if any of the 18 ids holds a comped (Make-A-Wish) subscription it
  raises and stops. Verified clear at write time: 24 comped subscriptions exist overall and none
  belongs to the 18, so the zero is not an empty-population pass;
- **a count check** — it raises unless exactly 18 rows end up flagged.

## 2. Verify — each line must return the stated value

```sql
select count(*) from user_settings where is_internal;                      -- 18
select internal_reason, count(*) from user_settings
  where is_internal group by 1 order by 1;      -- app_review_or_demo 5, tester/friend 13
select count(*) from v_metric_users;                                      -- 37  (56 users - 18 internal - 1 admin)
select count(*) from v_trial_conversion;                                  -- 56  UNCHANGED, by design
select count(*) from v_trial_conversion where not is_internal;            -- 38  the honest denominator
select count(distinct user_id) from v_coach_engagement;                    -- 15  (was 21)
select hr_present_pct from v_hr_present_pct;                              -- 77.2 (was 74.0)
select codes_redeemed, runners_with_a_plan from v_partner_cohort
  where batch_id = '7c2ae3a2-506b-46b0-ab59-613738e247d7';                -- 1, 0  (was 1, 1)
```

🔴 **`v_trial_conversion`'s ROW COUNT DOES NOT CHANGE, and the first write-up said it went 56 → 38.**
That view is row-per-trialling-user and deliberately keeps the internal rows so an analyst can SEE the
difference; the exclusion lives in `converted_real` and in the new `is_internal` column. **38 is the
count of a query that adds `where not is_internal`, not of the view.** Corrected after code review.
⚠️ Anything that reports a trial denominator must add that clause — including the 1 January
trial-to-paid gate, which `lib/analytics.ts` records as reading this view.

⚠️ **The before-values are measured. TWO OF THE AFTER-VALUES WERE PREDICTED WRONG AND ARE
CORRECTED ABOVE** — I first wrote 16 and 73.0. I simulated the fix by subtracting the **18 internal
ids**, while the shipped `v_metric_users` subtracts internal **AND admin**. There is 1 admin, with
**97 activities at 45.5% HR-present**, so excluding them moves coach runners 16 → 15 and *raises*
HR-present 73.0 → 77.2. **The view is correct; my simulation used a weaker predicate than the code
I shipped.** Verified against the applied migration.

🔑 Worth noting on its own: the admin account was dragging the ADR-011 §5 HR-present figure down
by **4.2 percentage points**.

## 3. Verify the privilege fix — the part that matters most

🔴 **DO NOT USE `has_column_privilege` HERE. It returns `true` before AND after, so it proves
nothing** — which is exactly the trap `/build` § 4b warns about, and the first draft of this runbook
fell into it. The table-level UPDATE grant is deliberately left in place (revoking it would mean
re-granting the other 43 columns and re-doing that bookkeeping on every future column), so
`has_column_privilege('authenticated','user_settings','is_admin','UPDATE')` is `true` either way.
**Column privileges in Postgres are ADDITIVE: a column REVOKE cannot subtract from a table grant.**

The mechanism is a BEFORE UPDATE trigger, so **verify it as a WRITE**:

```sql
-- 1. confirm the trigger exists and is INVOKER (not SECURITY DEFINER — inside a definer
--    function `current_user` is the OWNER and the guard would never fire):
select tgname from pg_trigger where tgrelid = 'public.user_settings'::regclass
  and not tgisinternal;                                      -- guard_privileged_user_settings
select prosecdef from pg_proc where proname = 'guard_privileged_user_settings';   -- false
```

Then, as an ordinary signed-in user through PostgREST (not the service role, which is allowed):

```
PATCH /rest/v1/user_settings?id=eq.<that user's own id>
{ "is_admin": true }
```

and read it back **as `service_role`**:

```sql
select is_admin from user_settings where id = '<that user>';  -- still false
```

✅ **WHAT I VERIFIED FROM HERE (reads only), 2026-11-11 after the apply:** the trigger
`guard_privileged_user_settings` exists on `user_settings`, `tgtype = 19` (BEFORE + FOR EACH ROW +
UPDATE), `prosecdef = false` (INVOKER, so `current_user` is the caller and not the owner), its body
names all three columns, it exempts `service_role`, and the UPDATE policy now carries a
`WITH CHECK`.

🔴 **WHAT I CANNOT VERIFY FROM HERE, AND IT IS THE DECISIVE ONE: that a real client's PATCH is
actually reverted.** In a plain SQL session `auth.uid()` is NULL, so `set role authenticated` plus an
update is blocked by RLS for a DIFFERENT reason and would pass for the wrong reason — a false
positive, which is worse than no test. The write test above needs a real signed-in JWT. **Until
someone runs it, the escalation is closed by construction and unproven by experiment.**

🔴 **Before this migration that PATCH would have SUCCEEDED** and `resolveTier` would have
returned `{tier:'paid', reason:'admin'}`. If `is_admin` comes back `true`, **stop and say so**: the
escalation is still open.

## 4. Then, in the repo

1. Append the basename to `.claude/state/applied-migrations.txt`, or every session warns.
2. Update `lib/contracts/tableColumns.ts`: add `is_internal` + `internal_reason` to
   `user_settings`, and to the `admin_user_directory` and `admin_user_tiers` column lists.
   ⚠️ **Not before the apply** — that manifest's job is to say what the table ACTUALLY has, so
   `npm run check:db` reports drift until both sides agree.
3. `npm run check:db` → clean.

## 5. Rollback

```sql
begin;
revoke is not reversible by this script -- re-grant only if something genuinely needs it:
--   grant update (is_admin, is_internal, internal_reason) on public.user_settings to authenticated;
-- ⚠️ DO NOT re-grant without reading §3: it reopens the privilege escalation.
alter table public.user_settings drop column if exists internal_reason;
alter table public.user_settings drop column if exists is_internal;
commit;
```

⚠️ **Dropping `is_internal` while the views reference it will fail — replace the views first.**

Every prior definition IS in git, so a rollback re-runs the view block of the migration that last
defined each one.

🔴 **I got this table wrong TWICE.** First I wrote that the definitions were not in git at all.
Then I built the table with `grep -rl "<view>"`, which matches any file that MENTIONS the view — so
2 of the 6 rows named a migration that defines no such view. The correct query matches a
DEFINITION: `grep -rliE 'create (or replace )?view (public\.)?<view>\b'`. **The mention-versus-
definition confusion, three times in one day.**

| view | re-run the view block from |
|---|---|
| `v_trial_conversion` | `20260928_comped_entitlement_not_a_conversion.sql` |
| `admin_user_tiers` | `20260920_charity_tier_and_partner_cohort.sql` |
| `v_partner_cohort` | `20260920_charity_tier_and_partner_cohort.sql` |
| `v_coach_engagement` | `20260722_analytics_events.sql` |
| `v_hr_present_pct` | `20260722_analytics_events.sql` |
| `admin_user_directory` | `20260528_admin_user_directory.sql` |

`v_metric_users` is new, so `drop view if exists public.v_metric_users;` completes the rollback.
