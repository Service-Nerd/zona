// ENGINE-04 — taper recalibration API route
// PAID — fires once per plan at taper entry (idempotent via plan.meta.taper_recalibrated_at)
//
// POST /api/recalibrate-taper
// No body required. Derives everything from the user's live plan + strava_activities.
//
// Checks:
//   - User is paid or trial (dynamic_reshape_r20)
//   - Current week is the first week of the taper phase
//   - Plan has not already been recalibrated (meta.taper_recalibrated_at absent)
//   - At least TAPER_RECAL_MIN_WEEKS_DATA actual weeks are on record for build/peak weeks
//   - Actual functional peak is below TAPER_RECAL_VOLUME_THRESHOLD_PCT of planned peak
//
// On success: saves the recalibrated plan, returns { recalibrated: true, plan, ... }
// On skip: returns { skipped: true, reason }
//
// CoachingPrinciples §68. ADR-006 (hybrid pattern — this is the deterministic step only).

import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { getCurrentWeekIndex, savePlanForUser } from '@/lib/plan'
import { computeTaperRecalibration } from '@/lib/plan/taperRecalibration'
import type { Plan } from '@/types/plan'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('dynamic_reshape_r20', tier)) {
    return NextResponse.json({ skipped: true, reason: 'subscription_required' })
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Load plan
  const planRes = await serviceSupabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', user.id)
    .single()

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no_plan' })
  }

  const weekIndex  = getCurrentWeekIndex(plan.weeks)
  const currentWeekN = weekIndex + 1

  // Load actual weekly volumes for build + peak weeks.
  // strava_activities.week_n is populated when an activity is linked to the plan.
  // We sum actual_load_km (set during Strava/HealthKit ingest) per plan week.
  const taperPhase = plan.phases?.find(p => p.name === 'taper')
    ?? (() => {
      const firstTaper = plan.weeks.find(w => w.phase === 'taper')
      const lastTaper  = [...plan.weeks].reverse().find(w => w.phase === 'taper')
      if (!firstTaper || !lastTaper) return null
      return { name: 'taper' as const, start_week: firstTaper.n, end_week: lastTaper.n }
    })()

  if (!taperPhase) {
    return NextResponse.json({ skipped: true, reason: 'no_taper_phase' })
  }

  // Only query build + peak weeks (everything before taper)
  const buildPeakEndWeek = taperPhase.start_week - 1

  const { data: activityRows } = await serviceSupabase
    .from('strava_activities')
    .select('week_n, actual_load_km')
    .eq('user_id', user.id)
    .not('week_n', 'is', null)
    .gte('week_n', 1)
    .lte('week_n', buildPeakEndWeek)
    .gt('actual_load_km', 0)

  // Aggregate actual km per week
  const weeklyActuals = new Map<number, number>()
  for (const row of activityRows ?? []) {
    if (row.week_n == null || row.actual_load_km == null) continue
    weeklyActuals.set(row.week_n, (weeklyActuals.get(row.week_n) ?? 0) + row.actual_load_km)
  }

  const result = computeTaperRecalibration({ weeklyActuals, plan, currentWeekN })

  if (!result.applied) {
    return NextResponse.json({ skipped: true, reason: result.skipReason })
  }

  // Save the recalibrated plan (savePlanForUser archives to plan_archive automatically)
  await savePlanForUser(user.id, result.plan!, serviceSupabase)

  return NextResponse.json({
    recalibrated:     true,
    plan:             result.plan,
    functionalPeakKm: result.functionalPeakKm,
    plannedPeakKm:    result.plannedPreTaperKm,
    ratio:            result.ratio,
    weeksModified:    result.weeksModified,
  })
}
