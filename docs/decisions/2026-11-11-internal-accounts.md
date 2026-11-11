# Internal accounts: exclude testers from metrics without granting anything

**Date:** 2026-11-11 · **Id:** `INTERNAL-ACCOUNTS-01` · **Status:** ✅ **APPLIED 2026-11-11**, verified from here

## The decision

`user_settings` gains **`is_internal boolean not null default false`** and **`internal_reason text`**.
It is a *reporting* flag: it grants and removes nothing. 18 accounts are flagged (5
`app_review_or_demo`, 13 `tester/friend`). Testers keep receiving plans, coaching, emails and push,
which is the point: they are the QA population.

**The pattern it establishes:** *all user metrics exclude `is_admin` and `is_internal`*, through one
owner — **`v_metric_users`** — which every user-metric view joins rather than restating the predicate.

## 🔴 What the brief assumed, and what was actually true

The brief said *"we already exclude is_admin users"* and asked for `is_internal` to be excluded *"as
they exclude is_admin"*. **Measured against production: there was no such mechanism to mirror.** Of
the four views named, only `v_trial_conversion` referenced `is_admin` at all, and it does not filter
on it. Three different shapes were in use:

| view | how admins are handled today |
|---|---|
| `admin_user_tiers` | a tier **ladder** (`CASE WHEN is_admin THEN 'admin'`), so admins fall out of `v_paying_users` as a **side effect** of never being `'premium'` |
| `v_trial_conversion` | a **`converted_real` boolean**, plus a `looks_like_test` email heuristic |
| `v_coach_engagement` | **nothing** — it never joins `user_settings` |
| `v_partner_cohort` | **nothing** |
| `v_hr_present_pct` | **nothing**, and the brief does not name it |

So the deliverable changed from "add a clause alongside an existing one" to "establish the owner the
pattern needs, and wire four of seven views to it."

⚠️ **`looks_like_test` is the hack this replaces**, and it was never sufficient: it catches
`test13@test.com` and **misses** `sheri.9j4u40i.paid@icloud.com` and both
`@privaterelay.appleid.com` App Review accounts. It is kept for one release so the two can be
compared, marked superseded.

## Measured impact

| metric | before | after |
|---|---|---|
| users total / admins / to flag | 56 / 1 / **18** | — |
| `v_trial_conversion` rows | 56 | **56 — UNCHANGED, by design** |
| the honest trial denominator (`where not is_internal`) | 56 | **38** |
| `converted_real` | 0 | 0 |
| `v_coach_engagement` distinct runners | 21 | **15** |
| `v_hr_present_pct` | 74.0 | **77.2** (it goes UP — see below) |

**18 of 56 users (32.1%) are internal.** `converted_real` is 0 either way, so the conversion *rate*
does not move; the denominator becomes honest, which is what the brief was for.

🔴 **CORRECTED AFTER CODE REVIEW: the first write-up said `v_trial_conversion` itself went 56 → 38.
It does not.** That view is row-per-trialling-user and deliberately KEEPS the internal rows so an
analyst can see the difference; the exclusion lives in `converted_real` and in the new `is_internal`
column. **38 is the count of a query that adds `where not is_internal`, not of the view.** Anything
reporting a trial denominator must add that clause, the 1 January gate included.

🔴 **TWO OF THESE I PREDICTED WRONG, CORRECTED AFTER THE APPLY.** I wrote 16 and 73.0. I simulated
the fix by subtracting the **18 internal ids**; the shipped `v_metric_users` subtracts internal **AND
admin**, which I had written into it myself. There is 1 admin with **97 activities at 45.5%
HR-present**, so excluding them takes coach runners 16 → 15 and *raises* HR-present 73.0 → 77.2.
**The view was right; the prediction was measured with a weaker predicate than the shipped code** —
and the runbook's stated expectations would have read as a failed apply.
🔑 Separately worth knowing: the admin account was dragging the ADR-011 §5 HR-present figure down
by **4.2 percentage points**.

## The three judgement calls

**1. `v_partner_cohort` is SPLIT, not filtered.** `GTM-CHARITY-07` is ratified: *a seat is spent when
it was claimed* (founder: *"if a user deletes their account, no, they don't get the seat back"*).
`codes_minted` / `codes_redeemed` / `grants_active` are the **batch's record of its own capacity**,
not user metrics — filtering a tester out of them would make a partner's redeemed count disagree with
`charity_codes` and silently refill the batch, which that ruling exists to prevent. Capacity stays
unfiltered; **engagement** columns are filtered.
📐 **Live, not hypothetical:** `test13@test.com` claimed code `37G94M6Y` from batch `7c2ae3a2`
twenty minutes after signing up, 0 runs, 0 completions, one sign-in. Proven before/after:
`codes_redeemed` **1 → 1**, `runners_with_a_plan` **1 → 0**.

**2. `v_hr_present_pct` is included although the brief does not name it.** It is a user metric — a
global percentage over every activity ever ingested, testers included. The brief's own pattern says
*all* user metrics, and a pattern a sibling view violates on day one is not a pattern.

**3. `is_internal` is NOT a tier value.** Adding an `'internal'` rung to `admin_user_tiers` would
have inherited the exclusion everywhere for free, which is tempting — and it would make that view
**lie about what a tester can access**. The brief is explicit that the flag grants nothing. The
ladder is untouched; the flag rides alongside it so an admin sees both.

## 🔴 The finding that outranks the task

The brief asked: *"users must not be able to set `is_internal` on their own row. Confirm the
`user_settings` update policy blocks it; fix if not."* **It does not — and the same hole already
applies to `is_admin`.**

Measured 2026-11-11:
- RLS **is** enabled on `user_settings`, so writes are confined to the caller's own row;
- the UPDATE policy is `USING (auth.uid() = id)` with **`with_check = NULL`**, and Postgres reuses
  `USING` as the check when `WITH CHECK` is absent;
- **`authenticated` holds table-wide UPDATE on all 45 columns**, `is_admin` among them;
- there are **zero triggers** on the table.

So any signed-in user could run `update user_settings set is_admin = true where id = auth.uid()`
and `resolveTier` would return `{tier:'paid', reason:'admin'}` — paid features plus the admin-only
surfaces. **Pre-existing; not introduced here.** `anon` cannot (the policy needs `auth.uid() = id`).

⚠️ It is not reachable through the app's UI, but the anon key and the PostgREST endpoint are public
by design in a Supabase app, so "not reachable through our UI" is not a defence.

**Fix, third attempt — a BEFORE UPDATE trigger.** `guard_privileged_user_settings`, SECURITY
**INVOKER**, reverts `is_admin`, `is_internal` and `internal_reason` to their `OLD` values for any
caller that is not `postgres`, `service_role` or `supabase_admin`. Nothing client-side writes these
columns (grepped: the only `is_admin` hit outside reads is the column manifest), they are set by
hand or by migration, and `service_role` passes the guard so the server is unaffected. A
`WITH CHECK` is added too, so the row rule states its intent rather than relying on a default.

🔴 **The first two attempts were INERT, and this paragraph recorded the first one as the fix for
several hours.**

1. `revoke update (is_admin, is_internal, internal_reason) ... from anon, authenticated` —
   **column privileges in Postgres are ADDITIVE.** A column REVOKE removes a column grant, and
   there was none: `pg_class.relacl` held a **table-level** UPDATE grant for `authenticated` and
   `pg_attribute.attacl` was NULL. `has_column_privilege` returned the same answer before and
   after. I had read “45 of 45 columns” in `information_schema.column_privileges` as evidence of
   column grants; it is the expansion of the one table grant.
2. The replacement trigger was `SECURITY DEFINER`, and **inside a DEFINER function `current_user`
   is the function OWNER**, never the caller — so the `current_user not in (...)` test could never
   be true and the guard would never have fired. An inert fix for an inert fix.

Verified in production after the apply: 1 non-internal trigger on `user_settings`, `prosecdef`
false. ⚠️ **Still unexercised:** the decisive test is an ordinary signed-in `PATCH` of
`is_admin` on one’s own row, which cannot be run from this machine — see the runbook § 3.

## Consequences to know

- 🔻 **`lib/analytics.ts` records that the 1 January trial-to-paid gate reads `v_trial_conversion`.**
  Its denominator moves 56 → 38. The gate fires in roughly seven weeks; it should be read knowing the
  population changed, not just the rate.
- `lib/contracts/tableColumns.ts` lists the column sets for `admin_user_directory` and
  `admin_user_tiers`; both views gain two columns. ✅ **Applied 2026-11-11 and the manifest updated
  from the live schema afterwards** — `npm run check:db` is clean. Per CLAUDE.md the manifest
  describes what the table *actually* has, so it was deliberately **not** edited ahead of the apply.
- 🔴 **The brief’s part 3 was only three-quarters done at first.** `v_paying_users` was filed as
  exempt because “the tier ladder already excludes admins and internal accounts”. True for admin by
  construction, **false for internal** — the flag grants nothing, so an internal account reads its
  real tier. Latent today (premium = 23 rows, 0 internal), structural after
  `20261111b_paying_users_excludes_internal.sql`, which is **written and awaiting apply**.
- ⚠️ **The comped assertion covered one of two comp mechanisms.** It tested
  `subscriptions.is_comped` — correct for Make-A-Wish, which uses Apple offer codes — and was clear
  at 0 of 18. `charity_codes` is the other, and **1 of the 18 holds an active grant**
  (`test13@test.com`, a test claim from the charity build, so flagging it is right). A real
  charity-partner runner in that list would have passed. Both queries are in the runbook § 7.
- ⚠️ Noted, not fixed: `lib/brand.ts`'s comment says *"~73% of logged runs currently arrive
  **without**"* a heart-rate stream, while `v_hr_present_pct` reports 74% **with** one. The two
  disagree in direction. The published string carries no number, so no claim is affected.

## No UI

No admin toggle. Per the brief, any UI goes to the Design Board later. The flag is set by migration
or by hand under the service role.
