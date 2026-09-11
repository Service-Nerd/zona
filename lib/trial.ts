import { isGrantActive } from '@/lib/charity/grantWindow'

export const TRIAL_DAYS = 14

export type UserTier = 'free' | 'trial' | 'paid'

// Pure — safe to call on client or server.
export function isTrialActive(trialStartedAt: string | null | undefined): boolean {
  if (!trialStartedAt) return false
  const elapsed = Date.now() - new Date(trialStartedAt).getTime()
  return elapsed < TRIAL_DAYS * 24 * 60 * 60 * 1000
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

  if (settings?.is_admin) return 'paid'

  if (
    sub?.status &&
    ['trialing', 'active'].includes(sub.status) &&
    new Date(sub.current_period_end) > new Date()
  ) {
    return 'paid'
  }

  if (isGrantActive(grant?.expires_at ? new Date(grant.expires_at) : null, new Date())) {
    return 'paid'
  }

  return isTrialActive(settings?.trial_started_at) ? 'trial' : 'free'
}

// Convenience wrapper — kept for existing callers (strava/callback, claude route).
export async function hasPaidAccess(userId: string): Promise<boolean> {
  return (await getUserTier(userId)) !== 'free'
}
