import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { savePlanForUser } from '@/lib/plan'
import type { Plan } from '@/types/plan'

// POST /api/revert-adjustment
// Auth-gated (paid/trial). Reverts a plan adjustment using the sessions_before snapshot.

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('dynamic_reshape_r20', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const { adjustment_id } = await req.json()
  if (!adjustment_id) return NextResponse.json({ error: 'adjustment_id required' }, { status: 422 })

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch the adjustment
  const { data: adjustment, error: adjError } = await serviceSupabase
    .from('plan_adjustments')
    .select('*')
    .eq('id', adjustment_id)
    .eq('user_id', user.id)
    .single()

  if (adjError || !adjustment) {
    return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 })
  }

  if (adjustment.status === 'reverted') {
    return NextResponse.json({ error: 'Already reverted' }, { status: 409 })
  }

  // Fetch current plan
  const { data: planRow } = await serviceSupabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', user.id)
    .single()

  const plan = planRow?.plan_json as Plan | null
  if (!plan) return NextResponse.json({ error: 'No plan found' }, { status: 404 })

  // Restore sessions_before into the plan week
  const weekN        = adjustment.week_n
  const sessionsBefore: any[] = adjustment.sessions_before

  const updatedPlan = JSON.parse(JSON.stringify(plan)) as Plan
  const week        = updatedPlan.weeks.find(w => w.n === weekN)
  if (week) {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    days.forEach((day, idx) => {
      if (sessionsBefore[idx]) {
        week.sessions[day] = sessionsBefore[idx]
      }
    })
  }

  // Save updated plan and mark adjustment reverted in parallel
  await Promise.all([
    savePlanForUser(user.id, updatedPlan, supabase),
    serviceSupabase
      .from('plan_adjustments')
      .update({ status: 'reverted', reverted_at: new Date().toISOString() })
      .eq('id', adjustment_id),
  ])

  return NextResponse.json({ plan: updatedPlan })
}
