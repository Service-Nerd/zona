// GTM-CHARITY-04 — re-anchor a live charity grant to the runner's race date.
//
// Called from `savePlanForUser`, which is the single owner of plan writes, so
// every path that can set a race date is covered: the wizard, a reshape, a
// recalibration, the maintenance handoff. Putting it at any individual route
// would mean the next new route silently misses it, which is the duplicate-
// ownership class ADR-020 exists to prevent.
//
// NEVER THROWS. A grant date is not worth failing a plan save over: the runner
// would lose their plan to protect an expiry. Failure logs and leaves the
// existing window intact, which is the safe direction (they keep access).

import type { SupabaseClient } from '@supabase/supabase-js'
import { reanchorGrantExpiry } from './grantWindow'

export async function reanchorCharityGrant(
  userId: string,
  raceDate: string | null | undefined,
  supabase: SupabaseClient,
): Promise<void> {
  try {
    if (!raceDate) return

    const parsed = new Date(raceDate)
    if (Number.isNaN(parsed.getTime())) return

    const { data: grant } = await supabase
      .from('charity_codes')
      .select('id, claimed_at, expires_at')
      .eq('claimed_by', userId)
      .maybeSingle()

    // No grant is the overwhelmingly common case — every paying and trialling
    // user takes this branch, so it stays one cheap indexed read and no write.
    if (!grant?.claimed_at || !grant?.expires_at) return

    const currentExpiry = new Date(grant.expires_at)
    const next = reanchorGrantExpiry({
      grantedAt: new Date(grant.claimed_at),
      currentExpiry,
      raceDate: parsed,
    })

    // Extend-only means most saves compute the same date they already have.
    // Skip the write rather than churn the row on every reshape.
    if (next.getTime() === currentExpiry.getTime()) return

    const { error } = await supabase
      .from('charity_codes')
      .update({ expires_at: next.toISOString() })
      .eq('id', grant.id)

    if (error) console.error('[charity/reanchor] update failed', error.message)
  } catch (err) {
    console.error('[charity/reanchor] unexpected failure', err)
  }
}
