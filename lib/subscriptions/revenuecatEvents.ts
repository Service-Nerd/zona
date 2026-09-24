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
