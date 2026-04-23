import { NextRequest, NextResponse } from 'next/server'
import type { BenchmarkInput } from '@/types/plan'
import { createClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/trial'
import { fetchPlanForUser, savePlanForUser, getCurrentWeek } from '@/lib/plan'
import { applyRecalibration } from '@/lib/plan/ruleEngine'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const tier = await getUserTier(user.id)
    if (tier === 'free') return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

    const { benchmark }: { benchmark: BenchmarkInput } = await req.json()
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
    await savePlanForUser(user.id, updatedPlan, supabase)

    const weeksUpdated = plan.weeks.length - (fromWeekN - 1)
    return NextResponse.json({ plan: updatedPlan, weeks_updated: weeksUpdated })

  } catch (e) {
    console.error('recalibrate-zones error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
