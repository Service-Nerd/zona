import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { checkRateLimit } from '@/lib/ai/rateLimit'
import { BOOT_STALL_GATES, type BootStallGate } from '@/lib/ui/bootWatchdog'

// POST /api/ops/boot-report — BOOT-HANG-01 (2026-10-25).
//
// The dashboard posts here when its loading screen has held for BOOT_STALL_MS, or the boot threw.
//
// ⚠️ AUTH IS OPTIONAL, ON PURPOSE. One of the stalls this records IS auth not resolving, so a route that required a
// verified bearer would be blind to the failure it exists for. A valid bearer attributes the row; without one the row
// is anonymous. The body is enum-only (no free text), and the route is rate-limited per IP, so an unauthenticated
// caller can write nothing but a bounded number of `boot_stalled` rows.

export const BOOT_REPORT_LIMIT = 10
export const BOOT_REPORT_WINDOW_SECONDS = 3600

interface Body { gate?: unknown; elapsed_ms?: unknown; native?: unknown }

export async function POST(req: NextRequest) {
  let body: Body = {}
  try { body = (await req.json()) as Body } catch { /* empty body is fine */ }

  const gate = BOOT_STALL_GATES.includes(body.gate as BootStallGate) ? (body.gate as BootStallGate) : null
  if (!gate) return NextResponse.json({ error: 'Unknown gate' }, { status: 400 })

  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (!await checkRateLimit(`ops:boot:${ip}`, BOOT_REPORT_LIMIT, BOOT_REPORT_WINDOW_SECONDS)) {
    return NextResponse.json({ ok: false }, { status: 429 })
  }

  const user = await getUserFromRequest(req).catch(() => null)
  const elapsed = typeof body.elapsed_ms === 'number' && Number.isFinite(body.elapsed_ms) ? Math.round(body.elapsed_ms) : null

  await recordOpsEvent('boot_stalled', { gate, elapsed_ms: elapsed, native: body.native === true }, user?.id ?? null)
  return NextResponse.json({ ok: true })
}
