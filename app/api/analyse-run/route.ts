import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getUserTier } from '@/lib/trial'
import { scoreSession } from '@/lib/coaching/sessionScore'
import { computeEF, computeEFBaseline } from '@/lib/coaching/efTrend'
import { COACHING_RULE_ENGINE_VERSION } from '@/lib/coaching/constants'
import { buildSessionFeedbackPrompt } from '@/lib/coaching/prompts/sessionFeedback'
import type { Plan, Session } from '@/types/plan'

// POST /api/analyse-run
// Auth-gated (paid/trial). Called after a Strava activity is linked to a planned session.
// Returns run_analysis row + AI feedback text.

export async function POST(req: NextRequest) {
  // Internal webhook bypass: service key + explicit user_id header
  const serviceKey = req.headers.get('x-service-key')
  const headerUserId = req.headers.get('x-user-id')
  const isInternalCall = serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY && !!headerUserId

  let userId: string
  let tier: 'free' | 'trial' | 'paid'

  if (isInternalCall) {
    userId = headerUserId!
    tier   = 'trial'   // internal calls are always enriched
  } else {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
    tier   = await getUserTier(user.id)
    if (tier === 'free') return NextResponse.json({ error: 'Subscription required' }, { status: 403 })
  }

  const body = await req.json()
  const { strava_activity_id, week_n, session_day } = body as {
    strava_activity_id: number
    week_n: number
    session_day: string
  }

  if (!strava_activity_id || week_n == null || !session_day) {
    return NextResponse.json({ error: 'strava_activity_id, week_n, session_day required' }, { status: 422 })
  }

  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Fetch activity, plan, completions in parallel
  const [activityRes, planRes, completionRes, recentActivitiesRes] = await Promise.all([
    serviceSupabase
      .from('strava_activities')
      .select('*')
      .eq('user_id', userId)
      .eq('strava_activity_id', strava_activity_id)
      .single(),
    serviceSupabase
      .from('plans')
      .select('plan_json')
      .eq('user_id', userId)
      .single(),
    serviceSupabase
      .from('session_completions')
      .select('rpe, fatigue_tag, avg_hr')
      .eq('user_id', userId)
      .eq('week_n', week_n)
      .eq('session_day', session_day)
      .maybeSingle(),
    serviceSupabase
      .from('strava_activities')
      .select('avg_speed, avg_hr, activity_type, sport_type, start_date')
      .eq('user_id', userId)
      .order('start_date', { ascending: false })
      .limit(20),
  ])

  const activity = activityRes.data
  const plan     = planRes.data?.plan_json as Plan | null
  if (!activity || !plan) {
    return NextResponse.json({ error: 'Activity or plan not found' }, { status: 404 })
  }

  // Find the planned session in the plan
  const week    = plan.weeks.find(w => w.n === week_n)
  const dayKey  = session_day.replace(`week_${week_n}_`, '') as 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'
  const session = week?.sessions?.[dayKey] as Session | undefined
  if (!session) {
    return NextResponse.json({ error: 'Planned session not found' }, { status: 404 })
  }

  // Compute EF baseline from recent activities of same session type
  const recentActivities = (recentActivitiesRes.data ?? []).map((a: any) => ({
    id: a.strava_activity_id,
    name: '',
    type: a.activity_type ?? 'Run',
    sport_type: a.sport_type ?? 'Run',
    start_date: a.start_date,
    distance: 0,
    moving_time: 0,
    elapsed_time: 0,
    total_elevation_gain: 0,
    average_heartrate: a.avg_hr ?? undefined,
    average_speed: a.avg_speed ?? 0,
  }))

  const activityForEF = {
    id: activity.strava_activity_id,
    name: activity.name ?? '',
    type: activity.activity_type ?? 'Run',
    sport_type: activity.sport_type ?? 'Run',
    start_date: activity.start_date,
    distance: activity.distance_m ?? 0,
    moving_time: activity.moving_time_s ?? 0,
    elapsed_time: activity.elapsed_time_s ?? 0,
    total_elevation_gain: activity.elevation_gain ?? 0,
    average_heartrate: activity.avg_hr ?? undefined,
    average_speed: activity.avg_speed ?? 0,
  }

  const efValue    = computeEF(activityForEF)
  const efBaseline = computeEFBaseline(session.type, recentActivities, strava_activity_id)
  const efTrendPct = efValue !== null && efBaseline !== null
    ? ((efValue - efBaseline) / efBaseline) * 100
    : null

  // Score the session
  const scoreResult = scoreSession({
    session,
    actualDistKm:     (activity.distance_m ?? 0) / 1000,
    actualAvgHr:      activity.avg_hr ?? null,
    actualAvgSpeedMs: activity.avg_speed ?? 0,
    hrInZonePct:      activity.hr_in_zone_pct ?? null,
    efValue,
    efBaseline,
  })

  // Persist analysis
  const analysisRow = {
    user_id:               userId,
    week_n,
    session_day,
    strava_activity_id,
    hr_discipline_score:   scoreResult.hrDisciplineScore,
    distance_score:        scoreResult.distanceScore,
    pace_score:            scoreResult.paceScore,
    ef_score:              scoreResult.efScore,
    total_score:           scoreResult.totalScore,
    verdict:               scoreResult.verdict,
    hr_in_zone_pct:        activity.hr_in_zone_pct ?? null,
    hr_above_ceiling_pct:  activity.hr_above_ceiling_pct ?? null,
    hr_below_floor_pct:    activity.hr_below_floor_pct ?? null,
    ef_value:              efValue,
    ef_baseline:           efBaseline,
    ef_trend_pct:          efTrendPct,
    planned_load_km:       session.distance_km ?? null,
    actual_load_km:        (activity.distance_m ?? 0) / 1000,
    rule_engine_version:   COACHING_RULE_ENGINE_VERSION,
  }

  void serviceSupabase.from('run_analysis').upsert(analysisRow, { onConflict: 'user_id,strava_activity_id' })

  // AI feedback — always runs here (free users are blocked above)
  let feedbackText: string | null = null
  if (true) {
    try {
      const prompt = buildSessionFeedbackPrompt({
        session,
        weekN: week_n,
        plan,
        verdict:             scoreResult.verdict,
        totalScore:          scoreResult.totalScore,
        hrDisciplineScore:   scoreResult.hrDisciplineScore,
        distanceScore:       scoreResult.distanceScore,
        actualDistKm:        (activity.distance_m ?? 0) / 1000,
        actualAvgHr:         activity.avg_hr ?? null,
        hrInZonePct:         activity.hr_in_zone_pct ?? null,
        hrAboveCeilingPct:   activity.hr_above_ceiling_pct ?? null,
        efTrendPct,
        rpe:                 completionRes.data?.rpe ?? null,
        fatigueTag:          completionRes.data?.fatigue_tag ?? null,
      })

      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-api-key':       process.env.ANTHROPIC_API_KEY!,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages:   [{ role: 'user', content: prompt }],
        }),
      })

      if (aiRes.ok) {
        const aiData = await aiRes.json()
        feedbackText = aiData.content?.[0]?.text?.trim() ?? null
      }
    } catch {
      // silent fallback
    }
  }

  return NextResponse.json({
    analysis: {
      ...analysisRow,
      feedback_text: feedbackText,
    },
    score:   scoreResult,
  })
}
