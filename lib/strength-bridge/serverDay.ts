// STRENGTH-APP-01 (A′) — "is there a strength session on this date for this runner?",
// answered once for every SERVER surface that speaks about a day (the morning push,
// the daily coach note), so none of them can call a strength day a rest day.
//
// 🔒 Behind the same release gate as the routes. An optional read: a failure is logged
// and answers null, which leaves the surface exactly as it was before strength existed.

import type { SupabaseClient } from '@supabase/supabase-js'
import { canUseStrength } from './release'
import { strengthOnDate } from './display'
import type { StrengthPlan, StrengthSession } from '@/packages/strength'

export async function strengthSessionOn(
  supabase: SupabaseClient,
  userId: string,
  isoDate: string,
  access: { isAdmin: boolean; tier: 'free' | 'trial' | 'paid' },
): Promise<StrengthSession | null> {
  if (!canUseStrength(access)) return null
  const { data, error } = await supabase.from('strength_plans').select('plan_json').eq('user_id', userId).maybeSingle()
  if (error) { console.error('[strength] day read failed:', error.message); return null }
  return strengthOnDate((data?.plan_json as StrengthPlan | null) ?? null, isoDate)
}

/**
 * The session the morning push speaks about (STRENGTH-APP-01 A′). The run wins on a run
 * day; on a no-run or rest day a strength session takes its place, so the push says
 * "Strength today", never "Nothing today. On purpose."
 */
export function pushSessionFor<S extends { type: string }>(
  run: S | null,
  strength: StrengthSession | null,
): S | { type: 'strength'; duration_mins: number; distance_km: null } | null {
  const runIsRest = !run || run.type === 'rest'
  if (strength && runIsRest) return { type: 'strength', duration_mins: strength.estimated_minutes, distance_km: null }
  return run
}
