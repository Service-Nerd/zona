import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { savePlanForUser } from '@/lib/plan'
import type { Plan } from '@/types/plan'

// POST /api/confirm-adjustment
// Auth-gated (paid/trial). Confirms a pending plan adjustment — applies sessions_after
// to the plan and marks the row as confirmed.

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (tier === 'free') return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const { adjustment_id } = await req.json()
  if (!adjustment_id) return NextResponse.json({ error: 'adjustment_id required' }, { status: 422 })

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: adjustment, error: adjError } = await serviceSupabase
    .from('plan_adjustments')
    .select('*')
    .eq('id', adjustment_id)
    .eq('user_id', user.id)
    .single()

  if (adjError || !adjustment) {
    return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 })
  }

  if (adjustment.status !== 'pending') {
    return NextResponse.json({ error: 'Adjustment is not pending' }, { status: 409 })
  }

  const { data: planRow } = await serviceSupabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', user.id)
    .single()

  const plan = planRow?.plan_json as Plan | null
  if (!plan) return NextResponse.json({ error: 'No plan found' }, { status: 404 })

  const weekN           = adjustment.week_n
  const sessionsAfter: any[] = adjustment.sessions_after

  const updatedPlan = JSON.parse(JSON.stringify(plan)) as Plan
  const week        = updatedPlan.weeks.find(w => w.n === weekN)
  if (week) {
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
    days.forEach((day, idx) => {
      if (sessionsAfter[idx]) week.sessions[day] = sessionsAfter[idx]
    })
  }

  await Promise.all([
    savePlanForUser(user.id, updatedPlan, supabase),
    serviceSupabase
      .from('plan_adjustments')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', adjustment_id),
  ])

  return NextResponse.json({ plan: updatedPlan })
}
