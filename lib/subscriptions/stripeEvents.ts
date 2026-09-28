// The Stripe half of "what does this provider's state mean for access?", extracted
// to `lib/` on 2026-09-28 so it can be tested at all.
//
// 🔴 WHY IT MOVED. `vitest` collects `lib/**` and `components/**`, never `app/**`.
// This mapping lived as a private `toStatus` inside `app/api/webhooks/stripe/route.ts`,
// so the single most consequential decision in the billing path — does this
// customer still have access? — had no test and could not have one. Its RevenueCat
// twin has lived in `lib/` with a case-per-event test since it was written.
//
// ⚠️ IT WAS FOUND BY A SWEEP, NOT BY A REPORT. `SUBS-CANCELLATION-TIER-01` fixed
// the RevenueCat side mapping an auto-renew-off event to a revoking status; exit
// criterion 3 says grep for the SHAPE of the fix, and this was the other provider
// doing the same thing.

import type Stripe from 'stripe'

export type SubscriptionStatus = 'trialing' | 'active' | 'cancelled' | 'expired'

/**
 * Stripe subscription status -> the status we store, or `null` for "record the
 * event and change nothing".
 *
 * 🔴 `past_due` RETURNS null, AND IT USED TO RETURN 'expired'. That was the same
 * defect as CANCELLATION on the RevenueCat side, and the argument against it was
 * already written down in `revenuecatEvents.ts`:
 *
 *   "A billing issue opens Apple's GRACE PERIOD: the runner still has access and
 *    Apple retries. Mapping it to `cancelled` or `expired` would revoke a paying
 *    customer mid-grace"
 *
 * `past_due` is precisely that: the invoice failed and **Stripe is still retrying**.
 * The subscription is not over, the customer has paid for the period they are in,
 * and if the retries ultimately fail Stripe moves it to `unpaid` or `canceled`,
 * both of which ARE handled. Revoking during the retry window charges a real
 * customer for access we then took away.
 *
 * 📐 Safe as well as correct: `resolveTier` independently requires
 * `current_period_end > now`, so returning null cannot extend access past the
 * period the customer actually paid for.
 *
 * ⚠️ `canceled` DOES revoke, and that is not inconsistent with the RevenueCat
 * fix. Stripe's `canceled` means the subscription has ended; Apple's CANCELLATION
 * means renewal was switched off. Same word, different events.
 */
export function stripeToStatus(
  stripeStatus: Stripe.Subscription.Status,
): SubscriptionStatus | null {
  switch (stripeStatus) {
    case 'trialing': return 'trialing'
    case 'active':   return 'active'

    // Ended. Access is over. `canceled` keeps its own word rather than being
    // folded into `expired`: the distinction is carried in the stored row and
    // `resolveTier` declines both, so nothing is gained by flattening it.
    case 'canceled':
      return 'cancelled'
    case 'unpaid':               // retries exhausted, Stripe gave up
    case 'incomplete_expired':   // first payment never completed
      return 'expired'

    // Retrying. Access continues; see the block comment above.
    case 'past_due':
      return null

    default:
      return null
  }
}
