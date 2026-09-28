# 2026-09-28 — an offer code redeemed, paid at Apple, free in our app

**Severity:** would have affected all 500 Make-A-Wish runners. Zero real users hit it:
no RevenueCat row had ever landed in `subscriptions` before today, so it was latent.

**Found by:** redeeming the first real custom offer code on a production build, then
querying production directly rather than inferring from the code.

---

## What was observed

`tester1@test.com`, created 2026-09-28T15:40:10Z:

| Source | State |
|---|---|
| RevenueCat | `zonna_premium` / `zonna_premium_annual`, £0, `is_sandbox: false`, expires **2027-09-28** |
| `subscriptions` | **no row** |
| `ops_events` | **empty for that user** |
| `resolveTier` | `{ tier: 'free', reason: 'none' }` |

Two `revenuecat_event_unusable` rows existed, unattributed:

```
15:39:49.129  CANCELLATION      app_user_id_shape: $RCAnonymousID:67f168e69
15:39:49.331  INITIAL_PURCHASE  app_user_id_shape: $RCAnonymousID:67f168e69
15:40:10.685  auth user tester1@test.com created
```

---

## Two independent defects

### 1. `SUBS-CANCELLATION-TIER-01` — CANCELLATION revoked access

`toStatus('CANCELLATION')` returned `'cancelled'`. `resolveTier` grants paid only on
`['trialing','active']` (ADR-005 line 39). `apply_subscription_event`'s guard is
**ordering-only**, so the newer CANCELLATION overwrote the active row.

In Apple's vocabulary **CANCELLATION means auto-renew was switched off**. Access runs
to `expires_date`; `EXPIRATION` ends it.

⚠️ **The configuration choice caused the event.** The offer was deliberately created
with auto-renew OFF so a charity runner is never charged £59.99 mid-taper. That choice
makes RevenueCat emit CANCELLATION roughly two minutes after **every** redemption. The
reputational reasoning was sound and its downstream consequence was never traced. **A
configuration choice is a code path.**

### 2. `SUBS-RECONCILE-RACE-01` — reconcile asked before the alias

The journey boots the app signed out, so `configure({ appUserID: null })` gives
RevenueCat an anonymous id and the StoreKit receipt attaches to it. `logIn` aliases it
on `SIGNED_IN`, asynchronously. The reconcile effect fired on `appReady && userId`,
lost that race, received a truthful "no entitlement", and never retried (per-mount ref).

`__rcReady` would not have helped: it resolves when `configure` is done and the auth
listener is **registered**, not when it has fired.

---

## Why they survived

| Defect | Class |
|---|---|
| CANCELLATION | 🆕 **Both halves correct, the composition untested** — see below |
| Stripe `past_due` twin | **The remedy was applied to one twin** |
| reconcile race | **The remedy was applied to one twin** |
| empty ops trail | **Silent fallback** — only the success path was instrumented |

### 🆕 New catalogue class: both halves correct, the composition untested

`revenuecatEvents.test.ts` asserted `CANCELLATION → 'cancelled'` and passed.
`tierResolution.test.ts` asserts the accept-list and passes. **Nothing ran the output
of the first through the second**, so nobody asked the only question that matters:
*after this event arrives, does the runner still have access?*

`/ship`'s pre-ship gate already carries this rule as item 3. It had no mechanical
enforcement for this pair. Added to the `/zona-debug` catalogue in the same commit.

### The twin, found by the sweep

Stripe's `past_due` returned `'expired'`, revoking a customer **while Stripe is still
retrying their card**. The argument against it was already written in
`revenuecatEvents.ts`'s `BILLING_ISSUE` comment, two lines above the bug, and had never
been carried across. It was also **structurally untestable where it lived** — private
to `app/api/webhooks/stripe/route.ts`, and `vitest` collects `lib/**` only.

---

## Fixes

1. `toStatus('CANCELLATION')` → `null`. Safe as well as correct: `resolveTier`
   independently requires `current_period_end > now`.
2. `stripeToStatus` extracted to `lib/subscriptions/stripeEvents.ts`; `past_due` → `null`.
3. `lib/subscriptions/eventTierComposition.test.ts` — the composition gate, both
   providers, with a population arm parsing `toStatus`'s own `case` labels and a
   past-period arm asserting self-termination.
4. `CapacitorBoot` exposes `__rcIdentify(uid)` = `logIn` + `syncPurchases`, idempotent;
   reconcile awaits it.
5. Reconcile records `revenuecat_reconcile_none` / `_failed` on every outcome.
6. Corrected an overstated comment: `offer_code` is **absent** from the v1 subscriber
   payload, so the cohort tag is null for every runner.

**Falsified:** reverting CANCELLATION turns the new gate red on *"must not revoke access
inside a paid-for period"*. 3,807 tests / 427 files pass, tsc 0.

**Not verified:** the reconcile path is native-only and has not run on a device. It
ships via `server.url`, so no new binary is required.
