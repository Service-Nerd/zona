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

  // 🔴 TAPER-RECAL-COLUMN-01 — THIS READ `strava_activities`, WHICH HAS NEITHER
  // COLUMN. §68 has therefore NEVER APPLIED, for any runner, since it shipped.
  //
  // The query returned `{ data: null, error }`, the error was destructured away,
  // `weeklyActuals` was empty, and `computeTaperRecalibration` answered
  // "insufficient actual data (0 < 2 weeks)" every single time. `week_n` and
  // `actual_load_km` live on `run_analysis`, and the correct query already
  // existed NINE LINES APART in a sibling route (`adjust-plan/route.ts:131`) —
  // the same shape as HK-ELEV-COLUMN-01, where the right column name was also
  // already present elsewhere in the same codebase.
  //
  // ⚠️ `superseded_at is null` IS LOAD-BEARING AND THE OLD QUERY HAD NO
  // EQUIVALENT. `week_n` is a WITHIN-PLAN coordinate (PLAN-WEEK-COLLISION-01),
  // so without it a previous plan's week 8 is summed into this plan's week 8 and
  // the functional peak is computed from training the runner did for a different
  // race. The broken query never needed the filter because it never returned a
  // row; switching the table on without it would trade a dormant feature for a
  // wrong one.
  //
  // ⚠️ Manual logs are deliberately INCLUDED (no `source` filter, matching
  // `adjust-plan`). §68 re-anchors to "the body that actually trained", and a
  // manually logged run is training the body did. `phase-summary` excludes
  // manual because it scores zone discipline, which a manual row cannot carry —
  // a different question.
  const { data: activityRows, error: actualsErr } = await serviceSupabase
    .from('run_analysis')
    .select('week_n, actual_load_km')
    .eq('user_id', user.id)
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
    .not('week_n', 'is', null)
    .gte('week_n', 1)
    .lte('week_n', buildPeakEndWeek)
    .gt('actual_load_km', 0)

  // Read the error rather than letting a failed query read as "no training".
  // That conflation is what hid this defect for its whole life.
  if (actualsErr) {
    console.error('[recalibrate-taper] actuals query failed', actualsErr)
    return NextResponse.json({ skipped: true, reason: 'actuals_query_failed' }, { status: 200 })
  }

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
