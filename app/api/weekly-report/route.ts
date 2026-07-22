import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { isFeatureAllowed } from '@/lib/plan/canUseFeature'
import { computeWeeklyReportData, pickSpotlightSession } from '@/lib/coaching/weeklyReport'
import { daysDueByEndOfYesterday } from '@/lib/coaching/dayBoundary'
import { COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import { buildWeeklyReportPrompt } from '@/lib/coaching/prompts/weeklyReport'
import { buildAthleteContext } from '@/lib/coaching/prompts/athleteContext'
import { isVerifiedCompletion } from '@/lib/coaching/completionVerification'
import { getCurrentWeekIndex, isDateWithinWeek } from '@/lib/plan'
import type { Plan } from '@/types/plan'
import { ANTHROPIC_MODEL_DEEP } from '@/lib/ai/models'

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

  // Fetch completions, run_analysis, and previous week's report in parallel
  const [completionsRes, analysisRes, prevWeeksRes, prevReportRes] = await Promise.all([
    serviceSupabase
      .from('session_completions')
      // strava_activity_id + apple_health_uuid are needed so isVerifiedCompletion
      // (RESHAPE-FIX-WAVE2B-AUDIT) recognises an activity-linked run that carries
      // no RPE/HR (e.g. phone-only Strava) as verified — without them such a real
      // run would be misclassified as a bare stub and dropped from the count.
      .select('week_n, session_day, status, rpe, fatigue_tag, avg_hr, coaching_flag, strava_activity_id, apple_health_uuid')
      .eq('user_id', userId)
      .eq('week_n', weekN),
    serviceSupabase
      .from('run_analysis')
      .select('session_day, total_score, verdict, hr_in_zone_pct, hr_above_ceiling_pct, hr_below_floor_pct, ef_trend_pct, actual_load_km, planned_load_km')
      .eq('user_id', userId)
      .eq('week_n', weekN),
    serviceSupabase
      .from('run_analysis')
      .select('week_n, actual_load_km')
      .eq('user_id', userId)
      .order('week_n', { ascending: false })
      .limit(40),
    // AI-DEPTH-04: conversation memory — pull last week's headline + body so the
    // model can reference progress or repeat-issues. Null on week 1 or when the
    // previous report had a silent AI fallback (headline/body null).
    weekN > 1
      ? serviceSupabase
          .from('weekly_reports')
          .select('headline, body')
          .eq('user_id', userId)
          .eq('week_n', weekN - 1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const completions     = completionsRes.data ?? []
  const analyses        = analysisRes.data ?? []
  const prevRawWeeks    = prevWeeksRes.data ?? []
  // AI-DEPTH-04 — only pass when both fields are present. Partial reports
  // (one field null from silent AI fallback) aren't worth referencing.
  const previousReport  = prevReportRes.data?.headline && prevReportRes.data?.body
    ? { headline: prevReportRes.data.headline as string, body: prevReportRes.data.body as string }
    : null

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

  // How far through the week are we? (0 = Monday, 6 = Sunday). Used for the
  // user-facing "it is currently {dayOfWeek}" line and to identify today's
  // session for the "remaining" bucket below. Day-boundary doctrine is in
  // the shared helper (CoachingPrinciples §65).
  const weekStart       = new Date(week.date)
  weekStart.setHours(0, 0, 0, 0)
  const todayMidnight   = new Date(); todayMidnight.setHours(0, 0, 0, 0)
  const dayIndex        = Math.min(Math.max(Math.floor((todayMidnight.getTime() - weekStart.getTime()) / 86_400_000), 0), 6)
  // getCurrentWeekIndex() pins to the last week once today is past the plan, so
  // dayIndex clamps to 6 ("Sunday") and the prompt would wrongly tell the model
  // "it is currently Sunday, day in flight". When today is outside this week's
  // window the week is DONE — no in-flight framing, no remaining sessions.
  const weekComplete    = !isDateWithinWeek(week, todayMidnight)
  const dayOfWeek       = weekComplete ? undefined : DAY_LABELS[dayIndex]
  // Today is in flight until midnight — a session due today is NOT missed
  // even at noon when the runner hasn't run yet. Single source of truth in
  // `daysDueByEndOfYesterday`; both this route and CoachScreen call it so
  // the "in-flight vs done" bug can't ship a third time.
  const daysDueByToday  = daysDueByEndOfYesterday(week.date)
  const todayKey        = DAY_ORDER_REPORT[dayIndex]

  // Strength sessions excluded from coaching logic until that feature is built out.
  const isCountableSession = (s: any) => s && s.type !== 'rest' && s.type !== 'strength'

  // Total sessions and km planned for the full week
  const sessionsPlanned = Object.keys(week.sessions).filter(d => {
    return isCountableSession(week.sessions[d as keyof typeof week.sessions])
  }).length
  const plannedKm = week.weekly_km ?? 0

  // Sessions and km that were due by yesterday end-of-day (for mid-week
  // comparison). Today is excluded — it's still in flight.
  const sessionsPlannedToDate = daysDueByToday.filter(d => {
    return isCountableSession(week.sessions[d as keyof typeof week.sessions])
  }).length
  const plannedKmToDate = daysDueByToday.reduce((sum, d) => {
    const s = week.sessions[d as keyof typeof week.sessions]
    if (!isCountableSession(s)) return sum
    return sum + (s?.distance_km ?? 0)
  }, 0)

  // RESHAPE-FIX-WAVE2B-AUDIT: the completed-session COUNT is an analytic and
  // must not treat a bare-stub tap as a real session (ADR-011 §3b).
  const sessionsCompleted = completions.filter((c: any) => {
    if (c.status !== 'complete') return false
    if (!isVerifiedCompletion(c)) return false
    const s = week.sessions[c.session_day as keyof typeof week.sessions]
    return isCountableSession(s)
  }).length

  // Sessions on past days that weren't completed — truly missed.
  // Today is never in this list.
  // NOTE: this set intentionally does NOT filter bare stubs — a "done" tap is
  // attendance ("I showed up"), so it must not be reported as a MISSED session
  // even when it carries no data. Verification gates the quality count above,
  // not the attendance/missed signal here.
  const completedDays = new Set(
    completions
      .filter((c: any) => c.status === 'complete')
      .map((c: any) => c.session_day as string)
  )
  const missedSessionTypes = daysDueByToday
    .filter(d => {
      if (!isCountableSession(week.sessions[d as keyof typeof week.sessions])) return false
      return !completedDays.has(d)
    })
    .map(d => (week.sessions[d as keyof typeof week.sessions] as any)?.type ?? 'run')

  // Remaining scheduled sessions: today (if not yet completed) + all future
  // days. Today goes first so the model can frame "still to do today" as
  // present-tense intent, not past-tense miss.
  const formatRemainingDay = (d: string): string | null => {
    const s = week.sessions[d as keyof typeof week.sessions]
    if (!isCountableSession(s)) return null
    const label = DAY_LABELS[DAY_ORDER_REPORT.indexOf(d as typeof DAY_ORDER_REPORT[number])]
    const km    = (s as any)?.distance_km ? ` (${(s as any).distance_km}km)` : ''
    return `${label}: ${(s as any)?.type}${km}`
  }
  const todayRemaining = !weekComplete && todayKey && !completedDays.has(todayKey)
    ? formatRemainingDay(todayKey)
    : null
  const futureLabels = weekComplete
    ? []
    : (DAY_ORDER_REPORT.slice(dayIndex + 1)
        .map(formatRemainingDay)
        .filter(Boolean) as string[])
  const remainingSessionLabels = [
    ...(todayRemaining ? [`${todayRemaining} (today, still to do)`] : []),
    ...futureLabels,
  ]

  // ── Race debrief ──────────────────────────────────────────────────────────
  // When this week contains a completed goal race, the report is a race DEBRIEF,
  // not a training-week scorecard. A race is run at race effort — not by holding
  // easy zones — so judging it on zone discipline is wrong, and a load spike on
  // race week is expected by design. We pass the real race day (fixes "Sunday's
  // race" when it was Saturday) and the pacing direction so below-zone on a long
  // race reads as smart pacing, never as "ran too hot".
  const raceDayKey = DAY_ORDER_REPORT.find(
    d => (week.sessions[d as keyof typeof week.sessions] as any)?.type === 'race'
  ) ?? null
  const raceAnalysis = raceDayKey
    ? analyses.find((a: any) => a.session_day === `week_${weekN}_${raceDayKey}`)
    : null
  const raceCompleted = !!raceDayKey && (
    completedDays.has(raceDayKey) || !!raceAnalysis
  )
  let raceDebrief: {
    dayName: string
    distanceKm: number | null
    zoneDirection: 'below' | 'above' | 'mixed' | null
  } | null = null
  if (raceDayKey && raceCompleted) {
    let zoneDirection: 'below' | 'above' | 'mixed' | null = null
    if (raceAnalysis) {
      const below  = Number((raceAnalysis as any).hr_below_floor_pct ?? 0)
      const above  = Number((raceAnalysis as any).hr_above_ceiling_pct ?? 0)
      const inZone = Number((raceAnalysis as any).hr_in_zone_pct ?? 0)
      if (below > above && below > inZone)       zoneDirection = 'below'
      else if (above > below && above > inZone)  zoneDirection = 'above'
      else                                       zoneDirection = 'mixed'
    }
    raceDebrief = {
      dayName:    DAY_LABELS[DAY_ORDER_REPORT.indexOf(raceDayKey as typeof DAY_ORDER_REPORT[number])],
      distanceKm: plan.meta.race_distance_km
        ?? (week.sessions[raceDayKey as keyof typeof week.sessions] as any)?.distance_km
        ?? null,
      zoneDirection,
    }
  }

  const flagCounts = { ok: 0, watch: 0, flag: 0 }
  completions.forEach((c: any) => {
    const f = c.coaching_flag as keyof typeof flagCounts
    if (f && flagCounts[f] !== undefined) flagCounts[f]++
  })

  const rpeValues = completions.filter((c: any) => c.rpe != null).map((c: any) => c.rpe as number)
  const avgRpe    = rpeValues.length ? rpeValues.reduce((s, v) => s + v, 0) / rpeValues.length : null

  const hrInZoneData = analyses.map((a: any) => ({
    hrInZonePct:  a.hr_in_zone_pct ?? null,
    actualLoadKm: a.actual_load_km ?? null,
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

  // Identify the single session that pulled the week's signal down hardest, if any.
  // Null when no session is concerning — the prompt then writes a clean-week message
  // without inventing a problem.
  // On a race week the "concerning session" is usually the race itself (low
  // in-zone %) — spotlighting it re-introduces the scolding we're removing.
  // The race-debrief block carries the race context instead.
  const spotlight = raceDebrief ? null : pickSpotlightSession(
    analyses.map((a: any) => ({
      session_day:    a.session_day,
      total_score:    a.total_score,
      verdict:        a.verdict,
      hr_in_zone_pct: a.hr_in_zone_pct,
      ef_trend_pct:   a.ef_trend_pct,
    })),
    week,
    weekN,
  )

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
      missedSessionTypes,
      spotlight,
      buildAthleteContext({ plan }),
      previousReport,
      raceDebrief,
    )

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      ANTHROPIC_MODEL_DEEP,
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
    ai_model:             ANTHROPIC_MODEL_DEEP,
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
