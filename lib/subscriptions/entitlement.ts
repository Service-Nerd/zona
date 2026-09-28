// CHARITY-OFFER-CODE-01 (2026-09-28) — reading an entitlement out of RevenueCat's
// subscriber payload, so the server can answer "is this runner actually entitled?"
// without believing the client.
//
// ── WHY A SERVER-SIDE READ EXISTS AT ALL ────────────────────────────────────
// The webhook is asynchronous and, for the offer-code journey, can arrive keyed to
// an id the database cannot store (see `isSupabaseAppUserId`). That leaves a
// runner who has genuinely redeemed a code sitting on the free tier with nothing
// in the app able to correct it.
//
// 🔴 AND THE CLIENT CANNOT BE THE ONE TO SAY SO. The obvious shortcut is to let
// the app read `customerInfo` locally and tell the server "I'm entitled" — that is
// a free subscription for anyone who can call an endpoint. So the app only ever
// says "please re-check me", and the SERVER asks RevenueCat directly. This module
// is the pure half of that: given RevenueCat's answer, what does it mean.
//
// Pure and unit-tested, because `vitest` collects `lib/**` only and this decides
// who gets paid access.

/** The shape we care about from `GET /v1/subscribers/{app_user_id}`. */
export interface RevenueCatSubscriber {
  subscriber?: {
    entitlements?: Record<string, {
      expires_date?: string | null
      product_identifier?: string
    }>
    subscriptions?: Record<string, {
      expires_date?: string | null
      /** Present when the purchase came from an offer code. */
      offer_code?: string | null
    }>
  }
}

export interface EntitlementRead {
  entitled: boolean
  /** ISO, or null for a non-expiring (lifetime) entitlement. */
  expiresAt: string | null
  /** Which entitlement granted it, for the ops trail. */
  entitlementId: string | null
  /** The offer code, when RevenueCat exposes one — this is the COHORT key. */
  offerCode: string | null
}

const NONE: EntitlementRead =
  { entitled: false, expiresAt: null, entitlementId: null, offerCode: null }

/**
 * Is this subscriber entitled right now, and until when?
 *
 * ⚠️ `expires_date: null` MEANS LIFETIME, NOT EXPIRED. Reading a null as "no
 * expiry date, therefore not active" would silently deny access to exactly the
 * non-expiring grants a charity partnership hands out. It is the `?? 0` class of
 * default this repo keeps paying for, and the reason this is a named function
 * rather than an inline truthiness check at a call site.
 *
 * ⚠️ THE LATEST EXPIRY WINS when several entitlements are active — a runner who
 * redeems a code while already subscribed keeps the longer of the two, which is
 * the only reading that cannot take access away from someone who paid.
 */
export function readEntitlement(
  payload: RevenueCatSubscriber | null | undefined,
  now: Date = new Date(),
): EntitlementRead {
  const ents = payload?.subscriber?.entitlements
  if (!ents) return NONE

  const active: EntitlementRead[] = []
  for (const [id, e] of Object.entries(ents)) {
    const raw = e?.expires_date ?? null
    if (raw !== null) {
      const t = new Date(raw).getTime()
      if (!Number.isFinite(t) || t <= now.getTime()) continue   // expired or unparseable
    }
    active.push({
      entitled: true,
      expiresAt: raw,
      entitlementId: id,
      offerCode: offerCodeFor(payload, e?.product_identifier),
    })
  }
  if (active.length === 0) return NONE

  // A lifetime grant (null) outranks every dated one; otherwise the latest wins.
  const lifetime = active.find(a => a.expiresAt === null)
  if (lifetime) return lifetime
  return active.reduce((a, b) =>
    new Date(b.expiresAt as string) > new Date(a.expiresAt as string) ? b : a)
}

/**
 * The offer code behind a product, when RevenueCat reports one.
 *
 * 🔴 MEASURED 2026-09-28 AND THIS COMMENT USED TO OVERSTATE IT. It previously read
 * "CONFIRMED IN REVENUECAT'S DOCS: the webhook and subscriber payloads carry an
 * `offer_code` field". A real redemption was then inspected through
 * `GET /v1/subscribers/{id}` and the `subscriptions` object carried **no
 * `offer_code` key at all** — store, product, prices, dates, ownership, but not
 * the code. So cohort tagging via THIS path returns null for every runner.
 *
 * The webhook's `event` object may still carry it; that is untested and must not
 * be claimed until a real webhook payload has been read. Until then the cohort is
 * countable from `revenuecat_reconciled` rows, not from the code itself.
 *
 * ⚠️ The shape stays and so does the read: it is optional in the type, costs
 * nothing, and starts working the day RevenueCat includes it.
 *
 * Returns null when absent, and the caller must treat null as "no cohort", never
 * as a default cohort.
 */
function offerCodeFor(
  payload: RevenueCatSubscriber | null | undefined,
  productId: string | undefined,
): string | null {
  const subs = payload?.subscriber?.subscriptions
  if (!subs) return null
  if (productId && subs[productId]?.offer_code) return subs[productId].offer_code ?? null
  // Fall back to any subscription carrying one — a runner has at most a handful,
  // and attributing the wrong cohort is better caught than silently guessed, so
  // this only fires when exactly one code is present.
  const codes = Object.values(subs).map(s => s?.offer_code).filter((c): c is string => !!c)
  return codes.length === 1 ? codes[0] : null
}
