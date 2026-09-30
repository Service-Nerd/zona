# API Contract — /api/webhooks/revenuecat

**Method:** POST
**Auth:** Shared secret in the `Authorization` header, compared constant-time against
`REVENUECAT_WEBHOOK_SECRET`. No user session.
**Gate:** None. RevenueCat calls this; no client does.
**Route:** `app/api/webhooks/revenuecat/route.ts`

This is the **single writer of the `subscriptions` table for iOS purchases and for comped
charity access**, and `resolveTier` reads that table for every tier decision in the app. It is
also the path a promotional entitlement takes, so a failure here shows up as *a charity runner
meeting a paywall they were promised they would not see*.

## Request

```
POST /api/webhooks/revenuecat
Authorization: <REVENUECAT_WEBHOOK_SECRET>
Body: { "event": { ... } }
```

**Env:** `REVENUECAT_WEBHOOK_SECRET`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

🔴 **FAILS CLOSED.** An unset `REVENUECAT_WEBHOOK_SECRET` returns **503 and writes nothing**. It
must never mean "accept every request" — that would let anyone forge a subscription for any
`user_id` (security audit finding 3). `secretMatches` also returns false when either side is
missing, so the two guards agree.

### Fields read from `event`

| Field | Use |
|---|---|
| `type` | Mapped by `toStatus()` — see below |
| `app_user_id` | Written as `subscriptions.user_id`. **Must be the Supabase user id** |
| `expiration_at_ms` | Epoch ms → ISO. First choice for `current_period_end` |
| `expires_date` | Fallback when `expiration_at_ms` is absent |
| `event_timestamp_ms` | The SOURCE event's time, via `eventAtIso()` — drives the ordering guard |

## Status mapping

Owned by **`lib/subscriptions/revenuecatEvents.ts`**, not by the route — it is pure logic, and
vitest only collects `lib/**`, so a mapping written beside the route would never have been tested.

| RevenueCat event | Written |
|---|---|
| `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION` | `active` |
| `NON_RENEWING_PURCHASE`, `SUBSCRIPTION_EXTENDED` | `active` — **comped access (GTM-CHARITY-03)** |
| `TRIAL_STARTED` | `trialing` |
| `TRIAL_CONVERTED` | `active` |
| `CANCELLATION` | `null` → **no write** (SUBS-CANCELLATION-TIER-01, 2026-09-28) |
| `EXPIRATION` | `expired` |
| anything else | `null` → 200, **no write**, plus an `ops_event` |

🔴 **`CANCELLATION` USED TO WRITE `cancelled`, AND IT WAS A LIVE TIER DEFECT.**
In Apple's vocabulary CANCELLATION means *auto-renew was switched off*; access runs
to `expires_date` and `EXPIRATION` is what ends it. `resolveTier` grants paid only on
`['trialing','active']` (ADR-005), so the write demoted a runner still inside a period
they had paid for.

⚠️ **And an offer code created with auto-renew OFF emits it on every redemption.**
Measured in production 2026-09-28: `INITIAL_PURCHASE` and `CANCELLATION` arrived in the
same second, and `apply_subscription_event`'s guard is ordering-only, so the newer one
won. All 500 Make-A-Wish runners would have dropped to free tier about two minutes after
redeeming. Returning `null` is also safe: `resolveTier` independently requires
`current_period_end > now`, so access still self-terminates at the period end.

Gated by `lib/subscriptions/eventTierComposition.test.ts`, which composes
`toStatus() → resolveTier()` for every event — the check neither unit test had.

⚠️ **The two grant rows are not decoration.** A promotional entitlement granted from the
RevenueCat dashboard arrives as `NON_RENEWING_PURCHASE`, **not** as a subscription lifecycle
event. Without that case it fell through to `null`, the route replied `received`, wrote nothing,
`getUserTier` stayed `free`, and a comped runner still met the marathon paywall — with no trace
anywhere that it had happened.

## Expiry resolution

In order:

1. `expiration_at_ms` → ISO
2. `expires_date`
3. **Grant events** (`isGrantEvent`: `NON_RENEWING_PURCHASE`, `SUBSCRIPTION_EXTENDED`) →
   `now + NON_EXPIRING_GRANT_YEARS` (**5 years**)
4. Everything else → `now + 30 days`

⚠️ **Step 3 exists because step 4 is wrong for a grant.** RevenueCat's "lifetime" promotional
entitlement carries no expiry, and the 30-day default would cut a comped charity runner off
around week four of a sixteen-week block — which the SLT named as worse than never granting
access at all.

## Response — 200

```json
{ "received": true }
```

Returned for a successful write **and** for an unhandled event type. A 200 does not mean a row
was written.

## Error responses

| Status | Condition |
|--------|-----------|
| 503 | `REVENUECAT_WEBHOOK_SECRET` not configured (fail closed) |
| 401 | `Authorization` header absent or does not match |
| 400 | Body is not valid JSON, or has no `event` key |
| 500 | `apply_subscription_event` returned an error |

## Observability

An unmapped `event.type` records `revenuecat_event_unhandled` via `recordOpsEvent`, carrying
`{ event_type }` and `app_user_id`. That branch used to be **silent**, which is how a comp grant
could fail leaving no trace at all. **If a charity runner reports a paywall they should not be
seeing, look here first.**

A missing `event_timestamp_ms` records `revenuecat_event_no_timestamp` — see the write section
below for why null is the correct fallback and why it must still leave a trace.

### SUBS-COMPED-WRITER-01 (2026-09-30) — `p_is_comped`, and a negative that re-checks itself

The route passes a 6th argument to `apply_subscription_event`: **`p_is_comped`**, true when
the entitlement was granted at no charge (an Apple offer code). Derived by
`compedEvidence(event.period_type, event.price)` — a free period type **and** a zero price,
both required.

🔴 **THIS ROUTE IS THE ONLY WRITER FOR ONE JOURNEY, WHICH IS WHY THE FLAG MATTERS HERE.**
A runner who redeems while **already signed in** never reaches
`POST /api/subscriptions/reconcile`: `resolveTier` returns reason `subscription`, and
`shouldReconcile` refuses to run again for that reason. A flag missed here is missed
permanently.

⚠️ **THE EVENT'S FIELD NAMES ARE FROM REVENUECAT'S DOCS, NOT A CAPTURED BODY.** Per the docs
the event uses an UPPERCASE enum (`"TRIAL"`) and a bare numeric `price`, where the subscriber
object is lowercase with `{ amount }`. `isCompedPurchase` accepts both — but a **negative**
verdict on an `active`-status event is re-checked against `readEntitlement`, which **is**
verified against both real 2026-09-28 redemptions. Only a negative: a positive means the
event shape worked and there is nothing to learn, so this costs at most one extra RevenueCat
call per genuine purchase and none for renewals or cancellations.

⚠️ **THE RE-CHECK MAY NEVER BREAK THE WRITE.** Nothing in `lib/trial.ts`, `DashboardClient`
or any client surface reads `is_comped` (grep-verified, 0 references) — it exists only so
`v_trial_conversion.converted_real` stops counting a gift as a sale. The look-up is wrapped,
checks `res.ok`, and on any failure keeps the event's own verdict and carries on. A reporting
field must not be able to cost a runner their access.

`verified_via` (`'event' | 'subscriber'`) rides the heartbeat row alongside the raw
`period_type` and `price_amount`, because when a row is ever mismarked the first question is
which reader produced it.

⚠️ **The discriminator depends on App Store Connect state this repo cannot read:** it holds
only while the product has no introductory offer (de-stacked 2026-08-06, MON-TRIAL-01). If
one is re-added, a paying subscriber's first period reads `period_type: "trial"` and the
zero-price condition becomes the only thing standing between it and a mismarked row.

### OPS-SUBS-TRACE-01 (2026-09-28) — the success path leaves a row

🔴 **Until this shipped, every kind this route could emit was a FAILURE branch, so a
healthy webhook and an unreachable one were indistinguishable.** Measured in production
on 2026-09-28: `ops_events` held 435 rows across 13 kinds and **not one came from this
route**, while `subscriptions` held a single hand-seeded `stripe` row with
`last_event_at = NULL`. No RevenueCat event has ever produced a row here.

That is load-bearing: `resolveTier` reads `subscriptions` for every tier decision, and
`v_trial_conversion` feeds the 1 January trial-to-paid gate. A first real purchase failing
at the RPC returned 500 with nothing durable to find it by.

| Outcome | Ops kind | `detail` |
|---|---|---|
| RPC ran | `revenuecat_event_received` | `{ provider, event_type, environment, status, applied }` |
| RPC errored (→ 500) | `revenuecat_event_write_failed` | `{ provider, event_type, environment, status, message }` (truncated to 300 chars) |
| No status mapping | `revenuecat_event_unhandled` | `{ provider, event_type, environment }` |
| Anonymous `app_user_id` (→ **200**) | `revenuecat_event_unusable` | `{ provider, event_type, environment, missing: 'app_user_id_not_a_user', app_user_id_shape }` |

⚠️ **`environment` is `'sandbox' | 'production'`, OMITTED when it cannot be established**
(a row without it predates 2026-09-30). Taken straight from RevenueCat's `event.environment`.
`normaliseEnvironment` accepts strings only: RevenueCat's `is_sandbox` is true-for-sandbox
while Stripe's `livemode` is true-for-live, so accepting booleans would let one route
silently invert the other.

🔴 **`revenuecat_event_unusable` WITH `missing: 'app_user_id_not_a_user'` IS NOT A LOST SALE,
and the daily digest must not lead with it.** It is the designed charity journey
(CHARITY-OFFER-CODE-01): the runner redeems an offer code, THEN installs, THEN signs up, so
the receipt attaches to an anonymous `$RCAnonymousID:`. The route answers **200 on purpose**
— nothing is retryable — and the transaction re-arrives correctly keyed once `logIn` aliases
it, with `POST /api/subscriptions/reconcile` as the backstop. An offer created with
auto-renew OFF also emits `CANCELLATION` ~2 minutes after **every** redemption, so each
redemption leaves two rows. `lib/ops/subscriptionHealth.ts → isPreSignupRedemption()` carves
these out at the ROW level; the KIND stays money-critical, because the same kind carrying any
other `missing` value is a genuinely dropped payment.

- **`_received` is a HEARTBEAT, recorded on every delivery** — same reasoning as
  `strava_webhook_received` and `plan_enrich_server_saved`: a backstop nobody can see
  firing is one nobody trusts.
- ⚠️ **`detail.applied === false` IS NOT AN ERROR.** It is the SUBS-ORDERING-REVENUECAT-01
  ordering guard suppressing a stale or replayed delivery, which previously only reached a
  `console.log`. The guard can now be observed working.
- The kind and detail are decided by **`lib/subscriptions/webhookTrace.ts`**, shared with
  the Stripe route so the two cannot drift. It is pure and tested
  (`webhookTrace.test.ts`); `app/**` is not collected by vitest, so a test beside this
  route would never run.
- Recording is **awaited**, not fire-and-forget: the 500 is what makes the provider retry,
  and a trace that loses the race with the response is the one delivery you needed.
- **Behavioural only, no PII and no payload.** `ops_events` deliberately survives account
  deletion (anonymised via `ON DELETE SET NULL`), so anything put here outlives the account.

## Notes

- Uses the **service-role** client; bypasses RLS. Correct on a webhook — there is no session.
- `provider` is written as `'revenuecat'`.

### The write — `apply_subscription_event`

**Never a plain upsert.** Same guard as `/api/webhooks/stripe`
(`supabase/migrations/20260819_subscription_event_ordering.sql`): a conditional upsert in one
statement, returning `TRUE` if applied and `FALSE` if suppressed as stale.

```
apply_subscription_event(p_user_id=app_user_id, p_provider='revenuecat', p_status, p_period_end, p_event_at)
```

`p_event_at` comes from **`eventAtIso(rc)`** (`lib/subscriptions/revenuecatEvents.ts`), which
reads `event.event_timestamp_ms`. The write applies only when
`s.last_event_at <= excluded.last_event_at`, so a replayed delivery is a no-op and a stale
event cannot re-activate a cancelled subscription or move `current_period_end` backwards.

A suppressed event logs `stale/out-of-order event suppressed` and still returns 200 —
RevenueCat must not be asked to retry an event that was correctly ignored.

⚠️ **A missing or unusable `event_timestamp_ms` yields `null`, not `now()`.** The RPC applies
when either side is null, so null means *"behave exactly as the old plain upsert did"* — a wrong
field name degrades to the status quo rather than dropping a paying customer's write. `now()`
would be far worse: it stamps a **stale** event as the newest and defeats the guard on precisely
the delivery it exists to suppress. The route records **`revenuecat_event_no_timestamp`** when
this happens, because a guard that has quietly stopped guarding is this repo's most repeated
failure class. **If that event fires at any volume, the guard is protecting nothing.**

### History — this route bypassed the guard written for it (SUBS-ORDERING-REVENUECAT-01)

Until 2026-09-24 this route wrote with a plain
`supabase.from('subscriptions').upsert(..., { onConflict: 'user_id' })` and **no event
timestamp**, while `/api/webhooks/stripe` used the RPC. The guard's migration opens:

> *"Stripe **(and RevenueCat)** do not guarantee delivery order. A stale
> `customer.subscription.updated` arriving AFTER a `deleted` could re-activate a cancelled
> subscription **via the plain upsert**."*

It named both providers, was wired for one, and this route went on performing the exact upsert
that sentence calls the hazard — the *"hazard solved for one transition, named but not solved
for its twin"* class, with the twin named in the same sentence. Replays were not no-ops, an
out-of-order event could re-activate a cancelled subscription, and `last_event_at` was never
populated for this provider at all.

**Found while writing this contract.** Reading the route closely enough to write down what it
promises is what surfaced it.
