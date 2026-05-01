import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
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
    if (!isFeatureAllowed('activity_intelligence', tier)) {
      return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
    }
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
  const { data: existing } = await serviceSupabase
    .from('weekly_reports')
    .select('*')
    .eq('user_id', userId)
    .eq('week_n', weekN)
    .maybeSingle()

  const todayUTC       = new Date().toISOString().slice(0, 10)
  const generatedToday = existing?.generated_at?.slice(0, 10) === todayUTC

  // Return cache if: no force requested, OR already regenerated today (once-per-day cap).
  if (existing?.headline && (!force || generatedToday)) {
    return NextResponse.json({ report: existing, cached: true, refresh_blocked: force && generatedToday })
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

  const DAY_ORDER_REPORT = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  // How far through the week are we? (0 = Monday, 6 = Sunday)
  const weekStart       = new Date(week.date)
  weekStart.setHours(0, 0, 0, 0)
  const todayMidnight   = new Date(); todayMidnight.setHours(0, 0, 0, 0)
  const dayIndex        = Math.min(Math.max(Math.floor((todayMidnight.getTime() - weekStart.getTime()) / 86_400_000), 0), 6)
  const dayOfWeek       = DAY_LABELS[dayIndex]
  const daysDueByToday  = DAY_ORDER_REPORT.slice(0, dayIndex + 1)

  // Strength sessions excluded from coaching logic until that feature is built out.
  const isCountableSession = (s: any) => s && s.type !== 'rest' && s.type !== 'strength'

  // Total sessions and km planned for the full week
  const sessionsPlanned = Object.keys(week.sessions).filter(d => {
    return isCountableSession(week.sessions[d as keyof typeof week.sessions])
  }).length
  const plannedKm = week.weekly_km ?? 0

  // Sessions and km that were due by today (for mid-week comparison)
  const sessionsPlannedToDate = daysDueByToday.filter(d => {
    return isCountableSession(week.sessions[d as keyof typeof week.sessions])
  }).length
  const plannedKmToDate = daysDueByToday.reduce((sum, d) => {
    const s = week.sessions[d as keyof typeof week.sessions]
    if (!isCountableSession(s)) return sum
    return sum + (s?.distance_km ?? 0)
  }, 0)

  const sessionsCompleted = completions.filter((c: any) => {
    if (c.status !== 'complete') return false
    const s = week.sessions[c.session_day as keyof typeof week.sessions]
    return isCountableSession(s)
  }).length

  // Remaining scheduled sessions after today — so the AI knows they're already in the plan
  const remainingSessionLabels = DAY_ORDER_REPORT.slice(dayIndex + 1)
    .map(d => {
      const s = week.sessions[d as keyof typeof week.sessions]
      if (!isCountableSession(s)) return null
      const label = DAY_LABELS[DAY_ORDER_REPORT.indexOf(d)]
      const km = (s as any)?.distance_km ? ` (${(s as any).distance_km}km)` : ''
      return `${label}: ${(s as any)?.type}${km}`
    })
    .filter(Boolean) as string[]

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
    sessionsPlannedToDate,
    actualKm:         thisWeekKm,
    plannedKm,
    plannedKmToDate,
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
      dayOfWeek,
      sessionsPlannedToDate,
      plannedKmToDate,
      remainingSessionLabels,
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
