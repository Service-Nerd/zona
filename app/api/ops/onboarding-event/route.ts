import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

// POST /api/ops/onboarding-event — ONBOARD-OBS-01.
//
// The onboarding finalise (has_onboarded flip + HR persist in
// handlePlanSaved) is a LIVE BROWSER write, so it cannot call recordOpsEvent
// (service-role, server-only) and could previously only console.error on
// failure — the exact blind spot that let Problem A run for weeks. The client
// posts here when that settings upsert fails; this bearer-authed route records
// the ops_event via the service role.
//
// The user id is taken from the verified bearer token, never from the body —
// a client cannot attribute a failure to another user.

interface Body {
  message?: string
  had_rhr?: boolean
  had_mhr?: boolean
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body = {}
  try { body = (await req.json()) as Body } catch { /* empty body is fine */ }

  await recordOpsEvent(
    'onboarding_finalise_failed',
    {
      // Truncated so a stray long error string can't bloat the row; no PII —
      // the failing write is a boolean flag + HR numbers, not user content.
      message: typeof body.message === 'string' ? body.message.slice(0, 500) : null,
      had_rhr: body.had_rhr ?? null,
      had_mhr: body.had_mhr ?? null,
    },
    user.id,
  )

  return NextResponse.json({ ok: true })
}
