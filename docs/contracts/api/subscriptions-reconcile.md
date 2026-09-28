# API Contract — POST /api/subscriptions/reconcile

**CHARITY-OFFER-CODE-01 (2026-09-28).** "This runner may hold an entitlement we never
recorded. Check with Apple."

## Why it exists

The webhook is the normal path and remains it. It cannot cover the journey 500 Make-A-Wish
runners are about to take:

> code arrives by email → redeemed in the App Store → **then** the app is installed →
> **then** an account is created

At redemption there is no Zonna account, so the entitlement attaches to an **anonymous**
RevenueCat id. The webhook fires carrying that id and the database refuses it —
`invalid input syntax for type uuid`, verified against production. The alias that would
re-key it fires `SUBSCRIBER_ALIAS`, which RevenueCat marks **deprecated and does not send to
new projects**. `TRANSFER` now covers the case where RevenueCat does send one; this route
covers the case where nothing arrives at all.

## Request

`POST`, no body. **Authorization: Bearer <supabase access token>** (or cookie session).

🔴 **The client never asserts entitlement, and that is the whole security model.** The
obvious shortcut — let the app read `customerInfo` locally and post *"I'm entitled"* — is a
free subscription for anyone who can call an endpoint. The app only ever says *"re-check
me"*. This route asks RevenueCat server-side with `REVENUECAT_SECRET_API_KEY`, a secret the
client never holds, and believes only that.

## Responses

| Status | Body | Meaning |
|---|---|---|
| 200 | `{ entitled: true, expiresAt, offerCode }` | Verified with RevenueCat; a `subscriptions` row was written |
| 200 | `{ entitled: false }` | Verified; no active entitlement |
| 200 | `{ entitled: false, reason: 'unknown to RevenueCat' }` | RevenueCat 404 — a real answer, not a failure |
| 401 | | No valid user |
| 503 | `{ error: 'Entitlement check unavailable' }` | `REVENUECAT_SECRET_API_KEY` unset — records `revenuecat_reconcile_unconfigured` |
| 502 | | RevenueCat unreachable or errored |

⚠️ **It refuses rather than grants when it cannot verify.** A reconcile that cannot check
must never hand out access, and the ops row matters because otherwise a misconfiguration is
indistinguishable from *"nobody redeemed a code"*.

## Writes

Through **`apply_subscription_event`** — the same ordering guard the webhooks use, so a
reconcile cannot move a subscription backwards past a newer event it raced. A **lifetime**
entitlement (null expiry) takes the `NON_EXPIRING_GRANT_YEARS` horizon rather than a 30-day
default that would cut a charity runner off mid-block.

Records an ops event on **every** outcome (SUBS-RECONCILE-RACE-01, 2026-09-28):

| Outcome | Ops kind | `detail` |
|---|---|---|
| Entitlement found and written | `revenuecat_reconciled` | `{ entitlement, expires_at, offer_code }` |
| RevenueCat 404 | `revenuecat_reconcile_none` | `{ reason: 'unknown_to_revenuecat' }` |
| No active entitlement | `revenuecat_reconcile_none` | `{ reason: 'no_active_entitlement' }` |
| RevenueCat non-2xx / unreachable | `revenuecat_reconcile_failed` | `{ reason, status? , detail? }` |
| `apply_subscription_event` errored | `revenuecat_reconcile_failed` | `{ reason: 'write_failed', detail }` |
| Key unset | `revenuecat_reconcile_unconfigured` | see 503 above |

🔴 **It previously recorded only success and a missing key.** So when the first real
offer-code redemption left a runner on the free tier holding a valid one-year entitlement,
`ops_events` was **empty** for that user, and there was no way to tell *"reconcile never
ran"* from *"reconcile ran and RevenueCat said no"* — a client bug and a timing bug, with
different fixes.

⚠️ `entitled: false` is the correct answer for nearly every user, so that row is
deliberately cheap. It exists to make the funnel countable, not to flag a problem.
for a given runner — carrying `offer_code`, which is the **cohort key**. Null means *no
cohort*, never a default one.

## Caller

🔴 **The caller MUST await `window.__rcIdentify(userId)` first** (SUBS-RECONCILE-RACE-01).
The offer-code journey boots this app signed out, so `Purchases.configure` runs with
`appUserID: null` and the StoreKit receipt attaches to an **anonymous** RevenueCat id
(measured: `$RCAnonymousID:67f168e69`). `logIn` aliases it to the Supabase id and
`syncPurchases` forces RevenueCat to re-read the receipt. POSTing before that asks about a
user id the purchase is not attached to yet, gets a truthful "no entitlement", and never
retries within that mount.

⚠️ **`__rcReady` is NOT sufficient** — it resolves when `configure` is done and the auth
listener is *registered*, not when the `SIGNED_IN` handler has run.

`DashboardClient`, **native only**, once per mount, and **only when the runner does not
already have access** — so it costs nothing for the users whose webhook worked normally. On
`entitled: true` it reloads rather than patching tier in place, because `resolveTier` is the
single owner and a second copy of *"are they paid now?"* is the TIER-OWNER-01 drift class.

## ⚠️ Required environment

**`REVENUECAT_SECRET_API_KEY`** (RevenueCat dashboard → API keys → secret). Without it this
route returns 503 and **offer codes redeemed before sign-up will not be recognised.**
