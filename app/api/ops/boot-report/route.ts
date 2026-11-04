import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { checkRateLimit } from '@/lib/ai/rateLimit'
import {
  BOOT_STALL_GATES, BOOT_ERR_KINDS, BOOT_STAGES, BOOT_ELAPSED_MAX_MS, BOOT_REPORT_LIMIT, BOOT_REPORT_WINDOW_SECONDS,
  type BootStallGate, type BootErrKind, type BootStage,
} from '@/lib/ui/bootWatchdog'

// POST /api/ops/boot-report — BOOT-HANG-01 (2026-10-25), extended by BOOT-STALL-DIAGNOSE-01 (2026-11-04).
//
// The dashboard posts here when its loading screen has held for BOOT_STALL_MS, or the boot threw.
//
// ⚠️ AUTH IS OPTIONAL, ON PURPOSE. One of the stalls this records IS auth not resolving, so a route that required a
// verified bearer would be blind to the failure it exists for. A valid bearer attributes the row; without one the row
// is anonymous. The body is enum-only (no free text), and the route is rate-limited per IP, so an unauthenticated
// caller can write nothing but a bounded number of `boot_stalled` rows.
//
// ⚠️ AND THAT IS WHY `gate: 'error'` CARRIES AN ENUM, NOT A MESSAGE. The 16 production error rows said nothing about
// their cause and the obvious fix is to post `err.message` — but an anonymous caller writing arbitrary strings into
// `ops_events` to satisfy a diagnostic is a worse trade than a coarser bucket. `err_kind` is classified client-side
// by `bootErrKind`; anything not in BOOT_ERR_KINDS is dropped, not stored.

interface Body { gate?: unknown; elapsed_ms?: unknown; native?: unknown; hidden?: unknown; err_kind?: unknown; stage?: unknown }

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

  // Clamped, not merely rounded: the client is untrusted, and one absurd value distorts every average read off
  // this field — which is the whole reason the field is being fixed.
  const raw = body.elapsed_ms
  const elapsed = typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? Math.min(Math.round(raw), BOOT_ELAPSED_MAX_MS)
    : null

  const errKind = BOOT_ERR_KINDS.includes(body.err_kind as BootErrKind) ? (body.err_kind as BootErrKind) : null
  const stage = BOOT_STAGES.includes(body.stage as BootStage) ? (body.stage as BootStage) : null

  // BOOT-STALL-HIDDEN-ABSENT-01 (2026-11-04) — NULL, NOT FALSE, FOR A FIELD THE CLIENT DID NOT SEND.
  //
  // Both of these read `body.x === true`, which answers "did the client say true?" and then writes the answer
  // as though it were "the client said false". Absence and a measured `false` became the same row. Measured the
  // same day this shipped: the first post-deploy row with `hidden: false` ALSO carried no `stage`, which is
  // exactly the shape a client still running the pre-fix bundle produces — so the one row that mattered was
  // indistinguishable from a stale cache, and `hidden` is the field this telemetry was fixed to gain.
  //
  // This is the same defect class as the `elapsed_ms` constant it sits beside: a value standing in for a
  // measurement that was never taken. The convention is already here, one line up — nonsense becomes `null`,
  // never `0`. ⚠️ `null` rather than dropping the key, because a dropped key is what the OLD route wrote, so
  // omitting it would move the ambiguity one layer out instead of removing it. Three states, all readable:
  // key absent = the pre-2026-11-04 route · `null` = this route, client sent nothing · `true`/`false` = a fact.
  //
  // `err_kind` and `stage` keep their drop-when-invalid convention deliberately: absence there means NOT
  // APPLICABLE (no error, no stage set), where absence here means the reporter did not answer a question it is
  // always asked. Different meanings, so different shapes.
  const boolOrNull = (v: unknown) => typeof v === 'boolean' ? v : null

  await recordOpsEvent('boot_stalled', {
    gate,
    elapsed_ms: elapsed,
    native: boolOrNull(body.native),
    hidden: boolOrNull(body.hidden),
    ...(errKind ? { err_kind: errKind } : {}),
    ...(stage ? { stage } : {}),
  }, user?.id ?? null)
  return NextResponse.json({ ok: true })
}
