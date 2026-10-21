import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { strengthGate, readSmallJson } from '@/lib/strength-bridge/routeGate'
import { CATALOGUE_BY_ID } from '@/packages/strength'

// POST /api/strength/opened — STRENGTH-ROW-OPEN-01. Contract: docs/contracts/api/strength-opened.md.
//
//   { exercise_id: string }
//
// A runner opened an exercise row on the strength session screen. The SLT's demand measure for demo media
// (STRENGTH-MEDIA-01, 2026-10-21): if nobody opens rows for the cues, nobody will open them for an animation.
// Records one `strength_exercise_opened` ops event; the payload is a catalogue id, never anything the runner typed.

export async function POST(req: NextRequest) {
  const g = await strengthGate(await getUserFromRequest(req))
  if (!g.ok) return g.res
  const r = await readSmallJson(req, 256)
  if (!r.ok) return r.res
  const id = (r.body as { exercise_id?: unknown } | null)?.exercise_id
  if (typeof id !== 'string' || !CATALOGUE_BY_ID.has(id)) return NextResponse.json({ error: 'Unknown exercise' }, { status: 422 })
  await recordOpsEvent('strength_exercise_opened', { exercise_id: id }, g.user.id)
  return NextResponse.json({ ok: true })
}
