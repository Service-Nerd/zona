import { isGrantActive } from '@/lib/charity/grantWindow'

export const TRIAL_DAYS = 14

export type UserTier = 'free' | 'trial' | 'paid'

// Pure — safe to call on client or server.
// `now` is injectable so `resolveTier` can be tested against a fixed clock.
// Defaulted, so the ~30 existing `isTrialActive(x)` call sites are unchanged.
export function isTrialActive(
  trialStartedAt: string | Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!trialStartedAt) return false
  const elapsed = now.getTime() - new Date(trialStartedAt).getTime()
  return elapsed < TRIAL_DAYS * 24 * 60 * 60 * 1000
}

/** WHY access resolved the way it did. The tier alone cannot answer "what do we
 *  say to this person when it ends?" — a lapsed 14-day trial and a lapsed
 *  charity grant both resolve to `free`, and telling a comped charity runner
 *  "14 days done" is wrong about something they would notice. */
export type TierReason = 'admin' | 'subscription' | 'grant' | 'trial' | 'none'

export interface TierInputs {
  isAdmin?: boolean | null
  /** `subscriptions.status` */
  subStatus?: string | null
  /** `subscriptions.current_period_end` */
  subPeriodEnd?: string | Date | null
  /** `charity_codes.expires_at` for the row claimed by this user */
  grantExpiresAt?: string | Date | null
  /** `user_settings.trial_started_at` */
  trialStartedAt?: string | Date | null
}

export interface TierResolution {
  tier: UserTier
  reason: TierReason
}

const asDate = (v: string | Date | null | undefined): Date | null =>
  v == null ? null : v instanceof Date ? v : new Date(v)

/**
 * THE SINGLE OWNER of the tier resolution order: admin → active subscription →
 * charity grant → trial → free. Pure, so the server, the client mirror and the
 * tests all run the same rule.
 *
 * WHY THIS EXISTS. The order used to be written out in three places: here in
 * `getUserTier`, again as an OR-chain in `DashboardClient` (which cannot call a
 * service-role function), and a THIRD time as a private `resolve()` inside
 * `tierResolution.test.ts`. The test therefore asserted its own copy was
 * correct and could not catch either producer drifting — the same flaw
 * CLAUDE.md documents for `deloadCadence.test.ts`, where a checker sharing the
 * producer's predicate cannot catch the producer being wrong. D-16 (no parallel
 * semantics) had a comment warning about it and no mechanism enforcing it, and
 * the split was nearly shipped once already: the server order was changed and
 * the client mirror sat two commits behind, which would have made a comped
 * runner `paid` on the server and `free` in the UI.
 *
 * ORDER IS DELIBERATE, not incidental:
 *  - `is_admin` first, so support accounts work without a billing artefact.
 *  - Subscription ABOVE grant: a runner who later pays is resolved by their
 *    payment, so their tier does not flip the day an expiring gift lapses.
 *  - Grant ABOVE trial: the whole point of the feature. Below it, a comped
 *    charity runner would hit the marathon paywall on day 15.
 */
export function resolveTier(input: TierInputs, now: Date = new Date()): TierResolution {
  if (input.isAdmin) return { tier: 'paid', reason: 'admin' }

  const periodEnd = asDate(input.subPeriodEnd)
  if (
    input.subStatus &&
    ['trialing', 'active'].includes(input.subStatus) &&
    periodEnd && periodEnd > now
  ) {
    return { tier: 'paid', reason: 'subscription' }
  }

  if (isGrantActive(asDate(input.grantExpiresAt), now)) {
    return { tier: 'paid', reason: 'grant' }
  }

  if (isTrialActive(input.trialStartedAt, now)) return { tier: 'trial', reason: 'trial' }

  return { tier: 'free', reason: 'none' }
}

// Server-only — uses service role to bypass RLS.
// Resolution order: admin → active subscription → charity grant → trial → free.
// `is_admin` accounts (owner / developer / support) always resolve as paid so
// the full server feature set — push registration, AI routes, Strava — is
// available without a billing artefact. See ADR-003 § Admin entitlement.
//
// GTM-CHARITY-04 — a redeemed charity code resolves as `paid`, and is read from
// `charity_codes` rather than written into `subscriptions`. Three reasons:
// `subscriptions.provider` has CHECK (provider IN ('revenuecat','stripe')) so a
// grant row would fail on insert; that table is upserted `onConflict: user_id`
// by the RevenueCat webhook, so a later RC event would silently overwrite a
// grant; and a comp is not a subscription, so conflating an entitlement with
// billing state is the two-writer class this codebase keeps getting bitten by.
// It sits BELOW an active subscription deliberately: a runner who later pays
// should be resolved by their payment, not by an expiring gift.
export async function getUserTier(userId: string): Promise<UserTier> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: sub }, { data: settings }, { data: grant }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('trial_started_at, is_admin')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('charity_codes')
      .select('expires_at')
      .eq('claimed_by', userId)
      .maybeSingle(),
  ])

  // The ORDER lives in `resolveTier`, not here. This function's only job is to
  // fetch the four rows; deciding what they mean is the pure owner's.
  return resolveTier({
    isAdmin: settings?.is_admin,
    subStatus: sub?.status,
    subPeriodEnd: sub?.current_period_end,
    grantExpiresAt: grant?.expires_at,
    trialStartedAt: settings?.trial_started_at,
  }).tier
}

// Convenience wrapper — kept for existing callers (strava/callback, claude route).
export async function hasPaidAccess(userId: string): Promise<boolean> {
  return (await getUserTier(userId)) !== 'free'
}
