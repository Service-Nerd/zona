import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { guardAiRequest } from '@/lib/ai/guardAiRequest'
import { callAnthropic } from '@/lib/ai/callAnthropic'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import { strengthGate } from '@/lib/strength-bridge/routeGate'
import { weekNoteKey } from '@/lib/strength-bridge/weekNoteKey'
import { strengthSessionTitle } from '@/lib/strength-bridge/display'
import { buildStrengthWeeklyNotePrompt, parseStrengthNote } from '@/lib/coaching/prompts/strengthWeeklyNote'
import { getUserDisplayPrefs } from '@/lib/userPrefs'
import type { StrengthPlan } from '@/packages/strength'

// OPS-FN-DURATION-01 (2026-11-08) — this route can reach the model, so it states its own
// ceiling instead of inheriting a platform default that has changed twice (60 s Hobby /
// 90 s Pro → 300 s on all plans, conditional on Fluid compute, which cannot be verified
// from the dev machine). 300 is the MAXIMUM on Hobby and the DEFAULT on Pro, so it is valid
// on either, and an in-code value overrides vercel.json, the dashboard and the Fluid
// defaults. It is a ceiling, not a reservation — Vercel bills active CPU.
//
// The literal is deliberate: Next.js route segment config must be statically analysable, so
// it cannot read AI_LIMITS.ROUTE_MAX_DURATION_SECONDS. `aiRouteMaxDuration.test.ts` is the
// link — it fails if this number and that constant ever disagree, and if any route in
// callAnthropic's import closure has no maxDuration at all.
export const maxDuration = 300

// POST /api/strength/weekly-note { week_n } — STRENGTH-NOTE-01. Contract:
// docs/contracts/api/strength-weekly-note.md.
//
// One Haiku note per strength week, cached on `strength_plans.weekly_notes` under a key that
// includes the week's shape. 🔒 Auth in the route, the strength release gate, then the
// shared AI guard (body + rate limit). ⚠️ SILENT ON FAILURE (ADR-006): a failed or refused
// model call returns `{ note: null }` with 200, and the screen renders nothing.

const NOTE_TEXT: Record<string, string> = {
  legs_limited_by_run_week: 'heavy legs are limited by the run week, so some sessions are upper body',
  bodyweight_ceiling: 'bodyweight only, no weights',
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  const g = await strengthGate(user)
  if (!g.ok) return g.res
  const { supabase } = g
  const guard = await guardAiRequest(req, g.user.id, 'strength-weekly-note')
  if (!guard.ok) return guard.response
  const weekN = Number((guard.body as { week_n?: unknown }).week_n)
  if (!Number.isInteger(weekN) || weekN < -52 || weekN > 200) return NextResponse.json({ error: 'week_n (integer) required' }, { status: 422 })

  const { data, error } = await supabase.from('strength_plans').select('plan_json, weekly_notes').eq('user_id', g.user.id).maybeSingle()
  if (error) return NextResponse.json({ note: null })
  const plan = (data?.plan_json as StrengthPlan | null) ?? null
  const week = plan?.weeks.find(w => w.n === weekN)
  if (!plan || !week || week.sessions.length === 0) return NextResponse.json({ note: null })

  const key = weekNoteKey(week)
  const notes = (data?.weekly_notes as Record<string, string> | null) ?? {}
  if (notes[key]) return NextResponse.json({ note: notes[key], cached: true })

  const [{ data: settings }, { units }] = await Promise.all([
    supabase.from('user_settings').select('first_name').eq('id', g.user.id).maybeSingle(),
    getUserDisplayPrefs(supabase, g.user.id),
  ])
  const prompt = buildStrengthWeeklyNotePrompt({
    units, firstName: settings?.first_name ?? null, weekN, phase: week.phase,
    focus: plan.profile.focus, experience: plan.profile.experience,
    sessions: week.sessions.map(s => ({
      day: s.day, title: strengthSessionTitle(s), minutes: s.estimated_minutes,
      afterQualityRun: s.after_quality_run, heavyLegs: s.heavy_legs,
    })),
    notes: plan.notes.map(n => NOTE_TEXT[n]).filter(Boolean),
    weeksToRace: null,
  })

  let note: string | null = null
  try {
    const ai = await callAnthropic({ surface: 'strength-weekly-note', model: ANTHROPIC_MODEL, maxTokens: 120, messages: [{ role: 'user', content: prompt }], userId: g.user.id })
    if (ai.ok) note = parseStrengthNote(ai.text)
  } catch { /* silent (ADR-006); callAnthropic records the failure */ }
  if (!note) return NextResponse.json({ note: null })

  // Keep only the current plan's keys, so the column cannot grow without bound.
  const live = new Set(plan.weeks.map(weekNoteKey))
  const next = Object.fromEntries(Object.entries(notes).filter(([k]) => live.has(k)))
  next[key] = note
  await supabase.from('strength_plans').update({ weekly_notes: next }).eq('user_id', g.user.id)
  return NextResponse.json({ note })
}
