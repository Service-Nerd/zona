import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { strengthGate, readSmallJson } from '@/lib/strength-bridge/routeGate'
import { parseRecoveryEases, strengthEaseEligible } from '@/lib/strength-bridge/recoveryEases'
import type { StrengthPlan } from '@/packages/strength'

// POST /api/strength/ease — STRENGTH-RECOVERY-01 (S13). Contract: docs/contracts/api/strength-ease.md.
//
//   { date: 'YYYY-MM-DD', answer: 'eased' | 'declined' }
//
// The runner's answer on Today's recovery card for that day's strength session. 🔒 Same gate as the
// plan route; the date must hold an easeable session in the runner's own stored plan. An ease only
// ever subtracts (S-RECOVERY-SUBTRACT-ONLY), so a runner easing a day is never a safety question.

const DATE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: NextRequest) {
  const g = await strengthGate(await getUserFromRequest(req))
  if (!g.ok) return g.res
  const { user, supabase } = g
  const r = await readSmallJson(req, 512)
  if (!r.ok) return r.res
  const b = r.body as { date?: unknown; answer?: unknown } | null
  const date = typeof b?.date === 'string' && DATE.test(b.date) && !Number.isNaN(Date.parse(b.date + 'T00:00:00Z')) ? b.date : null
  const answer = b?.answer === 'eased' || b?.answer === 'declined' ? b.answer : null
  if (!date) return NextResponse.json({ error: 'Invalid date' }, { status: 422 })
  if (!answer) return NextResponse.json({ error: 'Invalid answer' }, { status: 422 })

  const { data: stored, error: readErr } = await supabase
    .from('strength_plans').select('plan_json, recovery_eases').eq('user_id', user.id).maybeSingle()
  if (readErr) return NextResponse.json({ error: 'Could not load the strength plan' }, { status: 500 })
  const session = ((stored?.plan_json as StrengthPlan | null)?.weeks ?? []).flatMap(w => w.sessions).find(s => s.date === date)
  if (!strengthEaseEligible(session)) return NextResponse.json({ error: 'No strength session to ease on that date' }, { status: 404 })

  const eases = { ...parseRecoveryEases(stored?.recovery_eases), [date]: answer }
  const { error } = await supabase.from('strength_plans').update({ recovery_eases: eases }).eq('user_id', user.id)
  if (error) {
    await recordOpsEvent('strength_save_failed', { where: 'ease', message: error.message.split('\n')[0].slice(0, 200) }, user.id)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ date, answer })
}
