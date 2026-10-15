import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'

// POST /api/ops/plan-save-report — PLAN-SAVE-SILENT-FAIL-01 (2026-10-15).
//
// Saving a freshly generated plan runs in the BROWSER (`GeneratePlanScreen` →
// `onPlanSaved` → `savePlanForUser`), so it cannot call `recordOpsEvent`
// (service-role, server-only). When that save throws, the client posts here and this
// bearer-authed route records the event via the service role. Same shape, and same
// reason, as `/api/ops/onboarding-event` and `/api/ops/health-sync-report`.
//
// 🔴 WHY IT EXISTS. `handleUsePlan`'s catch used to reset the "Saving…" button and do
// nothing else. A Make-A-Wish runner built an identical marathon plan twice on
// 2026-10-08 and saved neither, and "never tapped save" could not be told from
// "tapped it and it failed" — both left exactly the same nothing.
//
// The user id comes from the verified bearer token, never from the body, and the
// EVENT KIND is hardcoded: a client that could name its own kind could write anything
// into the ledger `/api/ops/ai-spend` reads.

interface Body {
  message?: string
  errorName?: string
  raceDistanceKm?: number
  enrichmentPending?: boolean
  attempt?: number
}

/** A client-supplied number is trusted only as a bounded, finite value. */
function bounded(v: unknown, max: number): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : null
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Body = {}
  try { body = (await req.json()) as Body } catch { /* an empty body still records the failure */ }

  await recordOpsEvent(
    'plan_save_failed_client',
    {
      // Truncated so a stray long error string cannot bloat the row. No PII: these
      // are an error message, an error name and two plan facts, never plan content.
      message: typeof body.message === 'string' ? body.message.slice(0, 300) : null,
      error_name: typeof body.errorName === 'string' ? body.errorName.slice(0, 60) : null,
      race_distance_km: bounded(body.raceDistanceKm, 1000),
      enrichment_pending: typeof body.enrichmentPending === 'boolean' ? body.enrichmentPending : null,
      attempt: bounded(body.attempt, 100),
    },
    user.id,
  )
  return NextResponse.json({ ok: true })
}
