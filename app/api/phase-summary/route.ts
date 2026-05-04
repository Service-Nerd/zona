import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { buildPhaseSummaryPrompt } from '@/lib/coaching/prompts/phaseSummary'
import { ANTHROPIC_MODEL } from '@/lib/ai/models'
import type { Plan } from '@/types/plan'

// POST /api/phase-summary
// Generates and caches a one-off AI coaching summary for the phase that just ended.
// Called by CoachScreen on first load when it detects a phase transition.
// Idempotent: subsequent calls for the same (user_id, phase_ended, transition_week_n)
// return the cached row rather than re-generating.
//
// Auth: bearer token. PAID/TRIAL — activity_intelligence gate.
// Body: { phase_ended: string, transition_week_n: number }

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (!isFeatureAllowed('activity_intelligence', tier)) {
    return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const { phase_ended, transition_week_n } = body as {
    phase_ended:         string
    transition_week_n:   number
  }

  if (!phase_ended || transition_week_n == null) {
    return NextResponse.json(
      { error: 'phase_ended and transition_week_n required' },
      { status: 422 },
    )
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Idempotency check — return cached row if already generated.
  const { data: existing } = await serviceSupabase
    .from('phase_summaries')
    .select('content, generated_at')
    .eq('user_id', user.id)
    .eq('phase_ended', phase_ended)
    .eq('transition_week_n', transition_week_n)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ content: existing.content, cached: true })
  }

  // ── Fetch plan + run_analysis for the completed phase ──────────────────
  const [planRes, settingsRes, analysisRes, completionsRes] = await Promise.all([
    serviceSupabase.from('plans').select('plan_json').eq('user_id', user.id).single(),
    serviceSupabase.from('user_settings').select('first_name').eq('id', user.id).single(),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, hr_in_zone_pct, ef_trend_pct, actual_load_km, source')
      .eq('user_id', user.id)
      .neq('source', 'manual'),
    serviceSupabase
      .from('session_completions')
      .select('week_n, status, session_type')
      .eq('user_id', user.id),
  ])

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const firstName = settingsRes.data?.first_name ?? null

  // Identify which weeks belong to the completed phase.
  // transition_week_n is the first week of the NEW phase, so completed phase
  // is all weeks before it with phase === phase_ended.
  const phaseWeeks = plan.weeks.filter(
    (w: any) => (w as any).phase === phase_ended && w.n < transition_week_n,
  )
  const phaseWeekNums = new Set(phaseWeeks.map((w: any) => w.n))

  // Determine next phase name from the plan.
  const nextPhaseName = (plan.weeks.find((w: any) => w.n === transition_week_n) as any)?.phase ?? 'build'

  // Zone discipline: avg hr_in_zone_pct for easy+long sessions in the phase.
  const phaseAnalyses = (analysisRes.data ?? []).filter((a: any) => phaseWeekNums.has(a.week_n))
  const zonePcts = phaseAnalyses.map((a: any) => a.hr_in_zone_pct).filter((v: any) => v !== null) as number[]
  const avgZoneDisciplinePct = zonePcts.length > 0
    ? zonePcts.reduce((s, v) => s + v, 0) / zonePcts.length
    : null

  // EF trend: compare first analysis in phase vs last.
  const efValues = phaseAnalyses
    .map((a: any) => a.ef_trend_pct)
    .filter((v: any) => v !== null) as number[]
  const efTrendPct = efValues.length >= 2
    ? efValues[efValues.length - 1] - efValues[0]
    : efValues.length === 1 ? efValues[0] : null

  // Total km logged in phase.
  const totalLoadKm = phaseAnalyses.reduce((s: number, a: any) => s + (a.actual_load_km ?? 0), 0) || null

  // Completion rate: phase weeks only.
  const phaseCompletions = (completionsRes.data ?? []).filter((c: any) => phaseWeekNums.has(c.week_n))
  const completed  = phaseCompletions.filter((c: any) => c.status === 'complete').length
  const totalSessions = phaseWeeks.reduce((sum: number, w: any) => {
    const sessions = Object.values((w as any).sessions ?? {}) as any[]
    return sum + sessions.filter((s: any) => s?.type && s.type !== 'rest').length
  }, 0)
  const completionRate = totalSessions > 0 ? completed / totalSessions : null

  // ── Build prompt + call AI ──────────────────────────────────────────────
  const prompt = buildPhaseSummaryPrompt({
    phaseEnded:            phase_ended,
    phaseNewName:          nextPhaseName,
    totalWeeksInPhase:     phaseWeeks.length,
    avgZoneDisciplinePct,
    efTrendPct,
    completionRate,
    totalLoadKm,
    firstName,
  })

  let content: string | null = null
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL,
        max_tokens: 150,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      content = aiData.content?.[0]?.text?.trim() ?? null
    }
  } catch {
    // silent — no row written, client will not retry until next Coach screen open
  }

  if (!content) {
    return NextResponse.json({ error: 'AI generation failed' }, { status: 503 })
  }

  // ── Store ───────────────────────────────────────────────────────────────
  const { error: insertErr } = await serviceSupabase
    .from('phase_summaries')
    .insert({
      user_id:           user.id,
      phase_ended,
      transition_week_n,
      content,
      ai_model:          ANTHROPIC_MODEL,
    })

  if (insertErr) {
    console.error('[phase-summary] insert failed', insertErr.message)
    // Still return content — client can display even if persist failed.
  }

  return NextResponse.json({ content, cached: false })
}
