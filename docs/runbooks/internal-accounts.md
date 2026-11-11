# Runbook — apply `INTERNAL-ACCOUNTS-01` (internal-account flag)

**Migration:** `supabase/migrations/20261111_internal_accounts.sql`
**Status when written:** NOT applied. Everything below is handed over because **a production
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
select count(*) from v_trial_conversion;                                  -- 38  (was 56)
select count(distinct user_id) from v_coach_engagement;                    -- 16  (was 21)
select hr_present_pct from v_hr_present_pct;                              -- 73.0 (was 74.0)
select codes_redeemed, runners_with_a_plan from v_partner_cohort
  where batch_id = '7c2ae3a2-506b-46b0-ab59-613738e247d7';                -- 1, 0  (was 1, 1)
```

⚠️ **The before-values are measured, not predicted** — each was read from production on
2026-11-11 and the after-values were computed by stubbing `is_internal` with the 18 ids.

## 3. Verify the privilege fix — the part that matters most

```sql
select has_column_privilege('authenticated','user_settings','is_admin','UPDATE');     -- false
select has_column_privilege('authenticated','user_settings','is_internal','UPDATE');  -- false
select has_column_privilege('anon','user_settings','is_admin','UPDATE');              -- false
select has_column_privilege('service_role','user_settings','is_admin','UPDATE');      -- true
```

🔴 **Before this migration all four returned `true`.** The UPDATE policy is
`USING (auth.uid() = id)` with no `WITH CHECK`, `authenticated` held table-wide UPDATE on all 45
columns, and there are zero triggers — so a signed-in user could grant themselves admin. If the
first three do not return `false`, **stop and say so**: the escalation is still open.

⚠️ **Each predicate returns a DIFFERENT answer before and after**, which is why they are written as
`has_column_privilege` rather than as a `grep`. A check that returns the same value in both states
proves nothing (`/build` § 4b).

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
defined each one. (I first wrote that they were not in git; that was wrong, and checking took one
command.)

| view | re-run the view block from |
|---|---|
| `v_trial_conversion` | `20260928_comped_entitlement_not_a_conversion.sql` |
| `admin_user_tiers` | `20260925_trial_conversion_real.sql` |
| `v_partner_cohort` | `20260920_charity_tier_and_partner_cohort.sql` |
| `v_coach_engagement` | `20260918_supersede_week_keyed_rows.sql` |
| `v_hr_present_pct` | `20260722_analytics_events.sql` |
| `admin_user_directory` | `20260528_admin_user_directory.sql` |

`v_metric_users` is new, so `drop view if exists public.v_metric_users;` completes the rollback.
