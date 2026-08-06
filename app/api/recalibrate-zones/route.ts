import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import type { BenchmarkInput } from '@/types/plan'
import { createClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { fetchPlanForUser, savePlanForUser, getCurrentWeek } from '@/lib/plan'
import { applyRecalibration } from '@/lib/plan/ruleEngine'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
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

    const plan = await fetchPlanForUser(user.id, supabase)
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
