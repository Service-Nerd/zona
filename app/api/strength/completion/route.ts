import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { strengthGate, readSmallJson } from '@/lib/strength-bridge/routeGate'

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
  const b = r.body as { date?: unknown; status?: unknown } | null
  const date = typeof b?.date === 'string' && DATE.test(b.date) && !Number.isNaN(Date.parse(b.date + 'T00:00:00Z')) ? b.date : null
  const status = b?.status === 'done' || b?.status === 'skipped' ? b.status : b?.status === null ? null : undefined
  if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 422 })
  if (status === undefined) return NextResponse.json({ error: 'Invalid status' }, { status: 422 })

  const { data: stored, error: readErr } = await supabase.from('strength_plans').select('plan_json').eq('user_id', user.id).maybeSingle()
  if (readErr) return NextResponse.json({ error: 'Could not load the strength plan' }, { status: 500 })
  const sessions = ((stored?.plan_json as { weeks?: { sessions?: { date?: string | null }[] }[] } | null)?.weeks ?? []).flatMap(w => w.sessions ?? [])
  if (!sessions.some(s => s.date === date)) return NextResponse.json({ error: 'No strength session on that date' }, { status: 404 })

  const { error } = status === null
    ? await supabase.from('strength_completions').delete().eq('user_id', user.id).eq('session_date', date)
    : await supabase.from('strength_completions').upsert({ user_id: user.id, session_date: date, status, updated_at: new Date().toISOString() }, { onConflict: 'user_id,session_date' })
  if (error) {
    await recordOpsEvent('strength_save_failed', { where: 'completion', message: error.message.split('\n')[0].slice(0, 200) }, user.id)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ date, status })
}
