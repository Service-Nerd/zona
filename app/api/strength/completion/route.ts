import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { strengthGate, readSmallJson, strengthServiceClient } from '@/lib/strength-bridge/routeGate'
import { isMissingColumn } from '@/lib/supabase/missingColumn'

// POST /api/strength/completion — STRENGTH-ENGINE-01 Phase 2. Contract: docs/contracts/api/strength-completion.md.
//
//   { date: 'YYYY-MM-DD', status: 'done' | 'skipped' | null }   null = undo
//
// Done or skipped only (Design Board STRENGTH-APP-01). 🔒 Same gate as the plan
// route; the date must be a real calendar date that the runner's stored strength
// plan actually holds a session on, so this cannot write arbitrary rows.

const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const g = await strengthGate(await getUserFromRequest(req))
  if (!g.ok) return g.res
  const { user, supabase } = g
  const r = await readSmallJson(req, 512)
  if (!r.ok) return r.res
  const b = r.body as { date?: unknown; status?: unknown; started_at?: unknown; ended_at?: unknown } | null
  const date = typeof b?.date === 'string' && DATE.test(b.date) && !Number.isNaN(Date.parse(b.date + 'T00:00:00Z')) ? b.date : null
  const status = b?.status === 'done' || b?.status === 'skipped' ? b.status : b?.status === null ? null : undefined
  if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 422 })
  if (status === undefined) return NextResponse.json({ error: 'Invalid status' }, { status: 422 })
  // STRENGTH-GUIDED-SESSION-01 — a guided session sends both times with 'done'. Times that cannot be a session (one
  // without the other, end before start, over four hours, on a skip) are DROPPED, never a reason to lose the 'done':
  // the runner cannot see a clock detail, and a refusal would strand them on the end page (code review 2026-10-29).
  const parsed = sessionTimes(b?.started_at, b?.ended_at)
  const times = parsed && parsed !== 'invalid' && status === 'done' ? parsed : null

  const { data: stored, error: readErr } = await supabase.from('strength_plans').select('plan_json').eq('user_id', user.id).maybeSingle()
  if (readErr) return NextResponse.json({ error: 'Could not load the strength plan' }, { status: 500 })
  const sessions = ((stored?.plan_json as { weeks?: { sessions?: { date?: string | null }[] }[] } | null)?.weeks ?? []).flatMap(w => w.sessions ?? [])
  if (!sessions.some(s => s.date === date)) return NextResponse.json({ error: 'No strength session on that date' }, { status: 404 })

  const { error } = status === null
    ? await supabase.from('strength_completions').delete().eq('user_id', user.id).eq('session_date', date)
    : await upsertCompletion(supabase, user.id, { user_id: user.id, session_date: date, status, updated_at: new Date().toISOString(), ...(times ?? {}) })
  if (error) {
    await recordOpsEvent('strength_save_failed', { where: 'completion', message: error.message.split('\n')[0].slice(0, 200) }, user.id)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ date, status, ...(times ?? {}) })
}

/** At most this long: a session left running overnight is not a session time. */
const MAX_SESSION_MS = 4 * 60 * 60 * 1000

function sessionTimes(start: unknown, end: unknown): { started_at: string; ended_at: string } | null | 'invalid' {
  if (start == null && end == null) return null
  if (typeof start !== 'string' || typeof end !== 'string') return 'invalid'
  const s = Date.parse(start), e = Date.parse(end)
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s || e - s > MAX_SESSION_MS) return 'invalid'
  return { started_at: new Date(s).toISOString(), ended_at: new Date(e).toISOString() }
}

/** Write the row; before 20261029_strength_session_times_and_reps is applied, keep the completion without its times. */
async function upsertCompletion(supabase: ReturnType<typeof strengthServiceClient>, userId: string, row: Record<string, unknown>) {
  const first = await supabase.from('strength_completions').upsert(row, { onConflict: 'user_id,session_date' })
  if (!first.error || !isMissingColumn(first.error)) return first
  await recordOpsEvent('strength_save_failed', { where: 'completion_times_column', message: String(first.error.message).split('\n')[0].slice(0, 200) }, userId)
  const { started_at: _s, ended_at: _e, ...old } = row
  return supabase.from('strength_completions').upsert(old, { onConflict: 'user_id,session_date' })
}
