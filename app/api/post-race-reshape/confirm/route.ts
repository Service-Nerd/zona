// POST /api/post-race-reshape/confirm
// Auth-gated (paid/trial). Applies the proposed reshaped plan from a pending
// post_race_reshapes row to the user's active plan.
//
// Body: { reshape_id: string }
// Returns: { ok: true, weeks_affected, sessions_modified }

import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { savePlanForUser } from '@/lib/plan'
import type { Plan } from '@/types/plan'

export async function POST(req: NextRequest) {
  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('dynamic_reshape_r20', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body      = await req.json().catch(() => ({}))
  const reshapeId = body?.reshape_id

  if (!reshapeId || typeof reshapeId !== 'string') {
    return NextResponse.json({ error: 'reshape_id required' }, { status: 400 })
  }

  // Fetch the pending row (must belong to this user)
  const { data: row, error: fetchError } = await serviceClient
    .from('post_race_reshapes')
    .select('id, user_id, reshaped_plan_json, weeks_affected, sessions_modified, status, recovery_config_key')
    .eq('id', reshapeId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Reshape not found' }, { status: 404 })
  }

  if (row.status !== 'pending') {
    return NextResponse.json({ error: `Cannot confirm — status is '${row.status}'` }, { status: 409 })
  }

  // Apply the reshaped plan via the SERVICE client — this route authenticates off
  // the Bearer token, so the cookie session isn't available server-side on native;
  // a cookie-bound write hits RLS with no session and silently no-ops (the reshape
  // would look applied but the plan never changes).
  await savePlanForUser(user.id, row.reshaped_plan_json as Plan, serviceClient)

  // Mark as confirmed
  await serviceClient
    .from('post_race_reshapes')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', reshapeId)

  return NextResponse.json({
    ok:                  true,
    weeks_affected:      row.weeks_affected,
    sessions_modified:   row.sessions_modified,
    reshaped_plan_json:  row.reshaped_plan_json,
  })
}
