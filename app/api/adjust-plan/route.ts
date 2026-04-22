import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { checkAdjustmentTriggers } from '@/lib/coaching/planAdjustment'
import { COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import { buildAdjustmentExplanationPrompt } from '@/lib/coaching/prompts/planAdjustment'
import { getCurrentWeekIndex } from '@/lib/plan'
import { savePlanForUser } from '@/lib/plan'
import type { Plan } from '@/types/plan'

// POST /api/adjust-plan
// Auth-gated (paid/trial). Checks adjustment triggers for the current week.
// If a trigger fires: saves to plan_adjustments (status: pending).
// Auto-applies low-risk adjustments; requires confirmation for significant ones.

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tier = await getUserTier(user.id)
  if (tier === 'free') return NextResponse.json({ error: 'Subscription required' }, { status: 403 })

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [planRes, analysisRes, prevWeeksRes, adjustmentsThisWeekRes] = await Promise.all([
    serviceSupabase.from('plans').select('plan_json').eq('user_id', user.id).single(),
    serviceSupabase
      .from('run_analysis')
      .select('session_day, hr_in_zone_pct, actual_load_km, planned_load_km, ef_trend_pct')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, actual_load_km')
      .eq('user_id', user.id)
      .order('week_n', { ascending: false })
      .limit(40),
    serviceSupabase
      .from('plan_adjustments')
      .select('id')
      .eq('user_id', user.id)
      .in('status', ['pending', 'confirmed', 'auto_applied']),
  ])

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const weekN     = weekIndex + 1
  const week      = plan.weeks[weekIndex]
  const analyses  = analysisRes.data ?? []

  // Get this week's count of adjustments
  const adjustmentsThisWeek = (adjustmentsThisWeekRes.data ?? []).length

  // Build aggregates for trigger check
  const thisWeekAnalyses = analyses.filter((a: any) => a.session_day.startsWith(`week_${weekN}_`))
  const thisWeekKm       = thisWeekAnalyses.reduce((s: number, a: any) => s + (a.actual_load_km ?? 0), 0)
  const plannedKm        = week.weekly_km ?? 0

  const weekLoadMap: Record<number, number> = {}
  ;(prevWeeksRes.data ?? []).forEach((r: any) => {
    if (!weekLoadMap[r.week_n]) weekLoadMap[r.week_n] = 0
    weekLoadMap[r.week_n] += r.actual_load_km ?? 0
  })
  const priorWeeksKm = Object.entries(weekLoadMap)
    .filter(([n]) => Number(n) < weekN)
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, 4)
    .map(([, km]) => km)

  const hrInZoneData = thisWeekAnalyses.map((a: any) => {
    const dayKey = a.session_day.replace(`week_${weekN}_`, '') as keyof typeof week.sessions
    return {
      sessionType: week.sessions[dayKey]?.type ?? 'easy',
      hrInZonePct: a.hr_in_zone_pct ?? null,
    }
  })

  const efTrendValues = thisWeekAnalyses.map((a: any) => a.ef_trend_pct).filter((v: any) => v !== null)
  const efTrendPct    = efTrendValues.length
    ? efTrendValues.reduce((s: number, v: number) => s + v, 0) / efTrendValues.length
    : null

  const currentWeekSessions = Object.values(week.sessions).filter(Boolean) as any[]

  const proposed = checkAdjustmentTriggers({
    currentWeekN:         weekN,
    totalWeeks:           plan.weeks.length,
    currentWeekSessions,
    actualKm:             thisWeekKm,
    plannedKm,
    priorWeeksKm,
    hrInZoneData,
    efTrendPct,
    adjustmentsThisWeek,
  })

  if (!proposed) {
    return NextResponse.json({ adjustment: null, message: 'No adjustment needed' })
  }

  // AI explanation — silent fallback to rule-based summary
  let explanationText: string = proposed.summary
  try {
    const prompt  = buildAdjustmentExplanationPrompt(proposed)
    const aiRes   = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 150,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })
    if (aiRes.ok) {
      const aiData = await aiRes.json()
      const text   = aiData.content?.[0]?.text?.trim()
      if (text) explanationText = text
    }
  } catch {
    // silent fallback to rule-based summary
  }

  // Auto-apply low-risk adjustments (no confirmation required)
  const status = proposed.requiresConfirmation ? 'pending' : 'auto_applied'

  const adjustmentRow = {
    user_id:         user.id,
    week_n:          weekN,
    trigger_type:    proposed.trigger.type,
    trigger_detail:  proposed.trigger.detail,
    adjustment_type: proposed.adjustmentType,
    summary:         explanationText,
    sessions_before: proposed.sessionsBefore,
    sessions_after:  proposed.sessionsAfter,
    status,
    rule_engine_version: COACHING_RULE_ENGINE_VERSION,
    confirmed_at:    status === 'auto_applied' ? new Date().toISOString() : null,
  }

  const { data: inserted, error: insertError } = await serviceSupabase
    .from('plan_adjustments')
    .insert(adjustmentRow)
    .select()
    .single()

  if (insertError) {
    console.error('[adjust-plan] insert failed', insertError.message)
    return NextResponse.json({ error: 'Failed to save adjustment' }, { status: 500 })
  }

  // For auto-applied adjustments, update the plan immediately
  if (status === 'auto_applied') {
    const updatedPlan = applyAdjustmentToPlan(plan, weekN, proposed.sessionsAfter)
    await savePlanForUser(user.id, updatedPlan, supabase)
  }

  return NextResponse.json({ adjustment: inserted, requires_confirmation: proposed.requiresConfirmation })
}

function applyAdjustmentToPlan(plan: Plan, weekN: number, sessionsAfter: any[]): Plan {
  const updated = JSON.parse(JSON.stringify(plan)) as Plan
  const week    = updated.weeks.find(w => w.n === weekN)
  if (!week) return updated

  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  days.forEach((day, idx) => {
    if (sessionsAfter[idx]) {
      week.sessions[day] = sessionsAfter[idx]
    }
  })
  return updated
}
