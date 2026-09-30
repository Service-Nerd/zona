// SUBS-COMPED-WRITER-01 (2026-09-30) — the single owner of "was this entitlement
// given away, or paid for?"
//
// ── WHY IT EXISTS ─────────────────────────────────────────────
// `20260928_comped_entitlement_not_a_conversion.sql` added `subscriptions.is_comped`
// and a 6th `apply_subscription_event` parameter to carry it. That migration is the
// SCHEMA half. It shipped, was applied on 2026-09-30, and **nothing wrote the flag**,
// so the column read `false` for every row and `v_trial_conversion.converted_real`
// still counted a gifted runner as a sale. 500 Make-A-Wish offer codes go out today;
// every one lands a real `subscriptions` row and NO `charity_codes` row, so
// `had_charity_grant` cannot exclude them either.
//
// ⚠️ THIS IS THE SECOND HALF, AND THE FIRST ON ITS OWN CHANGED NOTHING. Applying the
// migration made the column exist. It did not make it true. That gap is this repo's
// recorded "both halves correct, the composition untested" class, arriving as "one
// half shipped and looked like the whole thing".
//
// ── 📐 THE DISCRIMINATOR IS MEASURED, NOT ASSUMED ────────────────────
// Read from `GET /v1/subscribers/{id}` for BOTH real 2026-09-28 redemptions:
//
//   period_type: "trial"   price: { amount: 0, currency: "GBP" }   store: "app_store"
//
// A paying annual subscriber reads `period_type: "normal"` with a non-zero price.
//
// 🔴 AND THE ONE DEPENDENCY THAT WOULD BREAK IT, NAMED BECAUSE IT IS INVISIBLE.
// `period_type: "trial"` is ALSO what Apple reports during an **introductory free
// trial** — so on a product that offers one, a genuine paying subscriber's first
// period would be marked comped. **This product has none:** the Apple intro trial was
// de-stacked on 2026-08-06 (MON-TRIAL-01, backlog W2 — *"Intro trial de-stacked"*),
// because Zonna runs its own 14-day reverse trial in-app instead.
//
// ⚠️ SO IF AN INTRODUCTORY OFFER IS EVER RE-ADDED IN APP STORE CONNECT, THIS FLAG
// STARTS LYING, and it lies in the direction that under-counts revenue. There is no
// mechanical guard available for that — App Store Connect is external state this repo
// cannot read, the same class as the Strava webhook subscription
// (STRAVA-WEBHOOK-OBS-01). The mitigation is that `price` must ALSO be zero and the
// raw values are recorded in the ops trail on every write, so the first mismarked
// row is visible rather than silent.
//
// ── ⚠️ TWO SHAPES, AND THE CASING DIFFERS ───────────────────────────
// The two writers see different payloads:
//
//   reconcile → subscriber object → `period_type: "trial"`, `price: { amount: 0 }`
//   webhook   → event object      → `period_type: "TRIAL"`, `price: 0`  (per RevenueCat
//                                    webhook docs: UPPERCASE enum, price as a number)
//
// 🔴 The webhook shape is NOT verified against a real captured payload — the four
// `revenuecat_event_unusable` rows recorded only `event_type` and a truncated id, not
// the body. So this module accepts BOTH shapes, compares the period case-insensitively,
// and the callers record what they actually saw. **Claiming the webhook field works
// before a real payload has been read is exactly the overstatement
// `offerCodeFor`'s comment had to retract**, so it is not claimed here.

/** The period types Apple/RevenueCat report for a purchase that cost nothing. */
const FREE_PERIOD_TYPES = ['trial', 'promotional', 'intro'] as const

/**
 * Normalise RevenueCat's `price`, which is an object on the subscriber and a bare
 * number on the webhook event.
 *
 * ⚠️ Returns `null` for absent, NEVER `0`. `?? 0` here would assert "this purchase
 * cost nothing" for a payload that simply did not carry the field — the exact
 * `distance_km ?? 0` class this repo has paid for four times. A null price means
 * "unknown", and unknown must not read as free.
 */
export function priceAmount(price: unknown): number | null {
  if (typeof price === 'number') return Number.isFinite(price) ? price : null
  if (price && typeof price === 'object') {
    const a = (price as { amount?: unknown }).amount
    if (typeof a === 'number' && Number.isFinite(a)) return a
  }
  return null
}

/**
 * Was this entitlement granted at no charge?
 *
 * BOTH conditions are required, and that is the safety margin against the intro-trial
 * dependency above: a free period type alone is not enough, the price must also be
 * zero. An unknown price (`null`) therefore reads as NOT comped — which errs toward
 * counting a gift as a sale, i.e. it under-states conversion rather than over-stating
 * it. That is the direction a commercial number should fail in.
 */
export function isCompedPurchase(
  periodType: unknown,
  price: unknown,
): boolean {
  if (typeof periodType !== 'string') return false
  const p = periodType.trim().toLowerCase()
  if (!(FREE_PERIOD_TYPES as readonly string[]).includes(p)) return false
  return priceAmount(price) === 0
}

/** What a caller records in the ops trail, so a mismarked row is inspectable. */
export interface CompedEvidence {
  is_comped: boolean
  period_type: string | null
  price_amount: number | null
}

/** The raw values behind a verdict, for the ops trail. */
export function compedEvidence(periodType: unknown, price: unknown): CompedEvidence {
  return {
    is_comped: isCompedPurchase(periodType, price),
    period_type: typeof periodType === 'string' ? periodType : null,
    price_amount: priceAmount(price),
  }
}

/** The subscriber-object fields this reads. Structural, so `entitlement.ts` can widen. */
interface PricedSubscription {
  period_type?: unknown
  price?: unknown
}

/**
 * The verdict for one product inside a subscriber payload.
 *
 * ⚠️ MIRRORS `offerCodeFor` DELIBERATELY rather than adding a second way to walk the
 * same object: look up the entitlement's own product first, and fall back only when
 * exactly one subscription is present. With two or more and no product match there is
 * no non-guessing answer, so it returns not-comped — the safe direction, per above.
 */
export function compedFromSubscriber(
  subs: Record<string, PricedSubscription | undefined> | undefined,
  productId: string | undefined,
): CompedEvidence {
  if (!subs) return compedEvidence(null, null)
  const row = (productId ? subs[productId] : undefined)
    ?? (Object.keys(subs).length === 1 ? Object.values(subs)[0] : undefined)
  return compedEvidence(row?.period_type, row?.price)
}
