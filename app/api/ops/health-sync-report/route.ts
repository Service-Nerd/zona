import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

// POST /api/ops/health-sync-report — HEALTH-SYNC-OBS-01.
//
// `syncRecentWorkouts` runs in the browser (Capacitor webview), so it cannot
// call `recordOpsEvent` (service-role, server-only). It posts its sweep result
// here and this bearer-authed route records the event via the service role.
// Same shape as `/api/ops/onboarding-event`, for the same reason.
//
// A sweep that found NOTHING is the whole point: the 17 silent days produced no
// ingest request at all, so only the client can report that it looked. See the
// `health_sync_swept` comment in `lib/ops/recordOpsEvent.ts`.
//
// The user id comes from the verified bearer token, never from the body. The
// EVENT KIND is hardcoded here for the same reason: a client that could name
// its own kind could write anything into the ledger `/api/ops/ai-spend` reads.

interface Body {
  workoutsFound?: number
  posted?: number
  failed?: number
  lookbackFrom?: string
  error?: string
}

/** A client-supplied count is only trusted as a bounded non-negative integer. */
function count(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(Math.floor(v), 10_000) : null
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body = {}
  try { body = (await req.json()) as Body } catch { /* empty body is fine */ }

  await recordOpsEvent(
    'health_sync_swept',
    {
      workouts_found: count(body.workoutsFound),
      posted:         count(body.posted),
      failed:         count(body.failed),
      lookback_from:  typeof body.lookbackFrom === 'string' ? body.lookbackFrom.slice(0, 40) : null,
      error:          typeof body.error === 'string' ? body.error.slice(0, 500) : null,
    },
    user.id,
  )

  return NextResponse.json({ ok: true })
}
