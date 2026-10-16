import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { savePlanForUser, readPlanJson } from '@/lib/plan'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import type { Plan } from '@/types/plan'

// POST /api/confirm-adjustment
// Auth-gated (paid/trial). Confirms a pending plan adjustment — applies sessions_after
// to the plan and marks the row as confirmed.

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  // ADJUST-PLAN-SAVE-CLIENT-01 — bearer-authenticated route, so the save must NOT go
  // through the cookie client: on native it has no session and `plans` RLS refused the
  // upsert. It uses the SERVICE client, deliberately. This comment used to say
  // "user-scoped rather than service", which was the fix's abandoned first cut:
  // `savePlanForUser` calls `reanchorCharityGrant`, which UPDATEs `charity_codes`, and a
  // user-scoped client may only SELECT that table, so grants would have stopped
  // re-anchoring silently. adjust-plan carries the full reasoning (corrected
  // 2026-10-16, ADJUST-STATUS-WITHOUT-SAVE-01).
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

  const { data: adjustment, error: adjError } = await serviceSupabase
    .from('plan_adjustments')
    .select('*')
    .eq('id', adjustment_id)
    .eq('user_id', user.id)
    .is('superseded_at', null)   // PLAN-WEEK-COLLISION-01: live plan only
    .single()

  if (adjError || !adjustment) {
    return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 })
  }

  if (adjustment.status !== 'pending') {
    return NextResponse.json({ error: 'Adjustment is not pending' }, { status: 409 })
  }

  const { plan: planRowPlan, error: planRowError } = await readPlanJson(serviceSupabase, user.id)
  // PLANS-SINGLE-NOT-MAYBE-01 — a failed READ is not "no plan": answering that would be false.
  if (planRowError) return NextResponse.json({ error: 'Could not load your plan' }, { status: 500 })

  const plan = planRowPlan as Plan | null
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

  // Resetting last_adjustment_check_found_change here too: previously this
  // route only flipped the plan_adjustments row, leaving the Me-screen flag
  // stale at "1 change suggested" forever. The next /api/adjust-plan run
  // would eventually correct it, but in the meantime Me lied. Now: confirming
  // a pending adjustment is itself the resolution — flag goes false.
  // ADJUST-STATUS-WITHOUT-SAVE-01 (2026-10-16) — SAVE FIRST, THEN MARK IT DONE.
  // These three writes used to run together in one `Promise.all`, so when the save
  // rejected the row had ALREADY flipped to `confirmed` and the Me flag to "nothing
  // pending": the adjustment claimed to be applied while the plan was unchanged, and
  // the change card vanished on the next load with nothing to retry. Nothing was
  // recorded either; only `adjust-plan` emitted `plan_save_failed`. Now a failed save
  // leaves the row `pending`, which is what the client already assumes (it keeps the
  // card visible on any non-200).
  const nowIso = new Date().toISOString()
  try {
    await savePlanForUser(user.id, updatedPlan, serviceSupabase)
  } catch (err) {
    await recordOpsEvent(
      'plan_save_failed',
      { route: 'confirm-adjustment', week_n: weekN, message: err instanceof Error ? err.message : String(err) },
      user.id,
    )
    return NextResponse.json({ error: 'Could not save the plan' }, { status: 500 })
  }
  await Promise.all([
    serviceSupabase
      .from('plan_adjustments')
      .update({ status: 'confirmed', confirmed_at: nowIso })
      .eq('id', adjustment_id),
    serviceSupabase
      .from('user_settings')
      .update({
        last_adjustment_check_at:           nowIso,
        last_adjustment_check_found_change: false,
      })
      .eq('id', user.id),
  ])

  return NextResponse.json({ plan: updatedPlan })
}
