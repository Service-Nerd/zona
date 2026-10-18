import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { strengthGate, readSmallJson } from '@/lib/strength-bridge/routeGate'
import { parseRecoveryEases } from '@/lib/strength-bridge/recoveryEases'
import { isLoadedLift, isNoStepSession, type StrengthPlan } from '@/packages/strength'

// POST /api/strength/log — STRENGTH-PROGRESSION-01 (S14). Contract: docs/contracts/api/strength-log.md.
//
//   { date: 'YYYY-MM-DD', exercise_id: string, load_kg: number | null, feel: 'easy' | 'right' | 'hard' }
//
// One row per lift per session (Blagrove). 🔒 Same gate as the plan route. The lift must be a MAIN lift of the
// session the runner's own stored plan holds on that date; a loaded lift needs a weight, a bodyweight lift takes none.
// `counts` is decided HERE, from the plan, never from the request: a deload, taper, race-week or eased session's log
// never moves a suggestion (Hutchinson).

const DATE = /^\d{4}-\d{2}-\d{2}$/
const FEELS = new Set(['easy', 'right', 'hard'])

export async function POST(req: NextRequest) {
  const g = await strengthGate(await getUserFromRequest(req))
  if (!g.ok) return g.res
  const { user, supabase } = g
  const r = await readSmallJson(req, 512)
  if (!r.ok) return r.res
  const b = r.body as { date?: unknown; exercise_id?: unknown; load_kg?: unknown; feel?: unknown } | null
  const date = typeof b?.date === 'string' && DATE.test(b.date) && !Number.isNaN(Date.parse(b.date + 'T00:00:00Z')) ? b.date : null
  const exerciseId = typeof b?.exercise_id === 'string' && b.exercise_id.length <= 64 ? b.exercise_id : null
  const feel = typeof b?.feel === 'string' && FEELS.has(b.feel) ? b.feel : null
  if (!date || !exerciseId || !feel) return NextResponse.json({ error: 'Invalid log' }, { status: 422 })

  const loaded = isLoadedLift(exerciseId)
  const load = b?.load_kg
  const loadKg = typeof load === 'number' && Number.isFinite(load) && load > 0 && load <= 500 ? Math.round(load * 100) / 100 : null
  if (loaded && loadKg == null) return NextResponse.json({ error: 'A weight is needed for this lift' }, { status: 422 })
  if (!loaded && load != null) return NextResponse.json({ error: 'This lift takes no weight' }, { status: 422 })

  const { data: stored, error: readErr } = await supabase
    .from('strength_plans').select('plan_json, recovery_eases').eq('user_id', user.id).maybeSingle()
  if (readErr) return NextResponse.json({ error: 'Could not load the strength plan' }, { status: 500 })
  const plan = stored?.plan_json as StrengthPlan | null
  const week = plan?.weeks.find(w => w.sessions.some(s => s.date === date))
  const session = week?.sessions.find(s => s.date === date)
  const isMain = !!session?.blocks.some(bl => bl.role === 'main' && bl.items.some(i => i.exercise_id === exerciseId))
  if (!week || !isMain) return NextResponse.json({ error: 'That lift is not in this session' }, { status: 404 })

  const counts = !isNoStepSession(week.phase, parseRecoveryEases(stored?.recovery_eases)[date] === 'eased')
  const { error } = await supabase.from('strength_lift_logs').upsert({
    user_id: user.id, session_date: date, exercise_id: exerciseId, load_kg: loaded ? loadKg : null, feel, counts,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,session_date,exercise_id' })
  if (error) {
    await recordOpsEvent('strength_save_failed', { where: 'lift_log', message: error.message.split('\n')[0].slice(0, 200) }, user.id)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ date, exercise_id: exerciseId, load_kg: loaded ? loadKg : null, feel, counts })
}
