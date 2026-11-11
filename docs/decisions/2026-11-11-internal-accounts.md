# Internal accounts: exclude testers from metrics without granting anything

**Date:** 2026-11-11 · **Id:** `INTERNAL-ACCOUNTS-01` · **Status:** migration written, **NOT YET APPLIED**

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
| `v_trial_conversion` rows (the funnel denominator) | 56 | **38** |
| `converted_real` | 0 | 0 |
| `v_coach_engagement` distinct runners | 21 | **16** |
| `v_hr_present_pct` | 74.0 | **73.0** |

**18 of 56 users (32.1%) are internal.** `converted_real` is 0 either way, so the conversion *rate*
does not move; the denominator becomes honest, which is what the brief was for.

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

**Fix:** `revoke update (is_admin, is_internal, internal_reason) on public.user_settings from anon,
authenticated`. Nothing client-side writes these columns (grepped: the only `is_admin` hit outside
reads is the column manifest), both are set by hand or by migration, and `service_role` bypasses
column grants so the server is unaffected. A `WITH CHECK` is added too, so the row rule states its
intent rather than relying on a default — it cannot see `OLD`, so the revoke is what stops a column
change.

## Consequences to know

- 🔻 **`lib/analytics.ts` records that the 1 January trial-to-paid gate reads `v_trial_conversion`.**
  Its denominator moves 56 → 38. The gate fires in roughly seven weeks; it should be read knowing the
  population changed, not just the rate.
- `lib/contracts/tableColumns.ts` lists the column sets for `admin_user_directory` and
  `admin_user_tiers`; both views gain two columns, so `npm run check:db` reports drift **until the
  migration is applied and that manifest updated**. Per CLAUDE.md the manifest describes what the
  table *actually* has, so it is deliberately **not** edited ahead of the apply.
- ⚠️ Noted, not fixed: `lib/brand.ts`'s comment says *"~73% of logged runs currently arrive
  **without**"* a heart-rate stream, while `v_hr_present_pct` reports 74% **with** one. The two
  disagree in direction. The published string carries no number, so no claim is affected.

## No UI

No admin toggle. Per the brief, any UI goes to the Design Board later. The flag is set by migration
or by hand under the service role.
