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
| `CANCELLATION` | `cancelled` |
| `EXPIRATION` | `expired` |
| anything else | `null` → 200, **no write**, plus an `ops_event` |

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
