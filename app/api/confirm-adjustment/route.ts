import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { applyAdjustmentDays } from '@/lib/coaching/applyAdjustmentDays'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { readPlanJson } from '@/lib/plan'
import { applyAnsweredProposal } from '@/lib/supabase/applyAnsweredProposal'
import { findWeekByN } from '@/lib/plan/weekResolution'
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
  const week        = findWeekByN(updatedPlan.weeks, weekN)
  // 🔴 ADJUST-WEEK-COORD-01 — NO MATCHING WEEK IS A REFUSAL, NOT A CONFIRMATION. This was
  // `if (week) { … }` with nothing on the else, so a row whose week the plan no longer carries
  // was saved unchanged and then marked `confirmed`: a change recorded as applied that was
  // never applied anywhere. The row stays `pending`; every client keeps the card on a non-200.
  if (!week) {
    await recordOpsEvent('adjustment_week_not_found', { route: 'confirm-adjustment', week_n: weekN }, user.id)
    return NextResponse.json({ error: 'This change can no longer be applied', reason: 'week_not_found' }, { status: 409 })
  }
  // READINESS-WRONG-DAY-01 — only the days that changed, and never a malformed row.
  const applied = applyAdjustmentDays(week, adjustment.sessions_before, sessionsAfter)
  if (!applied.ok) return NextResponse.json({ error: 'This change can no longer be applied' }, { status: 409 })

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
  //
  // CONFIRM-REVERT-WRITE-ERRORS-01 (2026-11-25) — the order was right and the two writes AFTER
  // the save were unread, so a lost status write left the plan changed and the row `pending`
  // with no trace. `applyAnsweredProposal` is the single owner of the save + transition for all
  // four routes that answer a proposal; it reads both results, makes the transition conditional
  // on the status read above, and records what it could not do.
  const written = await applyAnsweredProposal(serviceSupabase, {
    userId:  user.id,
    route:   'confirm-adjustment',
    plan:    updatedPlan,
    proposal: { table: 'plan_adjustments', id: adjustment_id, fromStatus: adjustment.status, answer: 'confirmed' },
    clearAdjustmentFlag: true,
    detail:  { week_n: weekN },
  })
  if (!written.ok) return NextResponse.json({ error: 'Could not save the plan' }, { status: 500 })

  // ⚠️ A 200 even when the transition did not land. The plan IS saved by this point, so telling
  // the client it failed would make it show PLAN_CHANGE_SAVE_FAILED for a change that applied.
  // The divergence is in `proposal_transition_incomplete`, not in the runner's face.
  return NextResponse.json({ plan: updatedPlan })
}
