import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import type { BenchmarkInput, Plan } from '@/types/plan'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { fetchPlanForUser, savePlanForUser, getCurrentWeek } from '@/lib/plan'
import { applyRecalibration } from '@/lib/plan/ruleEngine'

export async function POST(req: NextRequest) {
  try {
    // RECALIBRATE-ZONES-COOKIE-CLIENT-01 (2026-09-25) — SERVICE CLIENT, NOT THE
    // COOKIE CLIENT, and the reason is already written down twice on this route.
    //
    // This endpoint authenticates off the BEARER token (`getUserFromRequest`).
    // `AUTH-BEARER-MISSING-01` (2026-09-18) fixed the CLIENT half of that —
    // `authedFetch` attaches the token because "cookie sync is unreliable on
    // native", and a bare fetch 401'd every paid recalibration. **The SERVER half
    // of the same sentence was never fixed.** The route took the bearer and then
    // read the plan with a cookie-bound client, which on native hits RLS with no
    // session and returns nothing — so a runner who HAS a plan was told
    // "No plan found." We fixed the symptom that had been reported and left the
    // one nobody had hit yet.
    //
    // Confirmed live 2026-09-25: a trial user with exactly one row in `plans` and
    // a NULL `user_settings.plan_json` could not recalibrate at all.
    //
    // `post-race-reshape` carries this fix and this explanation verbatim, and
    // `maintenance-block` and `recalibrate-hr` both use the service client. This
    // was the last plan-fetching route on the cookie client.
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tier = await getUserTier(user.id)
    if (!isFeatureAllowed('dynamic_reshape_r20', tier)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
    }

    const { benchmark, recalibration_week_n }: { benchmark: BenchmarkInput; recalibration_week_n?: number } = await req.json()
    if (!benchmark?.type || !benchmark?.distance_km || !benchmark?.time) {
      return NextResponse.json({ error: 'Invalid benchmark input.' }, { status: 422 })
    }

    // Pass the same gist/legacy fallback the client uses, so a missing or
    // un-migrated `plans` row self-heals here instead of 404ing — `post-race-reshape`
    // does the same, for the same reason.
    const { data: settings } = await supabase
      .from('user_settings')
      .select('gist_url, plan_json')
      .eq('id', user.id)
      .single()

    const plan = await fetchPlanForUser(user.id, supabase, {
      gistUrl:        settings?.gist_url,
      legacyPlanJson: settings?.plan_json as Plan | null,
    })
    if (!plan.weeks.length) {
      return NextResponse.json({ error: 'No plan found.' }, { status: 404 })
    }

    const currentWeek = getCurrentWeek(plan.weeks)
    const fromWeekN = currentWeek?.n ?? 1

    const updatedPlan = applyRecalibration(plan, benchmark, fromWeekN)
    // PV2-H — record the recalibration week so the "your time trial is in" prompt
    // fires once (nextRecalibrationDue reads meta.recalibrations_applied).
    if (recalibration_week_n != null) {
      const applied = new Set(updatedPlan.meta.recalibrations_applied ?? [])
      applied.add(recalibration_week_n)
      updatedPlan.meta.recalibrations_applied = Array.from(applied).sort((a, b) => a - b)
    }
    await savePlanForUser(user.id, updatedPlan, supabase)

    const weeksUpdated = plan.weeks.length - (fromWeekN - 1)
    return NextResponse.json({ plan: updatedPlan, weeks_updated: weeksUpdated })

  } catch (e) {
    console.error('recalibrate-zones error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
