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
| 500 | `subscriptions` upsert failed |

## Observability

An unmapped `event.type` records `revenuecat_event_unhandled` via `recordOpsEvent`, carrying
`{ event_type }` and `app_user_id`. That branch used to be **silent**, which is how a comp grant
could fail leaving no trace at all. **If a charity runner reports a paywall they should not be
seeing, look here first.**

## Notes

- Uses the **service-role** client; bypasses RLS. Correct on a webhook — there is no session.
- `provider` is written as `'revenuecat'`.

### 🔴 This route bypasses the ordering guard its own migration was written for

It writes with a plain `supabase.from('subscriptions').upsert(..., { onConflict: 'user_id' })`
and **no event timestamp**, while `/api/webhooks/stripe` calls `apply_subscription_event`.

The guard's migration (`20260819_subscription_event_ordering.sql`) opens:

> *"Stripe **(and RevenueCat)** do not guarantee delivery order. A stale
> `customer.subscription.updated` arriving AFTER a `deleted` could re-activate a cancelled
> subscription **via the plain upsert**."*

It names both providers, was solved for one, and RevenueCat still performs the exact plain
upsert the migration describes as the hazard. Consequences: a replayed delivery is **not** a
no-op, and an out-of-order event **can** re-activate a cancelled subscription or move
`current_period_end` backwards. `last_event_at` is never populated for this provider.

This is the *"hazard solved for one transition, named but not solved for its twin"* class —
here the twin is named in the same sentence. Filed as **`SUBS-ORDERING-REVENUECAT-01`**.
Not fixed in the sitting that documented it: it changes what a paying customer's tier resolves
to, so it wants its own change with its own regression test, not a drive-by edit.
