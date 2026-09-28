// The RevenueCat event -> subscription status mapping.
//
// Lives in lib/, not in the route, for two reasons. It is pure logic and the
// route is the auth boundary (ADR-003), and — the practical one — vitest only
// collects `lib/**` and `components/**`, so a test written next to the route
// would never have run. A mapping this load-bearing must be inside the tested
// layer, not beside it.
//
// WHY IT IS LOAD-BEARING: the webhook that consumes this is the SINGLE WRITER
// of the `subscriptions` table, and `getUserTier` reads that table for every
// tier decision in the app. A wrong mapping mis-tiers a real paying customer.

export type SubscriptionStatus = 'trialing' | 'active' | 'cancelled' | 'expired'

export function toStatus(eventType: string): SubscriptionStatus | null {
  switch (eventType) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
      return 'active'

    // GTM-CHARITY-03 — comped access. A promotional entitlement granted from
    // the RevenueCat dashboard (a charity runner we are giving the app to)
    // arrives as a NON_RENEWING_PURCHASE, not as a subscription lifecycle
    // event. Without this case it fell through to `null`, the route replied
    // "received" and wrote nothing, getUserTier stayed 'free', and the runner
    // we had comped still met the marathon paywall — with no trace anywhere
    // that it had happened. SUBSCRIPTION_EXTENDED is the same shape: an
    // entitlement whose end date moved out.
    case 'NON_RENEWING_PURCHASE':
    case 'SUBSCRIPTION_EXTENDED':
      return 'active'

    case 'TRIAL_STARTED':
      return 'trialing'
    case 'TRIAL_CONVERTED':
      return 'active'

    // CHARITY-OFFER-CODE-01 (2026-09-28) — the two that the offer-code journey
    // needs and the first nine did not cover.
    //
    // TRANSFER — "a transfer of transactions and entitlements was initiated
    // between App User IDs", and RevenueCat fires it **for the destination user
    // only**. The destination is the one who now holds the entitlement, so
    // `active` is the correct read. This is the event that can re-key a purchase
    // made before the runner had an account: the receipt first attaches to an
    // ANONYMOUS RevenueCat id (the app boots signed out and configures with
    // `appUserID: null`), and `logIn` later aliases it to the Supabase id.
    //
    // ⚠️ The alias itself used to fire `SUBSCRIBER_ALIAS`, which RevenueCat
    // marks DEPRECATED and does not send to new projects — so TRANSFER is the
    // only event that can carry that re-key, and handling it was the difference
    // between a charity runner having access and not.
    case 'TRANSFER':
      return 'active'

    // PRODUCT_CHANGE — they moved between plans (monthly <-> annual). Still
    // subscribed; only the product changed.
    case 'PRODUCT_CHANGE':
      return 'active'

    // ⚠️ BILLING_ISSUE AND SUBSCRIPTION_PAUSED ARE DELIBERATELY NOT MAPPED, and
    // that is a decision rather than an omission. A billing issue opens Apple's
    // GRACE PERIOD: the runner still has access and Apple retries. Mapping it to
    // `cancelled` or `expired` would revoke a paying customer mid-grace, and if
    // the retry fails Apple sends EXPIRATION, which IS handled. Falling through
    // to `null` records the event and changes nothing, which is exactly right.
    case 'CANCELLATION':
      return 'cancelled'
    case 'EXPIRATION':
      return 'expired'

    // Unknown events stay unknown. Guessing a status from an event we do not
    // understand would mis-tier a real customer; the route records an ops event
    // so the gap is visible rather than silent.
    default:
      return null
  }
}

/** Grants can legitimately carry no expiry (RevenueCat's "lifetime"
 *  promotional entitlement). The 30-day subscription default is WRONG for
 *  those: it would cut a comped charity runner off around week four of a
 *  sixteen-week block, which the SLT review named as worse than never granting
 *  access at all. Treat an open-ended grant as open-ended. */
export const NON_EXPIRING_GRANT_YEARS = 5

export function isGrantEvent(eventType: string): boolean {
  return eventType === 'NON_RENEWING_PURCHASE' || eventType === 'SUBSCRIPTION_EXTENDED'
}

/**
 * SUBS-ORDERING-REVENUECAT-01 — the source event's timestamp, for the ordering guard.
 *
 * WHY IT LIVES HERE AND NOT IN THE ROUTE: same reason as `toStatus` above. vitest
 * collects `lib/**` only, so a resolver written beside the route would never have
 * run — and this one decides whether the guard engages at all.
 *
 * ⚠️ RETURNS null RATHER THAN `now()` WHEN THE FIELD IS ABSENT, DELIBERATELY.
 * `apply_subscription_event` applies the write when either side's `last_event_at`
 * is null, so null means "behave exactly as the old plain upsert did". Falling
 * back to `now()` would be far worse than doing nothing: it would stamp a STALE
 * event as the newest one and defeat the guard on precisely the delivery this
 * exists to suppress.
 *
 * The route records `revenuecat_event_no_timestamp` when this returns null, because
 * a guard that has silently stopped guarding is this repo's most repeated failure
 * class and must not be inferred from a support email.
 */
export function eventAtIso(rc: { event_timestamp_ms?: unknown }): string | null {
  const ms = rc?.event_timestamp_ms
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Is this `app_user_id` one of OUR users, or one of RevenueCat's anonymous ids?
 *
 * 🔴 CHARITY-OFFER-CODE-01 — THE BUG THIS EXISTS FOR, MEASURED AGAINST PRODUCTION.
 * A runner who redeems an offer code BEFORE installing hits this order:
 *
 *   1. app boots signed out -> `configure({ appUserID: null })` -> RevenueCat
 *      uses an anonymous id, `$RCAnonymousID:...`
 *   2. the SDK syncs the Apple receipt, sees the transaction for the first time,
 *      and fires INITIAL_PURCHASE carrying THAT id
 *   3. the route called `apply_subscription_event(p_user_id: '$RCAnonymousID:…')`
 *      and Postgres answered **`invalid input syntax for type uuid`** — verified
 *      by running it against the live database
 *   4. the route returned 500, RevenueCat retried, and **every retry failed
 *      identically**, because the id is still anonymous
 *
 * So the entitlement never landed and the runner had free access in an app they
 * had a paid entitlement for at Apple.
 *
 * ⚠️ A NON-UUID IS NOT AN ERROR TO RETRY. It is a delivery we cannot act on YET —
 * the same transaction arrives again, correctly keyed, once `logIn` aliases it.
 * The route therefore answers 200 and records it, instead of 500-looping.
 */
export function isSupabaseAppUserId(id: unknown): id is string {
  return typeof id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}
