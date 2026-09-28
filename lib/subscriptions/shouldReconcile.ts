// SUBS-RECONCILE-TRIAL-GATE-01 (2026-09-28) — "should we ask RevenueCat whether this
// runner holds an entitlement we never recorded?"
//
// 🔴 THE GUARD THIS REPLACES EXCLUDED EXACTLY THE POPULATION IT EXISTED FOR.
// The first cut read `if (hasPaidAccess) return`, written as a cost optimisation: it
// "costs nothing for the ~all of users for whom the webhook worked normally". But
// `hasPaidAccess` is `tier !== 'free'`, and **every brand-new account is in a 14-day
// reverse trial**, so it is `true` for precisely the runners this check exists to
// rescue.
//
// Measured in production for `tester1@test.com`: a £0 one-year entitlement to
// 2027-09-28 sitting in RevenueCat, `trial_started_at` set, `resolveTier` returning
// `{ tier: 'trial', reason: 'trial' }`, `subscriptions` EMPTY, `ops_events` EMPTY —
// the reconcile route was never reached, twice, on two different app opens.
//
// ⚠️ AND THE DAMAGE WAS DEFERRED, WHICH IS WHY NOBODY WOULD HAVE CAUGHT IT. The trial
// masks the missing row for a fortnight. On day 15 the runner drops to free while
// holding a valid entitlement, roughly two weeks into a marathon block, and only then
// does the old guard let reconcile run. The fix is not "recover eventually" — it is to
// ask while the trial is still covering for us.
//
// 📐 THE RIGHT QUESTION IS NOT "DOES THIS RUNNER HAVE ACCESS?" BUT "IS THEIR ACCESS
// ALREADY EXPLAINED BY A RECORDED SUBSCRIPTION?" `resolveTier`'s `reason` answers it
// directly, which is what TIER-OWNER-01 added it for.
//
// Pure and unit-tested because the effect that consumes it lives in
// `app/dashboard/DashboardClient.tsx`, and `vitest` collects `lib/**` only — the same
// reason `stripeToStatus` was moved out of its route.

import type { TierReason } from '../trial'

export interface ReconcileGateInputs {
  /** Has the dashboard finished its initial load? Tier is unknown before this. */
  appReady: boolean
  /** The signed-in Supabase user id, or null. */
  userId: string | null
  /** `resolveTier().reason`, or null while it is still unknown. */
  tierReason: TierReason | null
  /** StoreKit only exists on the native shell. */
  isNative: boolean
  /** One attempt per mount. */
  alreadyTried: boolean
}

/**
 * Should the client ask the server to re-check this runner's entitlement?
 *
 * ⚠️ `'trial'` AND `'none'` BOTH RETURN TRUE, and that is the whole point of the
 * change. A trial runner can be holding an unrecorded Apple entitlement; the trial
 * says nothing about whether we recorded it.
 *
 * `'subscription'` returns false because their access is already explained by a row
 * in `subscriptions` — there is nothing to reconcile. `'admin'` returns false because
 * an admin's access is unconditional and a lookup would be pure cost.
 *
 * ⚠️ `'grant'` RETURNS TRUE. A charity runner on a Supabase grant may ALSO have
 * redeemed an Apple offer code, and `resolveTier` puts an active subscription above a
 * grant precisely so a runner who pays is resolved by their payment. Skipping them
 * would strand the overlap.
 */
export function shouldReconcile(i: ReconcileGateInputs): boolean {
  if (i.alreadyTried) return false
  if (!i.appReady || !i.userId) return false
  if (!i.isNative) return false          // no StoreKit receipt to alias off
  if (i.tierReason === null) return false // tier not resolved yet; ask later, not now
  return i.tierReason !== 'subscription' && i.tierReason !== 'admin'
}
