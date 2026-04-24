import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { computeWeeklyReportData } from '@/lib/coaching/weeklyReport'
import { COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import { buildWeeklyReportPrompt } from '@/lib/coaching/prompts/weeklyReport'
import { getCurrentWeekIndex } from '@/lib/plan'
import type { Plan } from '@/types/plan'

// POST /api/weekly-report
// Auth-gated (paid/trial). Computes this week's coaching report.
// If a report already exists for this week, returns it. Otherwise generates a new one.
// Query param: ?force=true to regenerate.

export async function POST(req: NextRequest) {
  // Internal cron bypass
  const serviceKey     = req.headers.get('x-service-key')
  const headerUserId   = req.headers.get('x-user-id')
  const isInternalCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY && !!headerUserId

  let userId: string

  if (isInternalCall) {
    userId = headerUserId!
  } else {
    const supabase = createClient()
    const user = await getUserFromRequest(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
    const tier = await getUserTier(user.id)
    if (tier === 'free') return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const force = req.nextUrl.searchParams.get('force') === 'true'

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch plan + user settings in parallel
  const [planRes, settingsRes] = await Promise.all([
    serviceSupabase.from('plans').select('plan_json').eq('user_id', userId).single(),
    serviceSupabase.from('user_settings').select('first_name').eq('id', userId).single(),
  ])

  const plan = planRes.data?.plan_json as Plan | null
  if (!plan || plan.weeks.length === 0) {
    return NextResponse.json({ error: 'No plan found' }, { status: 404 })
  }

  const weekIndex = getCurrentWeekIndex(plan.weeks)
  const weekN     = weekIndex + 1
  const week      = plan.weeks[weekIndex]
  if (!week) return NextResponse.json({ error: 'No current week in plan' }, { status: 404 })

  // Check existing report
  if (!force) {
    const { data: existing } = await serviceSupabase
      .from('weekly_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('week_n', weekN)
      .maybeSingle()

    if (existing?.headline) {
      return NextResponse.json({ report: existing, cached: true })
    }
  }

  // Fetch completions and run_analysis for this week in parallel
  const [completionsRes, analysisRes, prevWeeksRes] = await Promise.all([
    serviceSupabase
      .from('session_completions')
      .select('week_n, session_day, status, rpe, fatigue_tag, avg_hr, coaching_flag')
      .eq('user_id', userId)
      .eq('week_n', weekN),
    serviceSupabase
      .from('run_analysis')
      .select('session_day, total_score, verdict, hr_in_zone_pct, ef_trend_pct, actual_load_km, planned_load_km')
      .eq('user_id', userId)
      .eq('week_n', weekN),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, actual_load_km')
      .eq('user_id', userId)
      .order('week_n', { ascending: false })
      .limit(40),
  ])

  const completions     = completionsRes.data ?? []
  const analyses        = analysisRes.data ?? []
  const prevRawWeeks    = prevWeeksRes.data ?? []

  // Aggregate weekly load from run_analysis
  const weekLoadMap: Record<number, number> = {}
  prevRawWeeks.forEach((r: any) => {
    if (!weekLoadMap[r.week_n]) weekLoadMap[r.week_n] = 0
    weekLoadMap[r.week_n] += r.actual_load_km ?? 0
  })

  const thisWeekKm    = analyses.reduce((s: number, r: any) => s + (r.actual_load_km ?? 0), 0)
  const priorWeeksKm  = Object.entries(weekLoadMap)
    .filter(([n]) => Number(n) < weekN)
    .sort(([a], [b]) => Number(b) - Number(a))
    .slice(0, 4)
    .map(([, km]) => km)

  const sessionsPlanned = Object.keys(week.sessions).filter(d => {
    const s = week.sessions[d as keyof typeof week.sessions]
    return s && s.type !== 'rest'
  }).length

  const sessionsCompleted = completions.filter((c: any) => c.status === 'complete').length
  const plannedKm         = week.weekly_km ?? 0

  const flagCounts = { ok: 0, watch: 0, flag: 0 }
  completions.forEach((c: any) => {
    const f = c.coaching_flag as keyof typeof flagCounts
    if (f && flagCounts[f] !== undefined) flagCounts[f]++
  })

  const rpeValues = completions.filter((c: any) => c.rpe != null).map((c: any) => c.rpe as number)
  const avgRpe    = rpeValues.length ? rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length : null

  const hrInZoneData = analyses.map((a: any) => ({
    sessionType: week.sessions[a.session_day.replace(`week_${weekN}_`, '') as keyof typeof week.sessions]?.type ?? 'easy',
    hrInZonePct: a.hr_in_zone_pct ?? null,
  }))

  const efTrendPct = analyses.length > 0
    ? analyses.reduce((s: number, a: any) => s + (a.ef_trend_pct ?? 0), 0) / analyses.length
    : null

  const reportData = computeWeeklyReportData({
    weekN,
    sessionsCompleted,
    sessionsPlanned,
    actualKm:         thisWeekKm,
    plannedKm,
    priorWeeksKm,
    sessionFlagCounts: flagCounts,
    hrInZoneData,
    efTrendPct,
  })

  // Merge avgRpe back in
  const reportDataWithRpe = { ...reportData, avgRpe }

  // AI report generation — silent fallback to null
  let headline: string | null = null
  let body:     string | null = null
  let cta:      string | null = null

  try {
    const prompt = buildWeeklyReportPrompt(
      reportDataWithRpe,
      plan,
      weekN,
      settingsRes.data?.first_name ?? undefined,
    )

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages:   [{ role: 'user', content: prompt }],
      }),
    })

    if (aiRes.ok) {
      const aiData  = await aiRes.json()
      const rawText = aiData.content?.[0]?.text?.trim() ?? ''
      const parsed  = parseReportFields(rawText)
      headline = parsed.headline
      body     = parsed.body
      cta      = parsed.cta
    }
  } catch {
    // silent fallback — report saved without AI content, UI falls back to rule-based
  }

  const reportRow = {
    user_id:              userId,
    week_n:               weekN,
    sessions_completed:   sessionsCompleted,
    sessions_planned:     sessionsPlanned,
    total_km_actual:      thisWeekKm,
    total_km_planned:     plannedKm,
    acute_chronic_ratio:  reportDataWithRpe.acuteChronicRatio,
    zone_discipline_score: reportDataWithRpe.zoneDisciplineScore,
    avg_rpe:              avgRpe,
    dominant_flag:        reportDataWithRpe.dominantFlag,
    headline,
    body,
    cta,
    generated_at:         new Date().toISOString(),
    ai_model:             'claude-haiku-4-5-20251001',
    rule_engine_version:  COACHING_RULE_ENGINE_VERSION,
  }

  await serviceSupabase
    .from('weekly_reports')
    .upsert(reportRow, { onConflict: 'user_id,week_n' })

  return NextResponse.json({ report: reportRow, cached: false })
}

function parseReportFields(text: string): { headline: string | null; body: string | null; cta: string | null } {
  const headlineMatch = text.match(/Headline:\s*["']?(.+?)["']?\n/i)
  const bodyMatch     = text.match(/Body:\s*["']?(.+?)["']?\n/i)
  const ctaMatch      = text.match(/CTA:\s*["']?(.+?)["']?(?:\n|$)/i)

  return {
    headline: headlineMatch?.[1]?.trim() ?? null,
    body:     bodyMatch?.[1]?.trim() ?? null,
    cta:      ctaMatch?.[1]?.trim() ?? null,
  }
}
