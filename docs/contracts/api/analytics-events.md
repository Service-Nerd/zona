# Data Contract — `analytics_events` + report views (INSTRUMENT-01)

**Tier:** Infra — not a user-facing feature; no FREE/PAID gate.
**Owner:** `lib/analytics.ts` (write) · `supabase/migrations/20260722_analytics_events.sql` (schema + views).
**Decision:** SLT portfolio review 2026-07-22 — "own it in Supabase" over a third-party analytics SDK. No new vendor, no PII beyond the Supabase user id, events are behavioural not content. Revisit a hosted product-analytics tool only if/when paid acquisition is scheduled and funnels/retention are needed that SQL can't cheaply answer.

## Why this exists

Four backlog items carry numeric gates. The 2026-07-22 code audit found **three are already answerable from existing data** (a query, not instrumentation); only one needs a new event.

| Gate | Needs | Answered by |
|---|---|---|
| CA-07 — "50+ paying users" | paying-user count | `v_paying_users` (reads `admin_user_tiers`) |
| MON-TRIAL-01 — trial→paid baseline | conversion + lag | `v_trial_conversion` (reads `user_settings` + `subscriptions`) |
| HR-SYNC-04 — size the no-HR problem | % runs w/ HR at first query | `v_hr_present_pct` (reads `strava_activities` HR-SYNC-01 columns) |
| CO-ONE — "3+ Coach opens/wk, no downstream action" | Coach opens vs weekly actions | `v_coach_engagement` (reads new `analytics_events` + `session_completions`) |
| ENGINE-03 — female readiness mis-fires | cycle-phase usage evidence | Deferred — needs the cycle bridge; `props` is schema-ready for it |

## Table `analytics_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL | FK `auth.users(id)` ON DELETE CASCADE |
| `event` | `text` NOT NULL | Behavioural event name. **No CHECK constraint** — union enforced in TS (`lib/analytics.ts → AnalyticsEvent`); new events ship without a migration (mirrors `notifications.type`). |
| `props` | `jsonb` NOT NULL `'{}'` | Behavioural metadata only — **never PII or content**. Schema-ready hook for future events. |
| `created_at` | `timestamptz` NOT NULL | `now()` |

**Index:** `(user_id, event, created_at)` — the engagement view's read pattern.

### RLS

- **INSERT:** authenticated users may insert **their own** rows (`WITH CHECK auth.uid() = user_id`).
- **No SELECT / UPDATE / DELETE policy** — a client can write telemetry but cannot read any analytics row.
- All reads go through the report views, which are `REVOKE`d from `anon` + `authenticated` (owner/service-role only — same posture as `admin_user_tiers`).

## Client write — `lib/analytics.ts`

```ts
trackEvent(supabase: SupabaseClient, userId: string | null, event: AnalyticsEvent, props?): void
```

- **Fire-and-forget.** Never throws, never blocks the UI, no `await`. A dropped event is not a user-facing failure — logs `console.warn` and moves on.
- No-op when `userId` is null (pre-auth).
- `AnalyticsEvent` union is the single source of truth for event names.

### Current events

| Event | Fired when | Fired from |
|---|---|---|
| `coach_open` | User navigates into the Coach screen (once per `screen → 'coach'` transition) | `DashboardClient` `useEffect([screen, userId])` |
| `upgrade_view` | The Upgrade screen mounted (once per mount, ref-guarded) | `UpgradeScreen` `useEffect` |
| `upgrade_purchase_attempt` | Subscribe tapped, **before** the store sheet opens | `UpgradeScreen.handleSubscribe` |
| `upgrade_purchase_result` | The attempt resolved | `UpgradeScreen.handleSubscribe` |

### The upgrade funnel (OPS-FUNNEL-01, 2026-09-28)

🔴 **WHY:** the 1 January trial-to-paid gate reads `v_trial_conversion`, which can report a
**rate and nothing else**. Measured in production on 2026-09-28 this table held **192 rows of
exactly one event type** (`coach_open`), so if that gate reads 0% the data could not
distinguish *nobody reached the paywall* from *they reached it and left* from *they tried to
buy and it failed*. The denominator was observable and the numerator was observable;
everything between them was not. `design-rulings.md` names the same hole from the other side
when the SLT killed the merchandising settings screen: *"we would be designing a funnel nobody
has observed."*

**Props**

| Event | Props |
|---|---|
| `upgrade_view` | `{ reason, platform }` |
| `upgrade_purchase_attempt` | `{ annual, platform, reason }` |
| `upgrade_purchase_result` | `{ outcome, annual, platform }` + `stage` on a checkout failure |

- `reason` is `upgradeFraming()`'s variant — `gain` \| `trial-ended` \| `grant-ended` —
  **reused, not re-derived**, so the funnel records the same story the screen tells.
- `platform` is `ios` \| `web`.
- `outcome` is `success` \| `redirected` \| `cancelled` \| `failed`.

⚠️ **`redirected` is not a sale.** On web the purchase completes on Stripe's domain and only
the webhook observes the result, so recording the handoff as `success` would overstate
conversion on exactly the number the gate reads. `success` is reserved for a StoreKit purchase
that actually resolved.

⚠️ **`cancelled` must stay separable from `failed`.** A dismissed StoreKit sheet counted as a
broken purchase sends someone hunting a defect that does not exist. The rule lives in
`lib/analytics.ts → isUserCancelled()` and is **strict** (`=== true`): it previously existed
twice in `UpgradeScreen` with two different predicates (`=== true` in `handleSubscribe`,
truthy in `handleRestore`) — one rule, two answers, the TIER-OWNER-01 class.

⚠️ **`upgrade_view` fires from inside `UpgradeScreen`, not at the nine `setScreen('upgrade')`
call sites** — one owner cannot be forgotten by the tenth. The trade is that a mount cannot
say **which door** the runner came through; `props.source` is filed as a follow-up rather than
threaded through nine call sites in one build.

✅ **No migration needed** — `event` has no CHECK constraint and `props` is `jsonb`.
✅ **`v_coach_engagement` is unaffected**: it filters `WHERE event = 'coach_open'`, so new
event types cannot inflate the CO-ONE gate. Verified in `20260722_analytics_events.sql`.

## Report views (owner/service-role read only)

| View | Shape | Feeds |
|---|---|---|
| `v_paying_users` | single row: `paying_users int` | CA-07 |
| `v_trial_conversion` | per-user: `user_id, trial_started_at, subscribed_at, sub_status, converted bool, days_trial_to_sub numeric` **+ (OPS-TRIAL-CONV-01, 2026-09-25) `converted_real bool, is_admin bool, had_charity_grant bool, looks_like_test bool`** | MON-TRIAL-01 |
| `v_hr_present_pct` | single row: `instrumented_runs, hr_present_runs, hr_absent_runs, hr_present_pct` | HR-SYNC-04 |
| `v_coach_engagement` | per (`user_id`, `week`): `coach_opens, downstream_actions` | CO-ONE |

### Deliberate design notes

- **`v_coach_engagement` is RAW** — it applies **no threshold**. The CO-ONE "3+ opens with zero downstream action across ≥10% of paid users" logic lives with the CO-ONE feature when built, not here (keeps coaching numerics out of infra — INV-CFG-003).
- **Downstream action = a `session_completions` write**, bucketed on `updated_at` (the column the completion write path provably sets — `created_at` is not asserted by the repo). Extend the `actions` CTE if a broader definition is needed later.
- 🔴 **`converted` is RAW and counts the founder's admin row; `converted_real` is the number the 1 January 5% gate reads (OPS-TRIAL-CONV-01).** The only `subscriptions` row in production is a hand-seeded `stripe` comp for the admin account, so the raw column reported **1 of 31 = 3.2%** against a 5% threshold. Verified after the fix: **`converted_real` 0, eligible denominator 28.** Both columns are kept — a view that silently changes an existing column's meaning is worse than one that is wrong visibly. Baseline query: `count(*) FILTER (WHERE converted_real) / count(*) FILTER (WHERE NOT is_admin AND NOT had_charity_grant AND NOT looks_like_test)`.
- **`v_trial_conversion.subscribed_at` = `subscriptions.created_at`** — the closest honest "converted" timestamp we hold (when StoreKit/RevenueCat first granted entitlement). `trial_started_at` is the in-app 14-day reverse trial, not the Apple offer.
- **`v_paying_users`** counts `admin_user_tiers.tier = 'premium'` — real payers, excluding `admin` (us).

## How to read the gates

Run from the Supabase SQL editor (service-role):

```sql
-- CA-07
SELECT paying_users FROM v_paying_users;

-- MON-TRIAL-01 baseline
SELECT
  count(*)                              AS trialists,
  count(*) FILTER (WHERE converted)     AS converted,
  round(100.0 * count(*) FILTER (WHERE converted) / NULLIF(count(*),0), 1) AS conversion_pct,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY days_trial_to_sub) AS median_days
FROM v_trial_conversion;

-- HR-SYNC-04
SELECT * FROM v_hr_present_pct;

-- CO-ONE (apply the threshold at read time, not in the view)
SELECT count(*) FROM v_coach_engagement WHERE coach_opens >= 3 AND downstream_actions = 0;
```

## Migration + apply

- Migration: `supabase/migrations/20260722_analytics_events.sql`.
- **Must be applied to live Supabase** (project `wkppmpsvqkaxbekdgzdm`) — run by the operator, not automated.
- Verify after apply (INV-DB-005): RLS enabled + insert-own policy present; all four views `REVOKE`d from `anon`/`authenticated`.
