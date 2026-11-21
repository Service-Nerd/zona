import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { applyAdjustmentDays } from '@/lib/coaching/applyAdjustmentDays'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { savePlanForUser, readPlanJson } from '@/lib/plan'
import { findWeekByN } from '@/lib/plan/weekResolution'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import type { Plan } from '@/types/plan'

// POST /api/revert-adjustment
// Auth-gated (paid/trial). Reverts a plan adjustment using the sessions_before snapshot.

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

  // Fetch the adjustment
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

  if (adjustment.status === 'reverted') {
    return NextResponse.json({ error: 'Already reverted' }, { status: 409 })
  }

  // Fetch current plan
  const { plan: planRowPlan, error: planRowError } = await readPlanJson(serviceSupabase, user.id)
  // PLANS-SINGLE-NOT-MAYBE-01 — a failed READ is not "no plan": answering that would be false.
  if (planRowError) return NextResponse.json({ error: 'Could not load your plan' }, { status: 500 })

  const plan = planRowPlan as Plan | null
  if (!plan) return NextResponse.json({ error: 'No plan found' }, { status: 404 })

  // Restore sessions_before into the plan week
  const weekN        = adjustment.week_n
  const sessionsBefore: any[] = adjustment.sessions_before

  const updatedPlan = JSON.parse(JSON.stringify(plan)) as Plan
  const week        = findWeekByN(updatedPlan.weeks, weekN)
  // 🔴 ADJUST-WEEK-COORD-01 — NO MATCHING WEEK: RESOLVE THE ROW, NEVER SAVE THE PLAN.
  // With nothing on the else this used to SAVE the unchanged plan (an archive row and a write for
  // nothing) and mark the row `reverted`. Marking it is right and is kept: "reverted" claims the
  // change is not in the plan, and with no week carrying it, it is not. It is the asymmetric twin
  // of confirm, which REFUSES here because "confirmed" would claim the change IS in the plan.
  // ⚠️ Refusing both would strand a pending row for good: confirm 409, revert 409, and
  // adjust-plan re-serves the pending row before it runs the engine, so the runner could never
  // clear the card and no new adjustment could be made (code review, 2026-11-21).
  if (!week) {
    const nowIso = new Date().toISOString()
    // Code review round 2: flag FIRST, row LAST. Only the row decides whether a retry can succeed:
    // a failed row write leaves it pending, so 500 is honest and the retry works; a failed flag
    // write is recorded and the resolution stands, because a retry would meet "Already reverted".
    const flagRes = await serviceSupabase.from('user_settings')
      .update({ last_adjustment_check_at: nowIso, last_adjustment_check_found_change: false })
      .eq('id', user.id)
    const rowRes = await serviceSupabase.from('plan_adjustments').update({ status: 'reverted', reverted_at: nowIso }).eq('id', adjustment_id)
    await recordOpsEvent('adjustment_week_not_found', {
      route: 'revert-adjustment', week_n: weekN, row_error: rowRes?.error?.message ?? null, flag_error: flagRes?.error?.message ?? null,
    }, user.id)
    if (rowRes?.error) return NextResponse.json({ error: 'Could not resolve this change' }, { status: 500 })
    return NextResponse.json({ plan, reason: 'week_not_found' })
  }
  // READINESS-WRONG-DAY-01 — only the days that changed, and never a malformed row.
  const applied = applyAdjustmentDays(week, adjustment.sessions_after, sessionsBefore)
  if (!applied.ok) return NextResponse.json({ error: 'This change can no longer be applied' }, { status: 409 })

  // Resetting last_adjustment_check_found_change here too (see same comment
  // in confirm-adjustment): reverting is the resolution of a pending change,
  // so the Me-screen flag should reflect "nothing pending" after this runs.
  // ADJUST-STATUS-WITHOUT-SAVE-01 (2026-10-16) — SAVE FIRST, THEN MARK IT DONE.
  // These three writes used to run together in one `Promise.all`, so when the save
  // rejected the row had ALREADY flipped to `reverted` and the Me flag to "nothing
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
      { route: 'revert-adjustment', week_n: weekN, message: err instanceof Error ? err.message : String(err) },
      user.id,
    )
    return NextResponse.json({ error: 'Could not save the plan' }, { status: 500 })
  }
  await Promise.all([
    serviceSupabase
      .from('plan_adjustments')
      .update({ status: 'reverted', reverted_at: nowIso })
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
