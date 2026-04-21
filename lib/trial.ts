const TRIAL_DAYS = 14

export type UserTier = 'free' | 'trial' | 'paid'

// Pure — safe to call on client or server.
export function isTrialActive(trialStartedAt: string | null | undefined): boolean {
  if (!trialStartedAt) return false
  const elapsed = Date.now() - new Date(trialStartedAt).getTime()
  return elapsed < TRIAL_DAYS * 24 * 60 * 60 * 1000
}

// Server-only — uses service role to bypass RLS.
// Resolution order: active subscription → trial window → free.
export async function getUserTier(userId: string): Promise<UserTier> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: sub }, { data: settings }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('trial_started_at')
      .eq('id', userId)
      .maybeSingle(),
  ])

  if (
    sub?.status &&
    ['trialing', 'active'].includes(sub.status) &&
    new Date(sub.current_period_end) > new Date()
  ) {
    return 'paid'
  }

  return isTrialActive(settings?.trial_started_at) ? 'trial' : 'free'
}

// Convenience wrapper — kept for existing callers (strava/callback, claude route).
export async function hasPaidAccess(userId: string): Promise<boolean> {
  return (await getUserTier(userId)) !== 'free'
}
