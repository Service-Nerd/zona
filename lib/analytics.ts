import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Behavioural analytics events (INSTRUMENT-01).
 *
 * This union is the single source of truth for event names. The `analytics_events`
 * table has no CHECK constraint on `event`, so a new event ships by adding a member
 * here — no migration needed (mirrors NotificationType in lib/notifications.ts).
 *
 * Keep events behavioural. Never put PII or user content in `props`.
 */
export type AnalyticsEvent =
  | 'coach_open' // user navigated into the Coach screen — powers the CO-ONE engagement gate
  // ── OPS-FUNNEL-01 (2026-09-28) — the upgrade funnel ────────────────────────
  //
  // 🔴 WHY: the 1 January trial-to-paid gate reads `v_trial_conversion`, which can
  // report a RATE and nothing else. Measured in production 2026-09-28, this table
  // held 192 rows of exactly ONE event type (`coach_open`), so if that gate reads
  // 0% the data could not distinguish "nobody reached the paywall" from "they
  // reached it and left" from "they tried to buy and it failed". The denominator
  // was observable and the numerator was observable; everything between them was
  // not. `design-rulings.md` (the SLT-killed merchandising screen) names the same
  // hole from the other side: "we would be designing a funnel nobody has observed."
  //
  // Three events, one per answerable question: was it SEEN, was it TRIED, what
  // HAPPENED. Behavioural only — no price, no receipt, no identifier.
  /** The Upgrade screen mounted. `props.reason` is `upgradeFraming()`'s variant
   *  (gain | trial-ended | grant-ended), reused rather than re-derived. */
  | 'upgrade_view'
  /** Subscribe tapped. `props`: { annual, platform }. Fires BEFORE the store sheet,
   *  so a sheet that never opens is still visible as an attempt with no result. */
  | 'upgrade_purchase_attempt'
  /** How it ended. `props.outcome`: success | cancelled | failed.
   *  ⚠️ `cancelled` is NOT a failure and must stay separable — a funnel that
   *  counts a dismissed StoreKit sheet as a broken purchase would send someone
   *  hunting a defect that does not exist. */
  | 'upgrade_purchase_result'

/**
 * Fire-and-forget telemetry write.
 *
 * Never throws and never blocks the UI: a dropped analytics event is not a
 * user-facing failure. The insert runs in the background; RLS allows the client
 * to INSERT its own rows but not read them (all analysis is owner/service-role
 * via the report views). A no-op when `userId` is not yet known.
 */
export function trackEvent(
  supabase: SupabaseClient,
  userId: string | null,
  event: AnalyticsEvent,
  props: Record<string, unknown> = {},
): void {
  if (!userId) return
  void supabase
    .from('analytics_events')
    .insert({ user_id: userId, event, props })
    .then(({ error }) => {
      if (error) console.warn('[analytics] event dropped:', event, error.message)
    })
}

/**
 * How a purchase attempt ended, for `upgrade_purchase_result`.
 *
 * ⚠️ `redirected` EXISTS SO THE WEB PATH IS NOT COUNTED AS A SALE. On web,
 * `handleSubscribe` hands off to Stripe Checkout and the purchase completes on
 * Stripe's domain, so the app never observes the outcome — the webhook does.
 * Recording that handoff as `success` would overstate conversion on exactly the
 * number the 1 January gate reads, which is the failure mode this instrumentation
 * exists to prevent rather than create. `success` is reserved for a StoreKit
 * purchase that actually resolved.
 */
export type PurchaseOutcome = 'success' | 'redirected' | 'cancelled' | 'failed'

/**
 * Did the USER dismiss the store sheet, rather than the purchase failing?
 *
 * 🔴 SINGLE OWNER, because this rule already existed TWICE in `UpgradeScreen` and
 * the two copies had drifted: `handleSubscribe` tested `err?.userCancelled === true`
 * and `handleRestore` tested `err?.userCancelled` (truthy). Nothing was visibly
 * broken — both reach the same verdict for RevenueCat's actual boolean — but it is
 * one rule with two answers, which is the class this repo keeps paying for
 * (TIER-OWNER-01, DELOAD-OWNER-01, SESSION-KM-01).
 *
 * Now it matters more than it did: it decides whether the funnel records a
 * `cancelled` or a `failed`, and those two lead to opposite conclusions about
 * whether the purchase path works. STRICT `=== true` is kept deliberately — a
 * truthy test would classify any object-shaped `userCancelled` as a cancellation
 * and hide a real failure as a shrug.
 */
export function isUserCancelled(err: unknown): boolean {
  return (err as { userCancelled?: unknown } | null | undefined)?.userCancelled === true
}

/** The outcome to record for a thrown purchase error. */
export function purchaseOutcome(err: unknown): Extract<PurchaseOutcome, 'cancelled' | 'failed'> {
  return isUserCancelled(err) ? 'cancelled' : 'failed'
}
