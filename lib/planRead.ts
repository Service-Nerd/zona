import type { SupabaseClient } from '@supabase/supabase-js'
import type { Plan } from '@/types/plan'

/**
 * PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16) — a READ that failed, as distinct from a runner
 * with no plan. Thrown by `fetchPlanForUser`; caught by the dashboard, which shows the
 * "Couldn't load your plan" state instead of the wizard.
 */
export class PlanReadError extends Error {
  constructor(message: string) { super(message); this.name = 'PlanReadError' }
}

/**
 * PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16) — THE one read of a runner's `plans` row.
 *
 * 🔴 WHY ONE OWNER. Eighteen call sites wrote this query by hand, all with `.single()`,
 * which reports ZERO rows as an error: 89 of 94 Supabase warnings in one day were these
 * 406s for runners with no plan yet. Worse, not one of the eighteen read the error, so a
 * REAL database failure was indistinguishable from "no plan", and on the auto-migrate path
 * below that meant saving a runner's OLD gist/legacy plan over their current one (3 live
 * runners exposed, measured 2026-10-16). `.maybeSingle()` returns null data and no error
 * for zero rows; anything left in `error` is a genuine failure, and the caller decides.
 */
export async function readPlanJson(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ plan: Plan | null; error: string | null }> {
  const { data, error } = await supabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { plan: null, error: error.message }
  return { plan: (data?.plan_json as Plan | null) ?? null, error: null }
}
