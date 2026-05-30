// POST /api/post-race-reshape/revert
// Auth-gated (paid/trial). Restores the original plan from a confirmed
// post_race_reshapes row.
//
// Only reverting 'confirmed' reshapes is allowed. A 'pending' reshape can
// simply be dismissed (no separate route needed — it was never applied).
//
// Body: { reshape_id: string }
// Returns: { ok: true }

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

  // Fetch the confirmed row (must belong to this user)
  const { data: row, error: fetchError } = await serviceClient
    .from('post_race_reshapes')
    .select('id, user_id, original_plan_json, status')
    .eq('id', reshapeId)
    .eq('user_id', user.id)
    .single()

  if (fetchError || !row) {
    return NextResponse.json({ error: 'Reshape not found' }, { status: 404 })
  }

  if (row.status !== 'confirmed') {
    return NextResponse.json({ error: `Cannot revert — status is '${row.status}'` }, { status: 409 })
  }

  // Restore the original plan via the SERVICE client — this route authenticates
  // off the Bearer token, so the cookie session isn't available server-side on
  // native; a cookie-bound write hits RLS with no session and silently no-ops.
  await savePlanForUser(user.id, row.original_plan_json as Plan, serviceClient)

  // Mark as reverted
  await serviceClient
    .from('post_race_reshapes')
    .update({ status: 'reverted', reverted_at: new Date().toISOString() })
    .eq('id', reshapeId)

  return NextResponse.json({ ok: true })
}
